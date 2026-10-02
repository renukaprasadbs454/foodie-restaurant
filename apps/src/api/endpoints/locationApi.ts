import { baseApi } from '../baseApi';
import type { RestaurantLocation } from '../../features/profile/location/locationTypes';

export interface LocationZoneDto {
  id: string;
  zoneName: string;
  cityName: string;
  latitude: number;
  longitude: number;
  radiusKm: number;
  polygonCoordinates: string;
  activeDrivers: number;
  surgeMultiplier: number;
  status: string;
  restaurantEnabled: boolean;
  deliveryPartnerEnabled: boolean;
  customerOrderingEnabled: boolean;
}

export const locationApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getRestaurantLocation: builder.query<RestaurantLocation, void>({
      query: () => '/api/v1/restaurants/me/location',
      providesTags: [{ type: 'Restaurant', id: 'LOCATION' }],
      keepUnusedDataFor: 120,
    }),
    updateRestaurantLocation: builder.mutation<RestaurantLocation, RestaurantLocation>({
      query: (body) => ({
        url: '/api/v1/restaurants/me/location',
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body,
      }),
      invalidatesTags: [{ type: 'Restaurant', id: 'LOCATION' }],
    }),
    getZones: builder.query<{ data: LocationZoneDto[] }, void>({
      query: () => '/api/v1/admin/location/zones',
      keepUnusedDataFor: 600,
    }),
  }),
});

export const {
  useGetRestaurantLocationQuery,
  useUpdateRestaurantLocationMutation,
  useGetZonesQuery,
} = locationApi;
