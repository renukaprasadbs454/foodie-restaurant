import { baseApi } from '../baseApi';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  type CreateCouponBody,
  type RestaurantCoupon,
  type GetRestaurantCouponsArgs,
  type ToggleCouponStatusArgs,
  normalizeCoupon,
  filterCouponsForRestaurant,
  resolveRestaurantZone,
  canonicalZoneId,
} from '../../features/campaigns/types';

export * from '../../features/campaigns/types';

let cachedWorkingBffUrl: string | null = null;

function getCandidateBffUrls(): string[] {
  let hostIp = 'localhost';
  if (Constants.expoConfig?.hostUri) {
    hostIp = Constants.expoConfig.hostUri.split(':')[0];
  } else if (Platform.OS === 'android') {
    hostIp = '10.0.2.2';
  }

  const list: string[] = [
    'http://localhost:3000',
    `http://${hostIp}:3000`,
    'http://127.0.0.1:3000',
    `http://${hostIp}:3100`,
    'http://localhost:3100',
  ];

  if (typeof window !== 'undefined' && window.location) {
    const webHostname = window.location.hostname;
    if (webHostname) {
      const url3000 = `http://${webHostname}:3000`;
      const url3100 = `http://${webHostname}:3100`;
      if (!list.includes(url3000)) list.push(url3000);
      if (!list.includes(url3100)) list.push(url3100);
    }
    if (window.location.origin && !list.includes(window.location.origin)) {
      list.push(window.location.origin);
    }
  }

  if (cachedWorkingBffUrl && list.includes(cachedWorkingBffUrl)) {
    return [cachedWorkingBffUrl, ...list.filter((u) => u !== cachedWorkingBffUrl)];
  }
  return list;
}

const STORAGE_KEY_PREFIX = '@foodie:restaurant_coupons:';

