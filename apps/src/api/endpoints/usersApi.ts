import { baseApi } from '../baseApi';

export type ProfileImageUploadResult = {
  fileKey: string;
  uploadedAt?: string;
};

/**
 * User profile-image RTK — P2-RES-04 (UI-API Restaurant Profile Endpoint 3).
 * Backend may restrict to CUSTOMER; residual if RESTAURANT receives 403.
 */
export const usersApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    uploadProfileImage: builder.mutation<
      ProfileImageUploadResult,
      { uri: string; mimeType: string; fileName: string }
    >({
      async queryFn(arg, _queryApi, _extraOptions, fetchWithBQ) {
        try {
          const response = await fetch(arg.uri);
          const blob = await response.blob();
          const formData = new FormData();
          formData.append('file', blob, arg.fileName);
          const result = await fetchWithBQ({
            url: '/api/v1/users/me/profile-image',
            method: 'POST',
            body: formData,
          });
          if (result.error) return { error: result.error };
          return { data: result.data as any };
        } catch (e: any) {
          return { error: { status: 'FETCH_ERROR', error: e.message } as any };
        }
      },
      invalidatesTags: [{ type: 'Restaurant', id: 'LIST' }],
    }),
  }),
});

export const { useUploadProfileImageMutation } = usersApi;
