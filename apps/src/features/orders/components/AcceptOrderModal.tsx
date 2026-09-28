import React, { useEffect, useState } from 'react';
import { View, Pressable, ActivityIndicator } from 'react-native';
import { Button, Modal, Text, useTheme } from 'foodie-shared-rn';
import { useGetOrderQuery } from '../../../api/endpoints/ordersApi';
import { useGetMenuQuery } from '../../../api/endpoints/menuApi';
import { useAppSelector } from '../../../store/hooks';
import { selectRestaurantId } from '../../../features/onboarding/restaurantOnboardingSlice';

type Props = {
    visible: boolean;
    orderId?: string;
    orderNumber?: string;
    loading: boolean;
    onConfirm: (preparationTime: number) => void;
    onCancel: () => void;
};

export function AcceptOrderModal({
    visible,
    orderId,
    orderNumber,
    loading,
    onConfirm,
    onCancel,
}: Props) {
    const { tokens } = useTheme();
    const [prepTime, setPrepTime] = useState(20);
    const restaurantId = useAppSelector(selectRestaurantId);

    const { data: orderDetail } = useGetOrderQuery(orderId ?? '', {
        skip: !visible || !orderId,
    });

    const { data: menuData } = useGetMenuQuery(restaurantId ?? '', {
        skip: !visible || !restaurantId,
    });

    // Auto-calculate the default prep time from order items whenever orderDetail or menuData is available
    useEffect(() => {
        if (visible && orderDetail?.items && menuData?.categories) {
            let maxPrep = 20;

            for (const orderItem of orderDetail.items) {
                for (const cat of menuData.categories) {
                    const menuItem = cat.items.find(i => i.menuItemId === orderItem.menuItemId);
                    if (menuItem) {
                        const ptStr = (menuItem as any).preparationTime;
                        let val = 20;
                        if (typeof ptStr === 'string') {
                            val = parseInt(ptStr.replace(/\D/g, ''), 10) || 20;
                        } else if (typeof ptStr === 'number') {
                            val = ptStr;
                        }
                        if (val > maxPrep) {
                            maxPrep = val;
                        }
                    }
                }
            }
            setPrepTime(maxPrep);
        } else if (visible) {
            setPrepTime(20);
        }
    }, [visible, orderDetail, menuData]);

    const increase = () => setPrepTime((prev) => Math.min(prev + 5, 120));
    const decrease = () => setPrepTime((prev) => Math.max(prev - 5, 5));

    return (
        <Modal
            visible={visible}
            onRequestClose={onCancel}
            title="Accept Order"
            accessibilityLabel="Accept order double confirmation"
        >
            <View style={{ gap: tokens.spacing.md, paddingVertical: tokens.spacing.xs }}>
                <Text variant="body" color={tokens.color.textPrimary}>
                    Are you sure you want to accept order {orderNumber}?
                </Text>

                <View style={{ gap: tokens.spacing.sm, alignItems: 'center' }}>
                    <Text variant="label" style={{ color: tokens.color.textPrimary, fontWeight: 'bold' }}>
                        Preparation Time (Minutes)
                    </Text>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>
                        <Pressable
                            onPress={decrease}
                            style={({ pressed }) => [{
                                width: 44, height: 44, borderRadius: 22, backgroundColor: '#E2E8F0',
                                alignItems: 'center', justifyContent: 'center'
                            }, pressed && { opacity: 0.7 }]}
                        >
                            <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#334155' }}>-</Text>
                        </Pressable>

                        <Text style={{ fontSize: 32, fontWeight: '900', color: '#14532D', minWidth: 60, textAlign: 'center' }}>
                            {prepTime}
                        </Text>

                        <Pressable
                            onPress={increase}
                            style={({ pressed }) => [{
                                width: 44, height: 44, borderRadius: 22, backgroundColor: '#E2E8F0',
                                alignItems: 'center', justifyContent: 'center'
                            }, pressed && { opacity: 0.7 }]}
                        >
                            <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#334155' }}>+</Text>
                        </Pressable>
                    </View>

                    <Text variant="caption" color={tokens.color.textSecondary} style={{ textAlign: 'center' }}>
                        This time will be used to show live estimation tracking to the customer.
                    </Text>
                </View>

                <View style={{ gap: tokens.spacing.xs, marginTop: tokens.spacing.md }}>
                    <Button
                        label={loading ? 'Accepting...' : 'Confirm Acceptance'}
                        accessibilityLabel="Click to confirm the acceptance of the order"
                        variant="primary"
                        onPress={() => onConfirm(prepTime)}
                        disabled={loading}
                        style={{ height: 48 }}
                    />
                    <Button
                        label="Cancel"
                        accessibilityLabel="Cancel acceptance"
                        variant="secondary"
                        onPress={onCancel}
                        disabled={loading}
                        style={{ height: 48 }}
                    />
                </View>
            </View>
        </Modal>
    );
}
