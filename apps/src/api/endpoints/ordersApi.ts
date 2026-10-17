import { baseApi } from '../baseApi';
import type {
  OrderDetail,
  OrderPaymentInfo,
  OrderSummary,
  RestaurantOrdersParams,
  TransitionOrderStatusArg,
} from '../../features/orders/types';
import {
  DEFAULT_ORDERS_PAGE_SIZE,
  isOrderSort,
} from '../../features/orders/types';
import { MOCK_ORDERS } from '../../mock/orderData';

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

  const specificPm =
    (item.paymentMode && !['online', 'prepaid'].includes(String(item.paymentMode).toLowerCase()) ? String(item.paymentMode).trim() : undefined) ||
    (item.payment_mode && !['online', 'prepaid'].includes(String(item.payment_mode).toLowerCase()) ? String(item.payment_mode).trim() : undefined) ||
    (item.paymentType && !['online', 'prepaid'].includes(String(item.paymentType).toLowerCase()) ? String(item.paymentType).trim() : undefined) ||
    (item.payment_type && !['online', 'prepaid'].includes(String(item.payment_type).toLowerCase()) ? String(item.payment_type).trim() : undefined) ||
    (item.payment?.paymentMode && !['online', 'prepaid'].includes(String(item.payment.paymentMode).toLowerCase()) ? String(item.payment.paymentMode).trim() : undefined) ||
    (item.payment?.method && !['online', 'prepaid'].includes(String(item.payment.method).toLowerCase()) ? String(item.payment.method).trim() : undefined) ||
    (item.paymentDetails?.paymentMode && !['online', 'prepaid'].includes(String(item.paymentDetails.paymentMode).toLowerCase()) ? String(item.paymentDetails.paymentMode).trim() : undefined) ||
    (item.paymentDetails?.method && !['online', 'prepaid'].includes(String(item.paymentDetails.method).toLowerCase()) ? String(item.paymentDetails.method).trim() : undefined) ||
    (item.paymentMethod && !['online', 'prepaid'].includes(String(item.paymentMethod).toLowerCase()) ? String(item.paymentMethod).trim() : undefined) ||
    (item.payment_method && !['online', 'prepaid'].includes(String(item.payment_method).toLowerCase()) ? String(item.payment_method).trim() : undefined);

  let txnHint: string | undefined;
  const rawTxnStr = String(
    item.transactionId ||
    item.transaction_id ||
    item.paymentId ||
    item.payment_id ||
    item.payment?.transactionId ||
    item.payment?.id ||
    item.razorpayPaymentId ||
    ''
  ).toUpperCase();
  if (rawTxnStr.includes('UPI')) txnHint = 'UPI';
  else if (rawTxnStr.includes('CARD') || rawTxnStr.includes('CC_') || rawTxnStr.includes('DC_')) txnHint = 'CARD';
  else if (rawTxnStr.includes('NB_') || rawTxnStr.includes('NETBANK')) txnHint = 'NET BANKING';
  else if (rawTxnStr.includes('WAL_') || rawTxnStr.includes('WALLET')) txnHint = 'WALLET';
  else if (rawTxnStr.includes('GPAY')) txnHint = 'GOOGLE PAY';
  else if (rawTxnStr.includes('PHONEPE')) txnHint = 'PHONEPE';
  else if (rawTxnStr.includes('PAYTM')) txnHint = 'PAYTM';

  const rawPm =
    specificPm ||
    txnHint ||
    item.paymentMethod ||
    item.payment_method ||
    item.paymentMode ||
    item.payment_mode ||
    item.paymentType ||
    item.payment_type ||
    item.payment?.paymentMethod ||
    item.payment?.paymentMode ||
    item.payment?.method ||
    item.payment?.mode ||
    item.payment?.type ||
    item.paymentDetails?.paymentMethod ||
    item.paymentDetails?.method ||
    item.paymentDetails?.mode ||
    item.method ||
    item.mode;

  const isCodBool =
    item.isCOD === true ||
    item.isCod === true ||
    item.is_cod === true ||
    item.cod === true ||
    item.isCashOnDelivery === true ||
    item.is_cash_on_delivery === true ||
    item.cashOnDelivery === true ||
    item.payment?.isCOD === true ||
    item.payment?.isCod === true ||
    item.payment?.cod === true ||
    item.paymentDetails?.isCOD === true ||
    item.paymentDetails?.isCod === true ||
    item.paymentDetails?.cod === true ||
    String(item.isCOD).toLowerCase() === 'true' ||
    String(item.isCod).toLowerCase() === 'true' ||
    String(item.cod).toLowerCase() === 'true';

  const isCodStr =
    typeof rawPm === 'string' &&
    (rawPm.toLowerCase().includes('cod') ||
      rawPm.toLowerCase().includes('cash') ||
      rawPm.toLowerCase() === 'pay_on_delivery' ||
      rawPm.toLowerCase() === 'c');

  let storedPm: string | undefined;
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const mapRaw = window.localStorage.getItem('foodie_orders_payment_methods_map');
      if (mapRaw) {
        const map = JSON.parse(mapRaw);
        storedPm = map[orderId] || map[orderNumber] || map[item.id];
      }
    } catch { }
  }

  const isCOD = Boolean(isCodBool || isCodStr || (storedPm && (storedPm.toLowerCase().includes('cod') || storedPm.toLowerCase().includes('cash'))));
  const resolvedPaymentMethod = isCOD
    ? 'COD'
    : (specificPm || txnHint || rawPm || storedPm || (item.paymentStatus === 'PAID' ? 'ONLINE' : undefined));

  return {
    ...item,
    orderId,
    orderNumber,
    customerId: item.customerId ?? item.customer_id ?? item.userId ?? item.user_id,
    userId: item.userId ?? item.user_id ?? item.customerId ?? item.customer_id,
    customerName: customerName || item.customerName,
    customerPhone: customerPhone || item.customerPhone,
    deliveryAddress: rawAddr ?? item.deliveryAddress,
    paymentMethod: resolvedPaymentMethod ?? item.paymentMethod,
    paymentMode: resolvedPaymentMethod ?? item.paymentMode,
    isCOD: isCOD,
    isCod: isCOD,
    paymentStatus: isCOD ? (item.paymentStatus || 'PENDING') : (item.paymentStatus || 'PAID'),
    transactionId: isCOD ? undefined : (
      item.transactionId ||
      item.transaction_id ||
      item.paymentId ||
      item.payment_id ||
      item.payment?.transactionId ||
      item.payment?.id ||
      item.razorpayPaymentId
    ),
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
      async queryFn(args, _queryApi, _extraOptions, baseQuery) {
        const params = {
          ...(args.status ? { status: args.status } : {}),
          page: args.page ?? 0,
          size: Math.min(args.size ?? DEFAULT_ORDERS_PAGE_SIZE, 100),
          ...(args.sort && isOrderSort(args.sort) ? { sort: args.sort } : { sort: 'placedAt' }),
        };

        let res = await baseQuery({
          url: '/api/v1/restaurants/me/orders',
          params,
        });

        if (res.error) {
          res = await baseQuery({
            url: '/api/v1/orders/restaurant',
            params,
          });
        }

        if (res.error) {
          return { error: res.error as any };
        }

        return { data: normalizeOrderList(res.data) };
      },
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
      async queryFn(orderId, _queryApi, _extraOptions, baseQuery) {
        const cleanId = String(orderId || '').replace(/^#/, '').trim();
        if (!cleanId) {
          return { error: { status: 400, data: 'Invalid orderId' } as any };
        }

        let res = await baseQuery(`/api/v1/restaurants/me/orders/${cleanId}`);
        if (res.error) {
          res = await baseQuery(`/api/v1/orders/${cleanId}`);
        }

        if (!res.error && res.data) {
          return { data: normalizeOrderItem(res.data) };
        }

        const mock = MOCK_ORDERS.find(
          (o) =>
            o.orderId === cleanId ||
            o.id === cleanId ||
            o.orderNumber === cleanId ||
            o.orderNumber === `#${cleanId}`
        );
        if (mock) {
          return { data: normalizeOrderItem(mock) };
        }

        return { error: res.error as any };
      },
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
      async queryFn(orderId, _queryApi, _extraOptions, baseQuery) {
        const cleanId = String(orderId || '').replace(/^#/, '').trim();
        if (!cleanId) {
          return { data: {} };
        }

        let res = await baseQuery(`/api/v1/orders/${cleanId}/customer`);
        if (res.error) {
          res = await baseQuery(`/api/v1/restaurants/me/orders/${cleanId}/customer`);
        }
        if (res.error) {
          res = await baseQuery(`/api/v1/restaurants/me/orders/${cleanId}`);
        }
        if (res.error) {
          res = await baseQuery(`/api/v1/orders/${cleanId}`);
        }

        if (!res.error && res.data) {
          const unwrapped = (res.data as any)?.data ?? res.data;
          return { data: unwrapped };
        }

        const mock = MOCK_ORDERS.find(
          (o) =>
            o.orderId === cleanId ||
            o.id === cleanId ||
            o.orderNumber === cleanId ||
            o.orderNumber === `#${cleanId}`
        );
        if (mock) {
          return {
            data: {
              name: mock.customerName,
              customerName: mock.customerName,
              phone: mock.customerPhone,
              customerPhone: mock.customerPhone,
              address: mock.deliveryAddress,
              deliveryAddress: mock.deliveryAddress,
            },
          };
        }

        return { data: {} };
      },
      keepUnusedDataFor: 300,
    }),
    getOrderPayment: builder.query<OrderPaymentInfo, string>({
      async queryFn(orderId, _queryApi, _extraOptions, baseQuery) {
        const cleanId = String(orderId || '').replace(/^#/, '').trim();
        if (!cleanId) {
          return { error: { status: 400, data: 'Invalid orderId' } as any };
        }

        // 1. Probe candidate backend live endpoints for real payment information
        const candidateEndpoints = [
          `/api/v1/orders/${cleanId}/payment`,
          `/api/v1/restaurants/me/orders/${cleanId}/payment`,
          `/api/v1/payments/order/${cleanId}`,
          `/api/v1/restaurants/me/orders/${cleanId}`,
          `/api/v1/orders/${cleanId}`,
        ];

        let payload: any = null;

        for (const ep of candidateEndpoints) {
          try {
            const res = await baseQuery(ep);
            if (!res.error && res.data) {
              const unwrapped = (res.data as any)?.data ?? res.data;
              if (unwrapped && typeof unwrapped === 'object') {
                payload = unwrapped;
                break;
              }
            }
          } catch {
            // continue probe
          }
        }

        const findSpecificMethod = (item: any): string => {
          if (!item || typeof item !== 'object') return '';
          const fields = [
            item.paymentMode,
            item.payment_mode,
            item.paymentType,
            item.payment_type,
            item.payment?.paymentMode,
            item.payment?.payment_mode,
            item.payment?.method,
            item.payment?.mode,
            item.payment?.type,
            item.paymentDetails?.paymentMode,
            item.paymentDetails?.method,
            item.paymentDetails?.mode,
            item.method,
            item.mode,
            item.type,
            item.paymentMethod,
            item.payment_method,
            item.payment?.paymentMethod,
            item.paymentDetails?.paymentMethod,
          ];
          for (const f of fields) {
            if (typeof f === 'string' && f.trim()) {
              const lower = f.trim().toLowerCase().replace(/[-_]/g, ' ');
              if (lower !== 'online' && lower !== 'online payment' && lower !== 'prepaid') {
                return f.trim();
              }
            }
          }
          const rawTxn = String(
            item.transactionId ||
            item.transaction_id ||
            item.txnId ||
            item.paymentId ||
            item.razorpayPaymentId ||
            ''
          ).toUpperCase();
          if (rawTxn.includes('UPI')) return 'UPI';
          if (rawTxn.includes('CARD') || rawTxn.includes('CC_') || rawTxn.includes('DC_')) return 'CARD';
          if (rawTxn.includes('NB_') || rawTxn.includes('NETBANK')) return 'NET BANKING';
          if (rawTxn.includes('WAL_') || rawTxn.includes('WALLET')) return 'WALLET';
          if (rawTxn.includes('GPAY')) return 'GOOGLE PAY';
          if (rawTxn.includes('PHONEPE')) return 'PHONEPE';
          if (rawTxn.includes('PAYTM')) return 'PAYTM';
          return '';
        };

        if (payload) {
          const specific = findSpecificMethod(payload);
          const rawPm =
            specific ||
            payload.paymentMethod ||
            payload.payment_method ||
            payload.paymentMode ||
            payload.payment_mode ||
            payload.payment?.paymentMethod ||
            payload.paymentDetails?.paymentMethod ||
            '';

          const isCOD = Boolean(
            payload.isCOD === true ||
            payload.isCod === true ||
            payload.is_cod === true ||
            payload.cod === true ||
            payload.isCashOnDelivery === true ||
            String(payload.isCOD).toLowerCase() === 'true' ||
            String(payload.isCod).toLowerCase() === 'true' ||
            String(rawPm).toLowerCase().includes('cod') ||
            String(rawPm).toLowerCase().includes('cash')
          );

          const paymentStatus =
            payload.paymentStatus ||
            payload.payment_status ||
            payload.status ||
            payload.payment?.status ||
            (isCOD ? 'PENDING' : 'PAID');

          const transactionId = isCOD
            ? null
            : (
                payload.transactionId ||
                payload.transaction_id ||
                payload.txnId ||
                payload.txn_id ||
                payload.paymentId ||
                payload.payment_id ||
                payload.razorpayPaymentId ||
                payload.razorpay_payment_id ||
                payload.cashfreeOrderId ||
                payload.payment?.transactionId ||
                payload.payment?.id ||
                null
              );

          return {
            data: {
              paymentMethod: isCOD ? 'COD' : (rawPm || 'ONLINE'),
              paymentStatus,
              transactionId,
              isCOD,
            },
          };
        }

        // 2. Check localStorage map
        if (typeof window !== 'undefined' && window.localStorage) {
          try {
            const mapRaw = window.localStorage.getItem('foodie_orders_payment_methods_map');
            if (mapRaw) {
              const map = JSON.parse(mapRaw);
              const stored = map[cleanId] || map[`#${cleanId}`];
              if (stored) {
                const isCOD = String(stored).toLowerCase().includes('cod') || String(stored).toLowerCase().includes('cash');
                return {
                  data: {
                    paymentMethod: stored,
                    paymentStatus: isCOD ? 'PENDING' : 'PAID',
                    transactionId: isCOD ? null : `TXN_${cleanId.slice(-9).toUpperCase()}`,
                    isCOD,
                  },
                };
              }
            }
          } catch {}
        }

        // 3. Fallback to mock order data
        const mockMatch = MOCK_ORDERS.find(
          (o) =>
            o.orderId === cleanId ||
            o.id === cleanId ||
            o.orderNumber === cleanId ||
            o.orderNumber === `#${cleanId}`
        );

        if (mockMatch) {
          const specific = findSpecificMethod(mockMatch);
          const isCOD = Boolean(
            mockMatch.isCOD ||
            mockMatch.isCod ||
            mockMatch.paymentMethod === 'COD' ||
            String(mockMatch.paymentMethod).toLowerCase().includes('cash')
          );
          return {
            data: {
              paymentMethod: isCOD ? 'COD' : (specific || mockMatch.paymentMethod || 'ONLINE'),
              paymentStatus: mockMatch.paymentStatus || (isCOD ? 'PENDING' : 'PAID'),
              transactionId: isCOD ? null : (mockMatch.transactionId || `TXN_${cleanId.slice(-9).toUpperCase()}`),
              isCOD,
            },
          };
        }

        return {
          error: {
            status: 404,
            data: 'Payment record not found',
          } as any,
        };
      },
      providesTags: (_result, _error, orderId) => [
        { type: 'Order', id: `${orderId}-payment` },
      ],
      keepUnusedDataFor: 45,
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
  useGetOrderPaymentQuery,
} = ordersApi;
