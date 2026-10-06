import { baseApi } from '../baseApi';
import { Platform } from 'react-native';
import type {
  RegisterRestaurantRequest,
  RestaurantDetail,
  RestaurantDocType,
  RestaurantDocumentUploadResult,
  RestaurantImageType,
  RestaurantImageUploadResult,
} from '../../features/onboarding/types';
import type { UpdateRestaurantProfileRequest } from '../../features/profile/types';
import type {
  RestaurantReview,
  RestaurantReviewsParams,
} from '../../features/reviews/types';
import {
  DEFAULT_REVIEWS_PAGE_SIZE,
  isReviewSort,
} from '../../features/reviews/types';

function normalizeReviewItem(raw: any): RestaurantReview {
  if (!raw || typeof raw !== 'object') {
    return {
      restaurantRating: 5,
      rating: 5,
      comment: '',
      customerName: 'Verified Customer',
      verified: true,
    };
  }

  const ratingVal = Number(
    raw.restaurantRating ?? raw.rating ?? raw.restaurant_rating ?? 5
  );
  const deliveryRatingVal =
    raw.deliveryRating != null
      ? Number(raw.deliveryRating)
      : raw.delivery_rating != null
      ? Number(raw.delivery_rating)
      : null;
  const createdAtVal = raw.createdAt ?? raw.date ?? raw.created_at;

  return {
    id: raw.id ? String(raw.id) : undefined,
    orderId: raw.orderId ?? raw.order_id ? String(raw.orderId ?? raw.order_id) : undefined,
    customerId: raw.customerId ?? raw.customer_id ? String(raw.customerId ?? raw.customer_id) : undefined,
    customerName: raw.customerName ?? raw.customer_name ?? 'Verified Customer',
    restaurantRating: Number.isFinite(ratingVal) ? ratingVal : 5,
    rating: Number.isFinite(ratingVal) ? ratingVal : 5,
    deliveryRating: Number.isFinite(deliveryRatingVal) ? deliveryRatingVal : null,
    comment: raw.comment ?? null,
    createdAt: createdAtVal ? String(createdAtVal) : undefined,
    date: createdAtVal ? String(createdAtVal) : undefined,
    verified: raw.verified !== false,
  };
}

function normalizeReviewList(data: unknown): RestaurantReview[] {
  if (!data) return [];
  const unwrapped =
    typeof data === 'object' && data !== null && 'data' in data
      ? (data as { data: unknown }).data
      : data;

  let rawList: any[] = [];
  if (Array.isArray(unwrapped)) {
    rawList = unwrapped;
  } else if (
    unwrapped &&
    typeof unwrapped === 'object' &&
    Array.isArray((unwrapped as { content?: unknown }).content)
  ) {
    rawList = (unwrapped as { content: any[] }).content;
  } else if (
    unwrapped &&
    typeof unwrapped === 'object' &&
    Array.isArray((unwrapped as { items?: unknown }).items)
  ) {
    rawList = (unwrapped as { items: any[] }).items;
  }

  // Filter out any legacy dummy / seed reviews (e.g. dummy reviews with "Good food" or empty comment from early testing)
  const isDummyReview = (raw: any): boolean => {
    if (!raw) return true;
    const comment = (raw.comment || '').trim();
    const created = String(raw.createdAt || raw.date || raw.created_at || '');
    if (comment === 'Good food' && created.startsWith('2026-09-19')) return true;
    if (!comment && created.startsWith('2026-09-06')) return true;
    return false;
  };

  return rawList.filter((item) => !isDummyReview(item)).map(normalizeReviewItem);
}

/**
 * Restaurant RTK — P2-RES-01 create/docs/images/get; P2-RES-04 PUT + reviews.
 * No GET /restaurants/me (GAP-API-03).
 */
