import { baseApi } from '../baseApi';
import type {
  OrderDetail,
  OrderSummary,
  RestaurantOrdersParams,
  TransitionOrderStatusArg,
} from '../../features/orders/types';
import {
  DEFAULT_ORDERS_PAGE_SIZE,
  isOrderSort,
} from '../../features/orders/types';

export function normalizeOrderItem(raw: any): OrderDetail {
  if (!raw || typeof raw !== 'object') return raw;

  const item = (raw as any)?.data ?? raw;
  const rawAddr = item.deliveryAddress ?? item.delivery_address ?? item.address ?? item.shippingAddress;

  const customerName =
    item.customerName ||
    item.customer_name ||
    item.customer?.name ||
    item.customer?.fullName ||
    item.customer?.displayName ||
    item.deliveryAddress?.name ||
    item.deliveryAddress?.recipientName ||
    item.deliveryAddress?.customerName ||
    item.deliveryAddress?.fullName ||
    item.user?.name ||
    item.user?.displayName ||
    item.user?.fullName ||
    item.userName ||
    item.recipientName ||
    item.contactName ||
    (typeof rawAddr === 'object' && rawAddr ? rawAddr.name || rawAddr.recipientName : undefined) ||
    '';

  const customerPhone =
    item.customerPhone ||
    item.customer_phone ||
    item.customer?.phone ||
    item.customer?.phoneNumber ||
    item.customer?.mobile ||
    item.deliveryAddress?.phone ||
    item.deliveryAddress?.phoneNumber ||
    item.deliveryAddress?.contactPhone ||
    item.user?.phone ||
    item.user?.phoneNumber ||
    item.phone ||
    item.phoneNumber ||
    item.contactPhone ||
    item.recipientPhone ||
    (typeof rawAddr === 'object' && rawAddr ? rawAddr.phone || rawAddr.phoneNumber || rawAddr.contactPhone : undefined) ||
    '';

  const orderId = String(item.orderId || item.id || item.order_id || '');
  const orderNumber = String(
    item.orderNumber ||
      item.order_number ||
      (orderId ? (orderId.startsWith('#') ? orderId : `#${orderId.slice(-8)}`) : '')
  );

  return {
    ...item,
    orderId,
    orderNumber,
    customerId: item.customerId ?? item.customer_id ?? item.userId ?? item.user_id,
    userId: item.userId ?? item.user_id ?? item.customerId ?? item.customer_id,
    customerName: customerName || item.customerName,
    customerPhone: customerPhone || item.customerPhone,
    deliveryAddress: rawAddr ?? item.deliveryAddress,
    paymentMethod:
      item.paymentMethod ||
      item.payment_method ||
      item.paymentMode ||
      item.payment_mode ||
      item.payment?.method ||
      item.payment?.mode ||
      item.method,
    paymentStatus: item.paymentStatus || item.payment_status || item.payment?.status || item.status,
    transactionId:
      item.transactionId ||
      item.transaction_id ||
      item.paymentId ||
      item.payment_id ||
      item.payment?.transactionId ||
      item.payment?.id ||
      item.razorpayPaymentId,
    totalAmount: item.totalAmount ?? item.total_amount ?? item.total ?? 0,
    subtotal: item.subtotal ?? item.sub_total ?? item.totalAmount ?? item.total ?? 0,
    placedAt: item.placedAt || item.placed_at || item.createdAt || item.created_at,
    createdAt: item.createdAt || item.created_at || item.placedAt,
    items: item.items || item.orderItems || item.order_items || item.orderLineItems || item.lineItems || [],
  };
}

export function normalizeOrderList(data: unknown): OrderSummary[] {
  if (!data) return [];
  const unwrapped: any =
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
  return rawList.map((item) => normalizeOrderItem(item) as OrderSummary);
}

/**
 * Restaurant orders RTK — P2-RES-02.
 * GET /orders/restaurant has no restaurantId query (JWT resolves restaurant).
 */
export const ordersApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getRestaurantOrders: builder.query<OrderSummary[], RestaurantOrdersParams>({
      query: ({
        status,
        page = 0,
        size = DEFAULT_ORDERS_PAGE_SIZE,
        sort = 'placedAt',
      }) => ({
        url: '/api/v1/orders/restaurant',
        params: {
          ...(status ? { status } : {}),
          page,
          size: Math.min(size, 100),
          ...(sort && isOrderSort(sort) ? { sort } : { sort: 'placedAt' }),
        },
      }),
      transformResponse: (response: unknown) => normalizeOrderList(response),
      providesTags: (result) =>
        result
          ? [
            ...result.map(({ orderId }) => ({
              type: 'Order' as const,
              id: orderId,
            })),
            { type: 'Order', id: 'LIST' },
          ]
          : [{ type: 'Order', id: 'LIST' }],
      keepUnusedDataFor: 45,
    }),
    getOrder: builder.query<OrderDetail, string>({
      query: (orderId) => `/api/v1/orders/${orderId}`,
      transformResponse: (response: unknown) => normalizeOrderItem(response),
      providesTags: (_result, _error, orderId) => [
        { type: 'Order', id: orderId },
      ],
      keepUnusedDataFor: 45,
    }),
    transitionOrderStatus: builder.mutation<
      OrderDetail,
      TransitionOrderStatusArg
    >({
      query: ({ orderId, targetStatus, reason, preparationTime }) => ({
        url: `/api/v1/orders/${orderId}/status`,
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: {
          targetStatus,
          reason: reason ?? null,
          ...(preparationTime !== undefined ? { preparationTime } : {}),
        },
      }),
      transformResponse: (response: unknown) => normalizeOrderItem(response),
      invalidatesTags: (_result, _error, arg) => [
        { type: 'Order', id: arg.orderId },
      ],
    }),
    getOrderMessages: builder.query<any[], string>({
      query: (orderId) => `/api/v1/orders/${orderId}/messages`,
      providesTags: (_result, _error, orderId) => [
        { type: 'Order', id: orderId },
      ],
      keepUnusedDataFor: 0,
    }),
    sendOrderMessage: builder.mutation<
      any,
      { orderId: string; senderRole: string; messageText: string }
    >({
      query: ({ orderId, senderRole, messageText }) => ({
        url: `/api/v1/orders/${orderId}/messages`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { senderRole, messageText },
      }),
      invalidatesTags: (_result, _error, arg) => [
        { type: 'Order', id: arg.orderId },
      ],
    }),
    getOrderCustomer: builder.query<
      {
        name?: string;
        phone?: string;
        address?: string;
        customerName?: string;
        customerPhone?: string;
        deliveryAddress?: string;
      },
      string
    >({
      query: (orderId) => `/api/v1/orders/${orderId}/customer`,
      transformResponse: (response: any) => response?.data ?? response,
      keepUnusedDataFor: 300,
    }),
  }),
});

export const {
  useGetRestaurantOrdersQuery,
  useGetOrderQuery,
  useTransitionOrderStatusMutation,
  useGetOrderMessagesQuery,
  useSendOrderMessageMutation,
  useGetOrderCustomerQuery,
} = ordersApi;
