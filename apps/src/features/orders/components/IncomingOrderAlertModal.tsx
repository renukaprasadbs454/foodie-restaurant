import React, { useEffect, useRef } from 'react';
import { View, Pressable, ScrollView, Vibration } from 'react-native';
import { Button, Modal, Text, useTheme } from 'foodie-shared-rn';
import type { OrderSummary } from '../types';
import { formatMoney } from '../types';
import { useGetOrderQuery } from '../../../api/endpoints/ordersApi';
import { SwipeButton } from '../../../components/SwipeButton';

type Props = {
    order: OrderSummary | null;
    visible: boolean;
    onAccept: (orderId: string) => void;
    onReject: (orderId: string) => void;
};

const BRAND_PRIMARY = '#14532D';

export function IncomingOrderAlertModal({
    order,
    visible,
    onAccept,
    onReject,
}: Props) {
    const { tokens } = useTheme();
    const stopAlertRef = useRef<() => void>(() => {});

    // Fetch full details (customer name & items)
    const detailQuery = useGetOrderQuery(order?.orderId ?? '', {
        skip: !order?.orderId || !visible,
    });

    const detail = detailQuery.data;
    const items: any[] = (detail as any)?.items ?? (order as any)?.items ?? [];
    const customerName = (detail as any)?.customerName ?? (order as any)?.customerName ?? 'Verified Customer';

    // Continuous alert sound and vibration effect using Web Audio API + Vibration
    useEffect(() => {
        if (!visible || !order) {
            stopAlertRef.current();
            return;
        }

        let intervalId: any = null;
        let ctx: any = null;
        let isActive = true;

        const stopAlert = () => {
            isActive = false;
            if (intervalId) {
                clearInterval(intervalId);
                intervalId = null;
            }
            try {
                if (ctx && ctx.state !== 'closed') {
                    void ctx.close();
                }
            } catch (e) {}
            try {
                Vibration.cancel();
            } catch (e) {}
            if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
                try {
                    navigator.vibrate(0);
                } catch (e) {}
            }
        };

        stopAlertRef.current = stopAlert;

        try {
            if (typeof window !== 'undefined') {
                const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
                if (AudioCtx) {
                    ctx = new AudioCtx();

                    const playChime = () => {
                        if (!isActive) return;
                        try {
                            if (ctx.state === 'suspended') {
                                void ctx.resume();
                            }
                            const now = ctx.currentTime;
                            // Swiggy 6-note signature chime motif: G5 -> B5 -> D6 -> G6 -> D6 -> G6
                            const notes = [
                                { freq: 783.99, delay: 0.0, dur: 0.12 },
                                { freq: 987.77, delay: 0.12, dur: 0.12 },
                                { freq: 1174.66, delay: 0.24, dur: 0.12 },
                                { freq: 1567.98, delay: 0.36, dur: 0.22 },
                                { freq: 1174.66, delay: 0.60, dur: 0.12 },
                                { freq: 1567.98, delay: 0.72, dur: 0.35 },
                            ];
                            notes.forEach(({ freq, delay, dur }) => {
                                const osc = ctx.createOscillator();
                                const gain = ctx.createGain();
                                osc.type = 'triangle';
                                osc.frequency.setValueAtTime(freq, now + delay);
                                gain.gain.setValueAtTime(0.001, now + delay);
                                gain.gain.linearRampToValueAtTime(0.7, now + delay + 0.02);
                                gain.gain.exponentialRampToValueAtTime(0.001, now + delay + dur);
                                osc.connect(gain);
                                gain.connect(ctx.destination);
                                osc.start(now + delay);
                                osc.stop(now + delay + dur);
                            });
                        } catch (e) {}

                        // Accompany with physical vibration pulse
                        try {
                            Vibration.vibrate([0, 400, 200, 400], false);
                        } catch (e) {}
                        if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
                            try {
                                navigator.vibrate([400, 200, 400]);
                            } catch (e) {}
                        }
                    };

                    playChime();
                    intervalId = setInterval(playChime, 1800);
                }
            }
        } catch (e) {}

        return () => {
            stopAlert();
        };
    }, [visible, order?.orderId]);

    const handleAcceptOrder = (orderId: string) => {
        stopAlertRef.current();
        onAccept(orderId);
    };

    const handleRejectOrder = (orderId: string) => {
        stopAlertRef.current();
        onReject(orderId);
    };

    if (!visible || !order) return null;

    return (
        <Modal
            visible={visible}
            onRequestClose={() => { }} // Persistent: cannot be dismissed by background click
            title="🔔 NEW INCOMING ORDER!"
            accessibilityLabel="Incoming Order Alert Modal"
        >
            <View style={{ gap: tokens.spacing.md, paddingVertical: tokens.spacing.xs }}>
                {/* FLASHING ALERT HEADER */}
                <View
                    style={{
                        backgroundColor: '#FEF3C7',
                        borderColor: '#F59E0B',
                        borderWidth: 2,
                        borderRadius: 12,
                        padding: tokens.spacing.sm,
                        alignItems: 'center',
                    }}
                >
                    <Text style={{ fontSize: 24, marginBottom: 4 }}>🚨</Text>
                    <Text
                        variant="heading2"
                        style={{ color: '#92400E', fontWeight: '900', textAlign: 'center', fontSize: 18 }}
                    >
                        ACTION REQUIRED: NEW ORDER PLACED
                    </Text>
                    <Text
                        variant="caption"
                        style={{ color: '#B45309', textAlign: 'center', marginTop: 2, fontWeight: '600' }}
                    >
                        Review food details & accept order to begin preparation.
                    </Text>
                </View>

                {/* ORDER SUMMARY CARD */}
                <View
                    style={{
                        backgroundColor: '#F8FAFC',
                        borderRadius: 14,
                        padding: tokens.spacing.md,
                        borderWidth: 1,
                        borderColor: tokens.color.border,
                        gap: tokens.spacing.sm,
                    }}
                >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <View style={{ flex: 1, paddingRight: 12 }}>
                            <Text variant="caption" color={tokens.color.textSecondary}>Order Number</Text>
                            <Text variant="heading2" style={{ color: BRAND_PRIMARY, fontWeight: 'bold' }}>
                                {order.orderNumber}
                            </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end', flexShrink: 0, maxWidth: '45%' }}>
                            <Text variant="caption" color={tokens.color.textSecondary}>Customer Name</Text>
                            <Text variant="label" numberOfLines={1} ellipsizeMode="tail" style={{ color: tokens.color.textPrimary, fontWeight: 'bold', fontSize: 15 }}>
                                👤 {customerName}
                            </Text>
                        </View>
                    </View>

                    {/* ITEMS ORDERED BREAKDOWN */}
                    <View style={{ borderTopWidth: 1, borderTopColor: tokens.color.border, paddingTop: tokens.spacing.xs, gap: 4 }}>
                        <Text variant="caption" style={{ color: BRAND_PRIMARY, fontWeight: 'bold', fontSize: 13 }}>
                            🍽️ Food Items Ordered ({items.length}):
                        </Text>
                        {items.length > 0 ? (
                            items.map((item: any, idx: number) => (
                                <View
                                    key={`${item.menuItemId ?? idx}-${idx}`}
                                    style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                                >
                                    <Text variant="body" style={{ color: tokens.color.textPrimary, fontWeight: '700' }}>
                                        <Text style={{ color: BRAND_PRIMARY, fontWeight: '900' }}>{item.quantity}× </Text>
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
                                1x Food Order Combo
                            </Text>
                        )}
                    </View>

                    {/* PRICE TOTAL */}
                    <View
                        style={{
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            borderTopWidth: 1,
                            borderTopColor: tokens.color.border,
                            paddingTop: tokens.spacing.xs,
                            marginTop: 4,
                        }}
                    >
                        <Text variant="label" style={{ color: BRAND_PRIMARY, fontWeight: 'bold', fontSize: 16 }}>
                            Total Food Price
                        </Text>
                        <Text variant="heading2" style={{ color: BRAND_PRIMARY, fontWeight: '900', fontSize: 22 }}>
                            {formatMoney(order.totalAmount)}
                        </Text>
                    </View>
                </View>

                {/* ACTION BUTTONS (ACCEPT / REJECT) */}
                <View style={{ flexDirection: 'column', gap: tokens.spacing.sm, marginTop: tokens.spacing.xs }}>
                    <SwipeButton
                        title="Accept Order"
                        backgroundColor={BRAND_PRIMARY}
                        onSwipeSuccess={() => handleAcceptOrder(order.orderId)}
                    />
                    <SwipeButton
                        title="Reject Order"
                        backgroundColor="#DC2626"
                        onSwipeSuccess={() => handleRejectOrder(order.orderId)}
                    />
                </View>
            </View>
        </Modal>
    );
}