export const restaurantsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    registerRestaurant: builder.mutation<RestaurantDetail, RegisterRestaurantRequest>(
      {
        query: (body) => ({
          url: '/api/v1/restaurants',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: {
            name: body.name,
            description: body.description ?? null,
            cuisineTypes: body.cuisineTypes,
            address: body.address,
            // commissionPct accepted but ignored server-side — omit from client
          },
        }),
        transformResponse: (response: any) => response?.data || response,
        invalidatesTags: [{ type: 'Restaurant', id: 'LIST' }],
      },
    ),
    getRestaurantProfile: builder.query<RestaurantDetail, void>({
      query: () => '/api/v1/restaurants/me',
      transformResponse: (response: any) => response?.data || response,
      providesTags: (result) =>
        result?.restaurantId
          ? [
            { type: 'Restaurant', id: result.restaurantId },
            { type: 'Restaurant', id: 'LIST' },
          ]
          : [{ type: 'Restaurant', id: 'LIST' }],
      keepUnusedDataFor: 120,
    }),
    getRestaurant: builder.query<RestaurantDetail, string>({
      query: (restaurantId) => `/api/v1/restaurants/${restaurantId}`,
      transformResponse: (response: any) => response?.data || response,
      providesTags: (_result, _error, id) => [{ type: 'Restaurant', id }],
      keepUnusedDataFor: 120,
    }),
    updateRestaurantProfile: builder.mutation<
      RestaurantDetail,
      UpdateRestaurantProfileRequest
    >({
      query: (body) => ({
        url: '/api/v1/restaurants/me',
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: {
          name: body.name,
          description: body.description ?? null,
          cuisineTypes: body.cuisineTypes,
          address: body.address,
          // status / commissionPct not updatable — omit
        },
      }),
      transformResponse: (response: any) => response?.data || response,
      invalidatesTags: (result) =>
        result?.restaurantId
          ? [
            { type: 'Restaurant', id: result.restaurantId },
            { type: 'Restaurant', id: 'LIST' },
          ]
          : [{ type: 'Restaurant', id: 'LIST' }],
    }),
    toggleRestaurantStatus: builder.mutation<RestaurantDetail, boolean>({
      query: (isOpen) => ({
        url: `/api/v1/restaurants/me/status?isOpen=${isOpen}`,
        method: 'PUT',
      }),
      transformResponse: (response: any) => response?.data || response,
      invalidatesTags: (result) =>
        result?.restaurantId
          ? [
            { type: 'Restaurant', id: result.restaurantId },
            { type: 'Restaurant', id: 'LIST' },
          ]
          : [{ type: 'Restaurant', id: 'LIST' }],
    }),
    getRestaurantReviews: builder.query<
      RestaurantReview[],
      RestaurantReviewsParams
    >({
      query: ({
        restaurantId,
        page = 0,
        size = DEFAULT_REVIEWS_PAGE_SIZE,
        sort = 'createdAt',
      }) => ({
        url: `/api/v1/restaurants/${restaurantId}/reviews`,
        params: {
          page,
          size: Math.min(size, 100),
          ...(sort && isReviewSort(sort) ? { sort } : { sort: 'createdAt' }),
        },
      }),
      transformResponse: (response: unknown) => normalizeReviewList(response),
      providesTags: (_result, _error, arg) => [
        { type: 'Review', id: `LIST-${arg.restaurantId}` },
      ],
      keepUnusedDataFor: 120,
    }),
    uploadRestaurantDocument: builder.mutation<
      RestaurantDocumentUploadResult,
      { docType: RestaurantDocType; uri: string; mimeType: string; fileName: string; fileObj?: any }
    >({
      query: ({ docType, uri, mimeType, fileName, fileObj }) => {
        const formData = new FormData();
        formData.append('docType', docType);
        if (fileObj) {
          formData.append('file', fileObj);
        } else {
          formData.append('file', {
            uri,
            type: mimeType,
            name: fileName,
          } as unknown as Blob);
        }
        return {
          url: '/api/v1/restaurants/me/documents',
          method: 'POST',
          body: formData,
        };
      },
      transformResponse: (response: any) => response?.data || response,
      invalidatesTags: [{ type: 'Restaurant', id: 'LIST' }],
    }),
    uploadRestaurantImages: builder.mutation<
      RestaurantImageUploadResult,
      {
        imageType: RestaurantImageType;
        uri: string;
        mimeType: string;
        fileName: string;
        fileObj?: any;
      }
    >({
      query: ({ imageType, uri, mimeType, fileName, fileObj }) => {
        const formData = new FormData();
        formData.append('imageType', imageType);
        if (fileObj) {
          formData.append('file', fileObj);
        } else {
          formData.append('file', {
            uri,
            type: mimeType,
            name: fileName,
          } as unknown as Blob);
        }
        return {
          url: '/api/v1/restaurants/me/images',
          method: 'POST',
          body: formData,
          responseHandler: 'text',
        };
      },
      transformResponse: (response: any) => response?.data || response,
      invalidatesTags: [{ type: 'Restaurant', id: 'LIST' }],
    }),
    resubmitRestaurant: builder.mutation<RestaurantDetail, void>({
      query: () => ({
        url: '/api/v1/restaurants/me/resubmit',
        method: 'POST',
      }),
      transformResponse: (response: any) => response?.data || response,
      invalidatesTags: (result) =>
        result?.restaurantId
          ? [
            { type: 'Restaurant', id: result.restaurantId },
            { type: 'Restaurant', id: 'LIST' },
          ]
          : [{ type: 'Restaurant', id: 'LIST' }],
    }),
    updateTimings: builder.mutation<RestaurantDetail, { openTime: string; closeTime: string; openDays: string[] }>({
      query: (body) => ({
        url: '/api/v1/restaurants/me/timings',
        method: 'PUT',
        body,
      }),
      transformResponse: (response: any) => response?.data || response,
      invalidatesTags: (result) =>
        result?.restaurantId
          ? [
            { type: 'Restaurant', id: result.restaurantId },
            { type: 'Restaurant', id: 'LIST' },
          ]
          : [{ type: 'Restaurant', id: 'LIST' }],
    }),
    submitRegistration: builder.mutation<RestaurantDetail, void>({
      query: () => ({
        url: '/api/v1/restaurants/me/submit',
        method: 'POST',
      }),
      transformResponse: (response: any) => response?.data || response,
      invalidatesTags: (result) =>
        result?.restaurantId
          ? [
            { type: 'Restaurant', id: result.restaurantId },
            { type: 'Restaurant', id: 'LIST' },
          ]
          : [{ type: 'Restaurant', id: 'LIST' }],
    }),
    getDashboardSummary: builder.query<any, { dateFrom?: string; dateTo?: string } | void>({
      query: (params) => ({
        url: '/api/v1/restaurants/me/dashboard-summary',
        params: params || undefined,
      }),
      transformResponse: (response: any) => response?.data || response,
      providesTags: [{ type: 'Restaurant' as any, id: 'LIST' }],
    }),
  }),
});

export const {
  useRegisterRestaurantMutation,
  useGetRestaurantProfileQuery,
  useToggleRestaurantStatusMutation,
  useGetRestaurantQuery,
  useUpdateRestaurantProfileMutation,
  useGetRestaurantReviewsQuery,
  useUploadRestaurantDocumentMutation,
  useUploadRestaurantImagesMutation,
  useResubmitRestaurantMutation,
  useUpdateTimingsMutation,
  useSubmitRegistrationMutation,
  useGetDashboardSummaryQuery,
} = restaurantsApi;
