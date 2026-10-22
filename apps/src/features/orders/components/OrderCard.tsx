import React from 'react';
import { Platform, Pressable, View } from 'react-native';
import { Button, Card, Text, useTheme } from 'foodie-shared-rn';
import { normalizeOrderItem, useGetOrderQuery } from '../../../api/endpoints/ordersApi';
import { useGetRestaurantProfileQuery } from '../../../api/endpoints/restaurantsApi';
import type { OrderSummary, RestaurantTransitionStatus } from '../types';
import { formatMoney, restaurantActionsForStatus } from '../types';
import { OrderStatusBadge } from './OrderStatusBadge';
import { SwipeButton } from '../../../components/SwipeButton';
import { Modal } from 'foodie-shared-rn';
import { OrderChat } from './OrderChat';
import { isTerminalOrderStatus } from '../types';
import { InvoicePreviewModal } from './InvoicePreviewModal';
import { extractPaymentDetails } from '../utils/invoiceGenerator';

type Props = {
  order: OrderSummary;
  onViewDetails: () => void;
  onTransitionStatus: (
    orderId: string,
    targetStatus: RestaurantTransitionStatus,
  ) => void;
  onOpenRejectModal: (orderId: string, orderNumber: string) => void;
  isTransitioning?: boolean;
  onInvoice?: (order: OrderSummary) => void | Promise<void>;
  loadingInvoice?: boolean;
};

const BRAND_PRIMARY = '#14532D'; // Dark Green
const BRAND_ACCENT = '#F59E0B';  // Gold

