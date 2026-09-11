import { baseApi } from '../baseApi';

export interface RestaurantSettlement {
    id: string;
    restaurantId: string;
    settlementNumber: string;
    settlementPeriodStart: string;
    settlementPeriodEnd: string;
    grossSales: number;
    commissionAmount: number;
    taxDeducted: number;
    netPayable: number;
    status: 'PENDING' | 'APPROVED' | 'DISBURSED' | 'FAILED';
    paymentReference?: string;
    disbursedAt?: string;
    createdAt: string;
}

export interface PayoutRequestDto {
    amount: number;
    accountHolderName: string;
    accountNumber: string;
    ifscCode: string;
    bankName: string;
}

export interface RestaurantEarningsSummary {
    grossEarnings: number;
    netSettled: number;
    pendingPayout: number;
    totalOrders: number;
    totalSettlements: number;
}

export const settlementsApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        getRestaurantSettlements: builder.query<any, void>({
            query: () => '/api/v1/restaurants/me/wallet/ledger',
            providesTags: [{ type: 'Restaurant', id: 'SETTLEMENTS' }],
            keepUnusedDataFor: 60,
        }),
        getRestaurantEarnings: builder.query<any, void>({
            query: () => '/api/v1/restaurants/me/wallet/balance',
            providesTags: [{ type: 'Restaurant', id: 'EARNINGS' }],
            keepUnusedDataFor: 60,
        }),
        requestPayout: builder.mutation<{ success: boolean; data: any }, PayoutRequestDto>({
            query: (body) => ({
                url: '/api/v1/restaurants/me/wallet/payout-requests',
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body,
            }),
            invalidatesTags: [{ type: 'Restaurant', id: 'SETTLEMENTS' }, { type: 'Restaurant', id: 'EARNINGS' }],
        }),
    }),
});

export const {
    useGetRestaurantSettlementsQuery,
    useGetRestaurantEarningsQuery,
    useRequestPayoutMutation,
} = settlementsApi;
