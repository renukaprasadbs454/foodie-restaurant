import { baseApi } from '../baseApi';
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

function normalizeReviewList(data: unknown): RestaurantReview[] {
  if (Array.isArray(data)) return data as RestaurantReview[];
  if (
    data &&
    typeof data === 'object' &&
    Array.isArray((data as { content?: unknown }).content)
  ) {
    return (data as { content: RestaurantReview[] }).content;
  }
  return [];
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
          ? [{ type: 'Restaurant', id: result.restaurantId }]
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
      async queryFn(arg, _queryApi, _extraOptions, fetchWithBQ) {
        try {
          const response = await fetch(arg.uri);
          const blob = await response.blob();
          const formData = new FormData();
          formData.append('imageType', arg.imageType);
          formData.append('file', blob, arg.fileName);
          const result = await fetchWithBQ({
            url: '/api/v1/restaurants/me/images',
            method: 'POST',
            body: formData,
          });
          if (result.error) return { error: result.error };
          return { data: (result.data as any)?.data || result.data };
        } catch (e: any) {
          return { error: { status: 'FETCH_ERROR', error: e.message } as any };
        }
      },
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
  }),
});

export const {
  useRegisterRestaurantMutation,
  useGetRestaurantProfileQuery,
  useGetRestaurantQuery,
  useUpdateRestaurantProfileMutation,
  useGetRestaurantReviewsQuery,
  useUploadRestaurantDocumentMutation,
  useUploadRestaurantImagesMutation,
  useResubmitRestaurantMutation,
} = restaurantsApi;
