import React, { useEffect } from 'react';
import { View, Pressable, ScrollView } from 'react-native';
import { Button, Modal, Text, useTheme } from 'foodie-shared-rn';
import type { OrderSummary } from '../types';
import { formatMoney } from '../types';
import { useGetOrderQuery } from '../../../api/endpoints/ordersApi';

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

    // Fetch full details (customer name & items)
    const detailQuery = useGetOrderQuery(order?.orderId ?? '', {
        skip: !order?.orderId || !visible,
    });

    const detail = detailQuery.data;
    const items = detail?.items ?? order?.items ?? [];
    const customerName = detail?.customerName ?? order?.customerName ?? 'Verified Customer';

    // Continuous alert sound effect using Web Audio API (Pleasant 3-tone kitchen alert chime)
    useEffect(() => {
        if (!visible || !order) return;

        let stopSound: (() => void) | undefined;
        try {
            if (typeof window !== 'undefined') {
                const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
                if (AudioCtx) {
                    const ctx = new AudioCtx();
                    let isActive = true;

                    const playChime = () => {
                        if (!isActive) return;
                        try {
                            if (ctx.state === 'suspended') {
                                void ctx.resume();
                            }
                            const now = ctx.currentTime;
                            // 3-tone pleasant kitchen order chime: G5 -> C6 -> E6
                            const notes = [783.99, 1046.50, 1318.51];
                            notes.forEach((freq, idx) => {
                                const osc = ctx.createOscillator();
                                const gain = ctx.createGain();
                                osc.type = 'sine';
                                osc.frequency.setValueAtTime(freq, now + idx * 0.12);
                                gain.gain.setValueAtTime(0.3, now + idx * 0.12);
                                gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.35);
                                osc.connect(gain);
                                gain.connect(ctx.destination);
                                osc.start(now + idx * 0.12);
                                osc.stop(now + idx * 0.12 + 0.35);
                            });
                        } catch (e) { }
                    };

                    playChime();
                    const intervalId = setInterval(playChime, 1500);

                    stopSound = () => {
                        isActive = false;
                        clearInterval(intervalId);
                        try { ctx.close(); } catch (e) { }
                    };
                }
            }
        } catch (e) { }

        return () => {
            if (stopSound) stopSound();
        };
    }, [visible, order?.orderId]);

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
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View>
                            <Text variant="caption" color={tokens.color.textSecondary}>Order Number</Text>
                            <Text variant="heading2" style={{ color: BRAND_PRIMARY, fontWeight: 'bold' }}>
                                {order.orderNumber}
                            </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                            <Text variant="caption" color={tokens.color.textSecondary}>Customer Name</Text>
                            <Text variant="label" style={{ color: tokens.color.textPrimary, fontWeight: 'bold', fontSize: 15 }}>
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
                            items.map((item, idx) => (
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
                <View style={{ flexDirection: 'row', gap: tokens.spacing.sm, marginTop: tokens.spacing.xs }}>
                    <Button
                        label="❌ Reject"
                        accessibilityLabel="Reject incoming order"
                        variant="danger"
                        style={{ flex: 1, height: 48, borderRadius: 12 }}
                        onPress={() => onReject(order.orderId)}
                    />
                    <Button
                        label="✅ ACCEPT ORDER"
                        accessibilityLabel="Accept incoming order"
                        style={{ flex: 2, height: 48, backgroundColor: BRAND_PRIMARY, borderRadius: 12 }}
                        onPress={() => onAccept(order.orderId)}
                    />
                </View>
            </View>
        </Modal>
    );
}
