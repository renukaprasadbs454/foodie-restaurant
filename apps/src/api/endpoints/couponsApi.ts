import { baseApi } from '../baseApi';

export interface CreateCouponBody {
    code: string;
    discountType: 'FLAT' | 'PERCENT';
    value: number;
    minOrderAmount: number;
    maxDiscountAmount?: number;
    expiryDate: string;
    usageLimitTotal?: number;
    usageLimitPerUser: number;
    funderType?: string;
    couponType?: string;
    benefitMode?: string;
}

export const couponsApi = baseApi.injectEndpoints({
    overrideExisting: true,
    endpoints: (builder) => ({
        createCoupon: builder.mutation<any, CreateCouponBody>({
            query: (body) => ({
                url: '/api/v1/restaurant/coupons',
                method: 'POST',
                body,
            }),
            invalidatesTags: [],
        }),
    }),
});

export const { useCreateCouponMutation } = couponsApi;
