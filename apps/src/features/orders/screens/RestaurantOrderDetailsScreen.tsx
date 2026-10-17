import React, { useEffect, useState } from 'react';
import { Platform, RefreshControl, ScrollView, View, Linking, Pressable } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Button,
  Card,
  EmptyState,
  Modal,
  Text,
  Toast,
  trackAnalyticsEvent,
  useApiErrorHandler,
  useConnectivity,
  useTheme,
} from 'foodie-shared-rn';
import {
  normalizeOrderItem,
  useGetOrderCustomerQuery,
  useGetOrderPaymentQuery,
  useGetOrderQuery,
  useTransitionOrderStatusMutation,
} from '../../../api/endpoints/ordersApi';
import { useGetRestaurantProfileQuery } from '../../../api/endpoints/restaurantsApi';
import { InvoicePreviewModal } from '../components/InvoicePreviewModal';
import { toUnwrappedApiError } from '../../auth/apiError';
import { useAppSelector } from '../../../store/hooks';
import { selectRestaurantId } from '../../onboarding/restaurantOnboardingSlice';
import { OrderDetailSkeleton } from '../components/OrderDetailSkeleton';
import { OrderStatusBadge } from '../components/OrderStatusBadge';
import { OrderTimeline } from '../components/OrderTimeline';
import { RejectOrderModal } from '../components/RejectOrderModal';
import { SwipeButton } from '../../../components/SwipeButton';
import { AcceptOrderModal } from '../components/AcceptOrderModal';
import { useRestaurantOrdersSubscription } from '../hooks/useRestaurantOrdersSubscription';
import {
  formatMoney,
  isOrderId,
  isTerminalOrderStatus,
  restaurantActionsForStatus,
  type RestaurantTransitionStatus,
} from '../types';
import { OrderChat } from '../components/OrderChat';
import type { OrdersStackParamList } from '../../../navigation/types';
import { DemoModeIndicator } from '../../../components/DemoModeIndicator';
import { MOCK_CONFIG } from '../../../config/mockConfig';
import { getMockOrderDetails, type ExtendedOrderDetail } from '../../../mock';
import { extractPaymentDetails, generateInvoice } from '../utils/invoiceGenerator';

type Props = NativeStackScreenProps<
  OrdersStackParamList,
  'RestaurantOrderDetails'
>;

const BRAND_PRIMARY = '#14532D'; // Dark Green
const BRAND_ACCENT = '#F59E0B';  // Gold