export const couponsApi = baseApi.injectEndpoints({
  overrideExisting: true,
  endpoints: (builder) => ({
    getRestaurantCoupons: builder.query<RestaurantCoupon[], GetRestaurantCouponsArgs>({
      queryFn: async ({ restaurantId, zoneId }, _queryApi, _extraOptions, baseQuery) => {
        if (!restaurantId || !restaurantId.trim()) {
          return { data: [] };
        }

        const cleanRestId = restaurantId.trim();
        const cleanZone = zoneId ? canonicalZoneId(zoneId) : '';
        const candidateBffUrls = getCandidateBffUrls();
        let fetchedCoupons: any[] = [];
        let fetchedFromNetwork = false;

        // 1. Parallel probe of candidate BFF endpoints (Admin Panel single source of truth prioritized)
        try {
          const fetchPromises = candidateBffUrls.flatMap((base) => {
            const probeEndpoint = async (url: string) => {
              const controller = new AbortController();
              const timer = setTimeout(() => controller.abort(), 1500);
              try {
                const res = await fetch(url, {
                  method: 'GET',
                  headers: {
                    Accept: 'application/json',
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    Pragma: 'no-cache',
                  },
                  cache: 'no-store',
                  signal: controller.signal,
                });
                clearTimeout(timer);
                if (res.ok) {
                  const json = await res.json();
                  const list = json?.data ?? json;
                  if (Array.isArray(list)) {
                    cachedWorkingBffUrl = base;
                    return list;
                  }
                }
              } catch {
                clearTimeout(timer);
              }
              throw new Error('Not reachable');
            };

            const queryParams = new URLSearchParams({
              restaurantId: cleanRestId,
              _t: String(Date.now()),
            });
            if (cleanZone) {
              queryParams.set('zoneId', cleanZone);
            }

            return [
              probeEndpoint(`${base}/api/bff/admin/coupons?_t=${Date.now()}`),
              probeEndpoint(`${base}/api/bff/restaurant/coupons?${queryParams.toString()}`),
            ];
          });

          fetchedCoupons = await Promise.any(fetchPromises);
          fetchedFromNetwork = true;
        } catch {
          // BFF parallel fetch did not succeed, try remote backend
        }

        // 2. Query remote backend endpoint if BFF was unreachable
        if (!fetchedFromNetwork) {
          try {
            const res = await baseQuery({
              url: '/api/v1/restaurant/coupons',
              params: {
                restaurantId: cleanRestId,
                ...(cleanZone ? { zoneId: cleanZone } : {}),
                _t: Date.now(),
              },
            });
            if (res.data) {
              const rawList = (res.data as any)?.data ?? res.data ?? [];
              if (Array.isArray(rawList)) {
                fetchedCoupons = rawList;
                fetchedFromNetwork = true;
              }
            }
          } catch {
            // Fall through
          }
        }

        // 3. Strict Restaurant Data & Zone Isolation
        const isolated = filterCouponsForRestaurant(fetchedCoupons, cleanRestId, cleanZone);

        // 4. Persistence management
        const storageKey = `${STORAGE_KEY_PREFIX}${cleanRestId}`;
        if (fetchedFromNetwork) {
          try {
            await AsyncStorage.setItem(storageKey, JSON.stringify(isolated));
          } catch {
            // Ignore storage write errors
          }
          return { data: isolated };
        }

        // 5. Offline fallback: load cached coupons strictly for this restaurant and zone
        try {
          const cached = await AsyncStorage.getItem(storageKey);
          if (cached) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed)) {
              const verified = filterCouponsForRestaurant(parsed, cleanRestId, cleanZone);
              return { data: verified };
            }
          }
        } catch {
          // Ignore storage read errors
        }

        return { data: [] };
      },
      providesTags: (_result, _error, arg) => [
        { type: 'Coupon', id: `RESTAURANT-${arg.restaurantId}` },
      ],
      keepUnusedDataFor: 60,
    }),

    toggleCouponStatus: builder.mutation<
      { couponId: string; isActive: boolean },
      ToggleCouponStatusArgs
    >({
      queryFn: async ({ couponId, isActive, restaurantId }, _queryApi, _extraOptions, baseQuery) => {
        const cleanRestId = (restaurantId || '').trim();
        const candidateBffUrls = getCandidateBffUrls();
        const action = isActive ? 'activate' : 'deactivate';

        // 1. Fast parallel dispatch to BFF endpoints
        try {
          const fetchPromises = candidateBffUrls.map(async (base) => {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 1200);
            try {
              const res = await fetch(
                `${base}/api/bff/admin/coupons/${encodeURIComponent(couponId)}/${action}`,
                {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  cache: 'no-store',
                  signal: controller.signal,
                },
              );
              clearTimeout(timer);
              if (res.ok) {
                cachedWorkingBffUrl = base;
                return true;
              }
            } catch {
              clearTimeout(timer);
            }
            throw new Error('Not reachable');
          });

          await Promise.any(fetchPromises);
        } catch {
          // Fall through to remote backend
        }

        // 2. Also dispatch to remote backend if reachable
        try {
          await baseQuery({
            url: `/api/v1/restaurant/coupons/${encodeURIComponent(couponId)}/status?isActive=${isActive}`,
            method: 'PATCH',
          });
        } catch {
          try {
            await baseQuery({
              url: `/api/v1/restaurant/coupons/${encodeURIComponent(couponId)}/${action}`,
              method: 'PATCH',
            });
          } catch {}
        }

        // 3. Update persistent local storage for this restaurant immediately
        if (cleanRestId) {
          const storageKey = `${STORAGE_KEY_PREFIX}${cleanRestId}`;
          try {
            const cached = await AsyncStorage.getItem(storageKey);
            if (cached) {
              const parsed = JSON.parse(cached);
              if (Array.isArray(parsed)) {
                const updated = parsed.map((c: RestaurantCoupon) =>
                  (c.couponId === couponId || c.code === couponId)
                    ? { ...c, isActive }
                    : c,
                );
                await AsyncStorage.setItem(storageKey, JSON.stringify(updated));
              }
            }
          } catch {
            // Ignore storage errors
          }
        }

        return { data: { couponId, isActive } };
      },
      // Optimistic update: instantly flip coupon status in the cache with 0ms delay!
      async onQueryStarted({ couponId, isActive, restaurantId, zoneId }, { dispatch, queryFulfilled }) {
        const patchResultWithZone = zoneId ? dispatch(
          couponsApi.util.updateQueryData('getRestaurantCoupons', { restaurantId, zoneId }, (draft) => {
            const item = draft.find((c) => c.couponId === couponId || c.code === couponId);
            if (item) {
              item.isActive = isActive;
            }
          }),
        ) : null;

        const patchResultPlain = dispatch(
          couponsApi.util.updateQueryData('getRestaurantCoupons', { restaurantId }, (draft) => {
            const item = draft.find((c) => c.couponId === couponId || c.code === couponId);
            if (item) {
              item.isActive = isActive;
            }
          }),
        );

        try {
          await queryFulfilled;
        } catch {
          // If the mutation fails, rollback optimistic updates!
          patchResultWithZone?.undo();
          patchResultPlain.undo();
        }
      },
      // Note: NO invalidatesTags here, preventing unnecessary refetch loops and race conditions!
    }),

    createCoupon: builder.mutation<any, CreateCouponBody>({
      query: (body) => ({
        url: '/api/v1/restaurant/coupons',
        method: 'POST',
        body,
      }),
      invalidatesTags: [{ type: 'Coupon', id: 'LIST' }],
    }),
  }),
});

export const {
  useGetRestaurantCouponsQuery,
  useToggleCouponStatusMutation,
  useCreateCouponMutation,
} = couponsApi;
