import React from 'react';
import { Pressable, View } from 'react-native';
import { Button, Card, Text, useTheme } from 'foodie-shared-rn';
import { useGetOrderQuery } from '../../../api/endpoints/ordersApi';
import type { OrderSummary, RestaurantTransitionStatus } from '../types';
import { formatMoney, restaurantActionsForStatus } from '../types';
import { OrderStatusBadge } from './OrderStatusBadge';

type Props = {
  order: OrderSummary;
  onViewDetails: () => void;
  onTransitionStatus: (
    orderId: string,
    targetStatus: RestaurantTransitionStatus,
  ) => void;
  onOpenRejectModal: (orderId: string, orderNumber: string) => void;
  isTransitioning?: boolean;
};

const BRAND_PRIMARY = '#14532D'; // Dark Green
const BRAND_ACCENT = '#F59E0B';  // Gold

export function OrderCard({
  order,
  onViewDetails,
  onTransitionStatus,
  onOpenRejectModal,
  isTransitioning,
}: Props) {
  const { tokens } = useTheme();

  // Optionally fetch full OrderDetail for line items breakdown if available
  const orderDetailsQuery = useGetOrderQuery(order.orderId, {
    skip: !order.orderId,
  });

  const detail = orderDetailsQuery.data;
  const items = detail?.items ?? [];
  const status = order.status;
  const isPending = ['CONFIRMED', 'PENDING', 'PLACED'].includes(status);
  const actions = restaurantActionsForStatus(status);

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
        <View style={{ gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text
              variant="label"
              style={{ fontSize: 17, color: BRAND_PRIMARY, fontWeight: 'bold' }}
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

          <Text variant="caption" color={tokens.color.textSecondary}>
            Customer ID: {detail?.customerId ? `${detail.customerId.slice(0, 10)}…` : 'Verified Guest'}
          </Text>

          <Text variant="caption" color={tokens.color.textSecondary}>
            🕒 {order.placedAt ? new Date(order.placedAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'Recent'}
          </Text>
        </View>

        <OrderStatusBadge status={status} size="md" />
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
          <>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text variant="caption" color={tokens.color.textSecondary}>Items Total</Text>
              <Text variant="caption" color={tokens.color.textPrimary}>{formatMoney(detail.subtotal)}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text variant="caption" color={tokens.color.textSecondary}>Tax</Text>
              <Text variant="caption" color={tokens.color.textPrimary}>{formatMoney(detail.taxAmount)}</Text>
            </View>
          </>
        ) : null}

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
          <Text variant="label" style={{ color: BRAND_PRIMARY, fontSize: 14, fontWeight: 'bold' }}>
            Grand Total
          </Text>
          <Text variant="label" style={{ color: BRAND_PRIMARY, fontSize: 16, fontWeight: 'bold' }}>
            {formatMoney(order.totalAmount)}
          </Text>
        </View>
      </View>

      {/* ORDER ACTION BUTTONS */}
      <View
        style={{
          gap: tokens.spacing.sm,
          paddingTop: tokens.spacing.xs,
        }}
      >
        {['CONFIRMED', 'PLACED', 'PENDING'].includes(status) ? (
          <View style={{ flexDirection: 'row', gap: tokens.spacing.sm }}>
            <Button
              label="Reject"
              accessibilityLabel={`Reject order ${order.orderNumber}`}
              variant="danger"
              style={{ flex: 1, paddingHorizontal: 12, height: 44 }}
              onPress={() => onOpenRejectModal(order.orderId, order.orderNumber)}
            />
            <Button
              label="Accept Order"
              accessibilityLabel={`Accept order ${order.orderNumber}`}
              loading={isTransitioning}
              style={{ flex: 2, backgroundColor: BRAND_PRIMARY, paddingHorizontal: 16, height: 44 }}
              onPress={() => onTransitionStatus(order.orderId, 'ACCEPTED')}
            />
          </View>
        ) : ['ACCEPTED', 'PREPARING'].includes(status) ? (
          <View style={{ width: '100%', gap: tokens.spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#EFF6FF', paddingVertical: 8, borderRadius: 8, gap: 6 }}>
              <Text style={{ fontSize: 13 }}>🟢</Text>
              <Text style={{ color: '#2563EB', fontWeight: 'bold' }}>Cooking in progress...</Text>
            </View>
            <Button
              label="Mark Ready for Pickup"
              accessibilityLabel={`Mark food ready for pickup for order ${order.orderNumber}`}
              loading={isTransitioning}
              style={{ backgroundColor: '#16A34A', paddingHorizontal: 16, height: 46, borderRadius: 10, width: '100%' }}
              onPress={() => onTransitionStatus(order.orderId, 'READY_FOR_PICKUP')}
            />
          </View>
        ) : null}
      </View>
    </Card>
  );
}