export function RestaurantOrderDetailsScreen({ route }: Props) {
  const { orderId } = route.params;
  const { tokens } = useTheme();
  const { isConnected } = useConnectivity();
  const storedRestaurantId = useAppSelector(selectRestaurantId);
  const restaurantId =
    storedRestaurantId ??
    (MOCK_CONFIG.ENABLE_MOCK_FALLBACK ? MOCK_CONFIG.DEFAULT_MOCK_RESTAURANT_ID : undefined);

  const { wsActive } = useRestaurantOrdersSubscription(restaurantId ?? null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [chatVisible, setChatVisible] = useState(false);
  const [showInvoice, setShowInvoice] = useState<boolean>(false);

  const { data: restaurantProfile } = useGetRestaurantProfileQuery();

  const handleInvoiceClick = () => {
    // When Invoice button clicked, set showInvoice state true immediately with zero delay
    setShowInvoice(true);
  };

  const [toast, setToast] = useState<{
    message: string;
    variant: 'info' | 'success' | 'error' | 'warning';
  } | null>(null);

  const validId = Boolean(orderId && orderId !== 'undefined' && orderId !== 'null');

  const query = useGetOrderQuery(orderId, {
    skip: !validId,
    pollingInterval: wsActive ? 0 : 45_000,
    refetchOnFocus: true,
  });

  const customerQuery = useGetOrderCustomerQuery(orderId, {
    skip: !validId,
  });
  const customerData = customerQuery.data;

  const [transition] = useTransitionOrderStatusMutation();

  // Local demo state override for order status transitions
  const mockOrderInitial = getMockOrderDetails(orderId);
  const [localOrder, setLocalOrder] = useState<ExtendedOrderDetail>(mockOrderInitial);

  useEffect(() => {
    setLocalOrder(getMockOrderDetails(orderId));
  }, [orderId]);

  const apiOrder = (query.data as any)?.data ?? query.data;
  const isUsingMock =
    MOCK_CONFIG.ENABLE_MOCK_FALLBACK &&
    (!isConnected || query.isError || !apiOrder);

  const paymentQuery = useGetOrderPaymentQuery(orderId, {
    skip: !validId,
  });
  const paymentInfo = paymentQuery.data;

  const rawOrder = apiOrder ?? (isUsingMock ? localOrder : undefined);
  const normalized = rawOrder ? (normalizeOrderItem(rawOrder) as ExtendedOrderDetail) : undefined;
  const order: ExtendedOrderDetail | undefined = normalized
    ? {
        ...normalized,
        customerName: customerData?.customerName || customerData?.name || normalized.customerName,
        customerPhone: customerData?.customerPhone || customerData?.phone || normalized.customerPhone,
        deliveryAddress: customerData?.deliveryAddress || customerData?.address || normalized.deliveryAddress,
        paymentMethod: paymentInfo?.paymentMethod || normalized.paymentMethod,
        paymentMode: paymentInfo?.paymentMode || paymentInfo?.paymentMethod || normalized.paymentMode,
        isCOD: paymentInfo?.isCOD ?? normalized.isCOD,
        isCod: paymentInfo?.isCOD ?? normalized.isCod,
        paymentStatus: paymentInfo?.paymentStatus || normalized.paymentStatus,
        transactionId: paymentInfo?.transactionId || normalized.transactionId,
      }
    : undefined;

  const paymentDetails = extractPaymentDetails(order, rawOrder, paymentInfo);

  const handleError = useApiErrorHandler({
    onToast: (error) => setToast({ message: error.message, variant: 'error' }),
    onModalBlocking: (error) =>
      setToast({ message: error.message, variant: 'error' }),
    onInlineField: (error) =>
      setToast({ message: error.message, variant: 'error' }),
    onFullScreen: (error) =>
      setToast({ message: error.message, variant: 'error' }),
    onGeneric: (error) => setToast({ message: error.message, variant: 'error' }),
  });

  useEffect(() => {
    trackAnalyticsEvent('restaurant_order_details_viewed', { orderId });
  }, [orderId]);

  const onTransition = async (
    targetStatus: RestaurantTransitionStatus,
    reason?: string,
    preparationTime?: number,
  ) => {
    if (isUsingMock) {
      setLocalOrder((prev) => ({
        ...prev,
        status: targetStatus,
        orderStatusEvents: [
          ...(prev.orderStatusEvents ?? []),
          {
            eventId: `e-demo-${Date.now()}`,
            fromStatus: prev.status,
            toStatus: targetStatus,
            reason: reason ?? null,
            createdAt: new Date().toISOString(),
          },
        ],
      }));
      setShowRejectModal(false);
      setToast({
        message: `Order status set to ${targetStatus} (Demo Mode).`,
        variant: 'success',
      });
      return;
    }

    try {
      await transition({ orderId, targetStatus, reason: reason ?? null, preparationTime }).unwrap();
      setShowRejectModal(false);
      setShowAcceptModal(false);
      setToast({ message: `Status updated to ${targetStatus}.`, variant: 'success' });
      void query.refetch();
    } catch (error) {
      handleError(toUnwrappedApiError(error));
    }
  };

  if (!validId && !isUsingMock) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: tokens.color.background,
          padding: tokens.spacing.xl,
          justifyContent: 'center',
        }}
      >
        <EmptyState
          title="Invalid Order"
          description="Order ID must be a valid UUID."
          accessibilityLabel="Invalid order id"
        />
      </View>
    );
  }

  const actions = restaurantActionsForStatus(order?.status);

  return (
    <View style={{ flex: 1, backgroundColor: tokens.color.background }}>
      <ScrollView
        contentContainerStyle={{
          padding: tokens.spacing.md,
          gap: tokens.spacing.md,
          paddingBottom: 80,
        }}
        refreshControl={
          <RefreshControl
            refreshing={query.isFetching}
            onRefresh={() => {
              void query.refetch();
            }}
          />
        }
      >
        {/* DEMO MODE INDICATOR */}
        {isUsingMock ? <DemoModeIndicator isMockActive={true} /> : null}

        {query.isLoading && !order && !isUsingMock ? (
          <OrderDetailSkeleton />
        ) : !order ? (
          <EmptyState
            title="Order Not Found"
            description="This order details could not be retrieved."
            accessibilityLabel="Order not found"
            actionLabel="Retry"
            onAction={() => {
              void query.refetch();
            }}
          />
        ) : (
          <>
            {/* ORDER HEADER CARD */}
            <Card
              style={{
                padding: tokens.spacing.lg,
                borderRadius: 14,
                gap: tokens.spacing.sm,
                borderLeftWidth: 5,
                borderLeftColor: BRAND_PRIMARY,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ gap: 2 }}>
                  <Text variant="heading1" style={{ color: BRAND_PRIMARY, fontWeight: 'bold' }}>
                    {order.orderNumber}
                  </Text>
                  <Text variant="caption" color={tokens.color.textSecondary}>
                    {order.placedAt ? `Placed at ${new Date(order.placedAt).toLocaleString()}` : 'Order'}
                  </Text>

                  {order.customerName ? (
                    <Text variant="label" style={{ color: tokens.color.textPrimary, marginTop: 2 }}>
                      👤 Customer: {order.customerName}
                    </Text>
                  ) : order.customerId ? (
                    <Text variant="caption" color={tokens.color.textSecondary}>
                      Customer ID: {order.customerId}
                    </Text>
                  ) : null}

                  {order.deliveryAddress ? (
                    <Text variant="caption" color={tokens.color.textSecondary} style={{ marginTop: 2 }}>
                      📍 {order.deliveryAddress}
                    </Text>
                  ) : null}

                  <View style={{ flexDirection: 'row', gap: 8, marginTop: tokens.spacing.sm, flexWrap: 'wrap' }}>
                    {order.customerPhone ? (
                      <Button
                        label="📞 Call Customer"
                        accessibilityLabel="Call Customer"
                        variant="secondary"
                        style={{ paddingHorizontal: 12, height: 36 }}
                        onPress={() => {
                          Linking.openURL(`tel:${order.customerPhone}`).catch(() => {
                            setToast({ message: `Cannot place call.`, variant: 'error' });
                          });
                        }}
                      />
                    ) : null}

                    <Button
                      label="🧾 Invoice"
                      accessibilityLabel="Preview and Download Invoice"
                      variant="secondary"
                      style={{
                        paddingHorizontal: 12,
                        height: 36,
                        borderColor: BRAND_PRIMARY,
                        borderWidth: 1.5,
                        backgroundColor: '#F0FDF4',
                      }}
                      onPress={handleInvoiceClick}
                    />
                  </View>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 6 }}>
                  <OrderStatusBadge status={order.status} size="lg" />
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4,
                      backgroundColor: paymentDetails.isCOD ? '#FEF3C7' : '#DCFCE7',
                      borderColor: paymentDetails.isCOD ? '#F59E0B' : '#16A34A',
                      borderWidth: 1,
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      borderRadius: 6,
                    }}
                  >
                    <Text
                      variant="caption"
                      style={{
                        color: paymentDetails.isCOD ? '#B45309' : '#166534',
                        fontWeight: 'bold',
                        fontSize: 11,
                      }}
                    >
                      {paymentDetails.isCOD ? '💵 CASH ON DELIVERY' : `💳 ${paymentDetails.paymentMethodText}`}
                    </Text>
                  </View>
                </View>
              </View>
            </Card>

            {/* ORDER TIMELINE CARD */}
            <Card style={{ padding: tokens.spacing.md, borderRadius: 14 }}>
              <OrderTimeline status={order.status} />
            </Card>

            {/* ORDERED ITEMS LIST CARD */}
            <Card style={{ padding: tokens.spacing.md, borderRadius: 14, gap: tokens.spacing.sm }}>
              <Text variant="heading2" style={{ color: BRAND_PRIMARY, fontSize: 17 }}>
                Ordered Food Items
              </Text>
              <View style={{ height: 1, backgroundColor: tokens.color.border }} />

              {(order.items ?? []).length === 0 ? (
                <Text variant="body" color={tokens.color.textSecondary}>
                  No line items provided for this order.
                </Text>
              ) : (
                (order.items ?? []).map((item, index) => (
                  <View
                    key={`${item.menuItemId ?? 'item'}-${index}`}
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      paddingVertical: tokens.spacing.xs,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.sm }}>
                      <View
                        style={{
                          backgroundColor: '#DCFCE7',
                          width: 28,
                          height: 28,
                          borderRadius: 14,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Text variant="label" style={{ color: BRAND_PRIMARY, fontWeight: 'bold' }}>
                          {item.quantity}x
                        </Text>
                      </View>
                      <View>
                        <Text variant="body" style={{ color: tokens.color.textPrimary, fontWeight: '600' }}>
                          {item.name ?? 'Food Item'}
                        </Text>
                        {item.unitPrice ? (
                          <Text variant="caption" color={tokens.color.textSecondary}>
                            {formatMoney(item.unitPrice)} each
                          </Text>
                        ) : null}
                      </View>
                    </View>

                    <Text variant="label" style={{ color: BRAND_PRIMARY, fontWeight: 'bold' }}>
                      {formatMoney(item.lineTotal)}
                    </Text>
                  </View>
                ))
              )}
            </Card>

            {/* FINANCIAL SUMMARY CARD */}
            <Card style={{ padding: tokens.spacing.md, borderRadius: 14, gap: tokens.spacing.xs }}>
              <Text variant="heading2" style={{ color: BRAND_PRIMARY, fontSize: 17, marginBottom: 4 }}>
                Financial Summary
              </Text>
              <View style={{ height: 1, backgroundColor: tokens.color.border, marginBottom: 4 }} />

              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text variant="body" color={tokens.color.textSecondary}>Subtotal</Text>
                <Text variant="body" style={{ color: tokens.color.textPrimary }}>{formatMoney(order.subtotal)}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text variant="body" color={tokens.color.textSecondary}>Delivery Fee</Text>
                <Text variant="body" style={{ color: tokens.color.textPrimary }}>{formatMoney(order.deliveryFee)}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text variant="body" color={tokens.color.textSecondary}>Discounts</Text>
                <Text variant="body" style={{ color: '#16A34A' }}>-{formatMoney(order.discountAmount)}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text variant="body" color={tokens.color.textSecondary}>Taxes & Fees</Text>
                <Text variant="body" style={{ color: tokens.color.textPrimary }}>{formatMoney(order.taxAmount)}</Text>
              </View>

              <View style={{ height: 1, backgroundColor: tokens.color.border, marginVertical: tokens.spacing.xs }} />

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text variant="heading2" style={{ color: BRAND_PRIMARY, fontSize: 18 }}>
                  Total Amount
                </Text>
                <Text variant="heading1" style={{ color: BRAND_ACCENT, fontSize: 24, fontWeight: 'bold' }}>
                  {formatMoney(order.totalAmount)}
                </Text>
              </View>

              {/* REAL PAYMENT DETAILS FROM BACKEND */}
              <View
                style={{
                  marginTop: tokens.spacing.xs,
                  padding: tokens.spacing.sm,
                  borderRadius: 8,
                  backgroundColor: paymentDetails.isCOD ? '#FFFBEB' : '#F0FDF4',
                  borderWidth: 1,
                  borderColor: paymentDetails.isCOD ? '#FDE68A' : '#BBF7D0',
                  gap: 4,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text variant="caption" style={{ fontWeight: '600', color: tokens.color.textSecondary }}>
                    Payment Method
                  </Text>
                  <Text
                    variant="label"
                    style={{
                      fontWeight: 'bold',
                      color: paymentDetails.isCOD ? '#B45309' : '#166534',
                      fontSize: 13,
                    }}
                  >
                    {paymentDetails.paymentMethodText}
                  </Text>
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text variant="caption" style={{ fontWeight: '600', color: tokens.color.textSecondary }}>
                    Payment Status
                  </Text>
                  <Text
                    variant="label"
                    style={{
                      fontWeight: 'bold',
                      color: paymentDetails.isCOD ? '#D97706' : '#15803D',
                      fontSize: 12,
                    }}
                  >
                    {paymentDetails.paymentStatusText}
                  </Text>
                </View>

                {paymentDetails.isCOD ? (
                  <View
                    style={{
                      marginTop: 4,
                      paddingTop: 4,
                      borderTopWidth: 1,
                      borderTopColor: '#FDE68A',
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <Text variant="caption" style={{ fontWeight: 'bold', color: '#92400E' }}>
                      💵 Amount To Be Collected:
                    </Text>
                    <Text variant="label" style={{ fontWeight: 'bold', color: '#B45309', fontSize: 15 }}>
                      ₹{Number(order.totalAmount || 0).toFixed(2)}
                    </Text>
                  </View>
                ) : (
                  paymentDetails.transactionId ? (
                    <View
                      style={{
                        marginTop: 4,
                        paddingTop: 4,
                        borderTopWidth: 1,
                        borderTopColor: '#BBF7D0',
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <Text variant="caption" style={{ color: '#166534', fontWeight: '600' }}>
                        Transaction ID:
                      </Text>
                      <Text variant="caption" style={{ color: '#14532D', fontFamily: 'monospace', fontWeight: 'bold' }}>
                        {paymentDetails.transactionId}
                      </Text>
                    </View>
                  ) : null
                )}
              </View>
            </Card>

            {/* LIVE MESSAGE / CHAT & INVOICE */}
            <View style={{ flexDirection: 'row', gap: tokens.spacing.sm, paddingHorizontal: tokens.spacing.md, marginTop: tokens.spacing.md }}>
              {order.status && !isTerminalOrderStatus(order.status) ? (
                <View style={{ flex: 1 }}>
                  <Button
                    label="💬 Chat with Customer"
                    accessibilityLabel="Open Chat"
                    variant="secondary"
                    onPress={() => setChatVisible(true)}
                  />
                </View>
              ) : null}

              <View style={{ flex: 1 }}>
                <Button
                  label="🧾 Invoice Preview"
                  accessibilityLabel="Preview and Download Invoice"
                  variant="secondary"
                  onPress={handleInvoiceClick}
                  style={{
                    borderColor: BRAND_PRIMARY,
                    borderWidth: 1.5,
                    backgroundColor: '#F0FDF4',
                  }}
                />
              </View>
            </View>

            <Modal
              visible={chatVisible}
              onRequestClose={() => setChatVisible(false)}
              title="Live Chat with Customer"
              accessibilityLabel="Live Chat dialog"
            >
              <View style={{ height: 400 }}>
                <OrderChat orderId={order.orderId} senderRole="RESTAURANT" />
              </View>
            </Modal>

            {/* KITCHEN ORDER ACTIONS CARD */}
            {actions.length > 0 ? (
              <Card style={{ padding: tokens.spacing.md, gap: tokens.spacing.sm, borderRadius: 14 }}>
                <Text variant="label" style={{ color: BRAND_PRIMARY, fontSize: 16 }}>
                  Kitchen Order Actions
                </Text>
                <View style={{ gap: tokens.spacing.sm }}>
                  {actions.map((action) => (
                    <SwipeButton
                      key={action}
                      title={
                        action === 'ACCEPTED'
                          ? 'Accept Order'
                          : action === 'REJECTED'
                            ? 'Reject Order'
                            : action === 'PREPARING'
                              ? 'Start Preparation 🍳'
                              : action === 'READY_FOR_PICKUP'
                                ? 'Mark Ready 📦'
                                : 'Hand Over (Collected) 🛍️'
                      }
                      backgroundColor={action === 'REJECTED' ? '#DC2626' : BRAND_PRIMARY}
                      onSwipeSuccess={() => {
                        if (action === 'REJECTED') {
                          setShowRejectModal(true);
                          return;
                        }
                        if (action === 'ACCEPTED') {
                          setShowAcceptModal(true);
                          return;
                        }
                        void onTransition(action);
                      }}
                    />
                  ))}
                </View>
              </Card>
            ) : null}
          </>
        )}
      </ScrollView>

      {/* REJECT MODAL */}
      <RejectOrderModal
        visible={showRejectModal}
        orderNumber={order?.orderNumber}
        loading={false}
        onConfirm={(reason) => {
          void onTransition('REJECTED', reason);
        }}
        onCancel={() => setShowRejectModal(false)}
      />

      {/* ACCEPT MODAL */}
      <AcceptOrderModal
        visible={showAcceptModal}
        orderId={order?.orderId}
        orderNumber={order?.orderNumber}
        loading={false}
        onConfirm={(prepTime) => {
          void onTransition('ACCEPTED', undefined, prepTime);
        }}
        onCancel={() => setShowAcceptModal(false)}
      />

      {/* INVOICE PREVIEW MODAL */}
      <InvoicePreviewModal
        visible={showInvoice}
        onClose={() => setShowInvoice(false)}
        order={order || localOrder}
        restaurantProfile={restaurantProfile}
      />


      <Toast
        visible={Boolean(toast)}
        message={toast?.message ?? ''}
        variant={toast?.variant ?? 'info'}
        accessibilityLabel={toast?.message ?? 'Toast'}
        onDismiss={() => setToast(null)}
      />
    </View>
  );
}