export function OrderCard({
  order,
  onViewDetails,
  onTransitionStatus,
  onOpenRejectModal,
  isTransitioning,
  onInvoice,
  loadingInvoice = false,
}: Props) {
  const { tokens } = useTheme();
  const [chatVisible, setChatVisible] = React.useState(false);
  const [locallyMarkedReady, setLocallyMarkedReady] = React.useState(false);
  const [showInvoice, setShowInvoice] = React.useState(false);
  const [localSelectedOrder, setLocalSelectedOrder] = React.useState<any>(null);

  const { data: restaurantProfile } = useGetRestaurantProfileQuery();

  const handleInvoiceClick = (e?: any) => {
    if (e && typeof e.stopPropagation === 'function') {
      e.stopPropagation();
    }
    console.log('Invoice button clicked -> Opening Preview immediately', order);
    const rawDetail = (detail as any)?.data ?? detail;
    const normalizedDetail = rawDetail ? normalizeOrderItem(rawDetail) : null;
    const normalizedOrder = normalizeOrderItem(order);

    const fullOrder: any = normalizedDetail
      ? {
          ...normalizedOrder,
          ...normalizedDetail,
          orderId: normalizedDetail.orderId || normalizedOrder.orderId,
          orderNumber: normalizedDetail.orderNumber || normalizedOrder.orderNumber,
          customerName: normalizedDetail.customerName || normalizedOrder.customerName,
          customerPhone: normalizedDetail.customerPhone || normalizedOrder.customerPhone,
          deliveryAddress: normalizedDetail.deliveryAddress || normalizedOrder.deliveryAddress,
          paymentMethod: normalizedDetail.paymentMethod || normalizedOrder.paymentMethod,
          paymentMode: (normalizedDetail as any).paymentMode || (normalizedOrder as any).paymentMode,
          isCOD: isCOD || Boolean((normalizedDetail as any)?.isCOD || (normalizedOrder as any)?.isCOD),
          isCod: isCOD || Boolean((normalizedDetail as any)?.isCod || (normalizedOrder as any)?.isCod),
          paymentStatus: isCOD ? 'PENDING' : (normalizedDetail.paymentStatus || normalizedOrder.paymentStatus || 'PAID'),
          transactionId: isCOD ? undefined : (normalizedDetail.transactionId || normalizedOrder.transactionId),
          items: (normalizedDetail.items && normalizedDetail.items.length > 0) ? normalizedDetail.items : normalizedOrder.items,
        }
      : normalizedOrder;

    if (onInvoice) {
      onInvoice(fullOrder);
      return;
    }
    setLocalSelectedOrder(fullOrder);
    setShowInvoice(true);
  };

  // Optionally fetch full OrderDetail for line items breakdown if available
  const orderDetailsQuery = useGetOrderQuery(order.orderId, {
    skip: !order.orderId,
  });

  const detail = orderDetailsQuery.data;
  const items = detail?.items ?? order.items ?? [];
  const status = order.status;
  const isPending = ['CONFIRMED', 'PENDING', 'PLACED'].includes(status);
  const hasBeenMarkedReady = detail?.orderStatusEvents?.some((e: any) => e.toStatus === 'READY_FOR_PICKUP') ?? false;
  const actions = restaurantActionsForStatus(status);
  const paymentDetails = extractPaymentDetails(order, detail);
  const isCOD = paymentDetails.isCOD;

  return (
    <Card
      style={{
        padding: tokens.spacing.md,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: isPending ? BRAND_ACCENT : tokens.color.border,
        borderLeftWidth: 5,
        borderLeftColor: isPending
          ? BRAND_ACCENT
          : status === 'PREPARING'
            ? '#2563EB'
            : ['READY_FOR_PICKUP', 'DELIVERED', 'COMPLETED'].includes(status)
              ? '#16A34A'
              : '#94A3B8',
        backgroundColor: tokens.color.surface,
        gap: tokens.spacing.sm,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
        elevation: 2,
      }}
    >
      {/* CARD TOP HEADER ROW */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          borderBottomWidth: 1,
          borderBottomColor: tokens.color.border,
          paddingBottom: tokens.spacing.xs,
        }}
      >
        <View style={{ flex: 1, gap: 2, marginRight: tokens.spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Text
              variant="label"
              style={{ fontSize: 16, color: BRAND_PRIMARY, fontWeight: 'bold' }}
              numberOfLines={1}
            >
              {order.orderNumber}
            </Text>
            {isPending ? (
              <View
                style={{
                  backgroundColor: '#FEF3C7',
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 6,
                }}
              >
                <Text
                  variant="caption"
                  style={{ color: '#B45309', fontWeight: 'bold', fontSize: 10 }}
                >
                  NEEDS ACTION
                </Text>
              </View>
            ) : null}
          </View>

          <Text
            variant="caption"
            color={tokens.color.textSecondary}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            👤 Customer: {detail?.customerName || order.customerName || 'Customer'}
            {(detail?.customerPhone || order.customerPhone) ? ` • 📞 ${detail?.customerPhone || order.customerPhone}` : ''}
          </Text>

          <Text variant="caption" color={tokens.color.textSecondary} numberOfLines={1}>
            🕒 {order.placedAt ? new Date(order.placedAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'Recent'}
          </Text>
        </View>

        <View style={{ alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
          <OrderStatusBadge status={status} size="md" />
          <View
            style={{
              backgroundColor: isCOD ? '#FEF3C7' : '#DCFCE7',
              borderColor: isCOD ? '#F59E0B' : '#16A34A',
              borderWidth: 1,
              paddingHorizontal: 6,
              paddingVertical: 2,
              borderRadius: 4,
            }}
          >
            <Text
              variant="caption"
              style={{
                color: isCOD ? '#B45309' : '#166534',
                fontWeight: 'bold',
                fontSize: 10,
              }}
            >
              {isCOD ? '💵 COD' : `💳 ${paymentDetails.paymentMethodText}`}
            </Text>
          </View>
        </View>
      </View>

      {/* ORDER ITEMS SUMMARY */}
      <View style={{ gap: 4, paddingVertical: 2 }}>
        {items.length > 0 ? (
          items.map((item, idx) => (
            <View
              key={`${item.menuItemId ?? idx}-${idx}`}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Text variant="body" style={{ color: tokens.color.textPrimary, fontSize: 14 }}>
                <Text style={{ fontWeight: 'bold', color: BRAND_PRIMARY }}>
                  {item.quantity}×{' '}
                </Text>
                {item.name ?? 'Food Item'}
              </Text>

              {item.lineTotal != null ? (
                <Text variant="caption" style={{ color: tokens.color.textSecondary, fontWeight: '600' }}>
                  {formatMoney(item.lineTotal)}
                </Text>
              ) : null}
            </View>
          ))
        ) : (
          <Text variant="caption" color={tokens.color.textSecondary}>
            Tap 'View Details' for itemized order breakdown.
          </Text>
        )}
      </View>

      {/* FINANCIAL BREAKDOWN */}
      <View
        style={{
          backgroundColor: '#F8FAFC',
          padding: tokens.spacing.xs,
          paddingHorizontal: tokens.spacing.sm,
          borderRadius: 8,
          gap: 2,
        }}
      >
        {detail ? (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text variant="caption" color={tokens.color.textSecondary}>Food Charge</Text>
            <Text variant="caption" color={tokens.color.textPrimary}>{formatMoney(detail.subtotal)}</Text>
          </View>
        ) : null}

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
          <Text variant="label" style={{ color: BRAND_PRIMARY, fontSize: 14, fontWeight: 'bold' }}>
            Total
          </Text>
          <Text variant="label" style={{ color: BRAND_PRIMARY, fontSize: 16, fontWeight: 'bold' }}>
            {detail ? formatMoney(detail.subtotal) : formatMoney(order.totalAmount)}
          </Text>
        </View>
      </View>

      {/* ACTION BUTTONS: CHAT & INVOICE */}
      <View
        style={{
          flexDirection: 'row',
          gap: tokens.spacing.sm,
          paddingTop: tokens.spacing.xs,
        }}
      >
        {status && !isTerminalOrderStatus(status) ? (
          <Button
            label="💬 Chat"
            accessibilityLabel="Open Chat"
            variant="secondary"
            onPress={() => setChatVisible(true)}
            style={{ flex: 1, borderRadius: 10, height: 42 }}
          />
        ) : null}

        <Button
          label="🧾 Invoice"
          accessibilityLabel={`Preview Invoice for order ${order.orderNumber}`}
          variant="secondary"
          onPress={handleInvoiceClick}
          style={{
            flex: 1,
            borderRadius: 10,
            height: 42,
            borderColor: BRAND_PRIMARY,
            borderWidth: 1.5,
            backgroundColor: '#F0FDF4',
          }}
        />
      </View>

      <InvoicePreviewModal
        visible={showInvoice}
        onClose={() => setShowInvoice(false)}
        order={localSelectedOrder || (detail ? { ...order, ...detail } : order)}
        restaurantProfile={restaurantProfile}
      />

      <Modal
        visible={chatVisible}
        onRequestClose={() => setChatVisible(false)}
        title={`Chat (Order ${order.orderNumber})`}
        accessibilityLabel="Live Chat dialog"
      >
        <View style={{ height: 400 }}>
          <OrderChat orderId={order.orderId} senderRole="RESTAURANT" />
        </View>
      </Modal>

      {/* ORDER ACTION BUTTONS */}
      <View
        style={{
          gap: tokens.spacing.sm,
          paddingTop: tokens.spacing.xs,
        }}
      >
        {['CONFIRMED', 'PLACED', 'PENDING'].includes(status) ? (
          <View style={{ flexDirection: 'column', gap: tokens.spacing.sm }}>
            <SwipeButton
              title="Accept Order"
              backgroundColor={BRAND_PRIMARY}
              onSwipeSuccess={() => onTransitionStatus(order.orderId, 'ACCEPTED')}
            />
            <SwipeButton
              title="Reject Order"
              backgroundColor="#DC2626"
              onSwipeSuccess={() => onOpenRejectModal(order.orderId, order.orderNumber)}
            />
          </View>
        ) : ['ACCEPTED', 'PREPARING'].includes(status) || (['ASSIGNED', 'WAITING_FOR_DELIVERY_PARTNER'].includes(status) && !hasBeenMarkedReady && !locallyMarkedReady && status !== 'READY_FOR_PICKUP') ? (
          <View style={{ width: '100%', gap: tokens.spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#EFF6FF', paddingVertical: 8, borderRadius: 8, gap: 6 }}>
              <Text style={{ fontSize: 13 }}>🟢</Text>
              <Text style={{ color: '#2563EB', fontWeight: 'bold' }}>Cooking in progress...</Text>
            </View>
            <SwipeButton
              title="Ready for Pickup"
              backgroundColor="#16A34A"
              onSwipeSuccess={() => {
                setLocallyMarkedReady(true);
                onTransitionStatus(order.orderId, 'READY_FOR_PICKUP');
              }}
            />
          </View>
        ) : status === 'READY_FOR_PICKUP' || locallyMarkedReady || (['ASSIGNED', 'WAITING_FOR_DELIVERY_PARTNER'].includes(status) && hasBeenMarkedReady) ? (
          <View style={{ width: '100%', gap: tokens.spacing.sm }}>
            <SwipeButton
              title="Hand Over (Collected)"
              backgroundColor={BRAND_PRIMARY}
              onSwipeSuccess={() => onTransitionStatus(order.orderId, 'PICKED_UP')}
            />
          </View>
        ) : null}
      </View>
    </Card>
  );
}
