import React, { useState } from 'react';
import { View, ScrollView, TextInput, TouchableOpacity, Alert } from 'react-native';
import { Text } from 'foodie-shared-rn';
import { useCreateCouponMutation } from '../../../api/endpoints/couponsApi';

export const CampaignsScreen = () => {
    const [createCoupon, { isLoading }] = useCreateCouponMutation();

    const [couponCode, setCouponCode] = useState('');
    const [discountType, setDiscountType] = useState('PERCENT'); // PERCENT or FLAT
    const [discountValue, setDiscountValue] = useState('');
    const [minOrder, setMinOrder] = useState('0');
    const [maxDiscount, setMaxDiscount] = useState('');

    const handleSubmit = async () => {
        if (!couponCode) {
            Alert.alert('Error', 'Please enter a coupon code.');
            return;
        }
        if (!discountValue || Number(discountValue) <= 0) {
            Alert.alert('Error', 'Please enter a valid discount value.');
            return;
        }

        try {
            await createCoupon({
                code: couponCode.trim().toUpperCase().replace(/[^A-Z0-9_]/g, ''),
                discountType: discountType as 'FLAT' | 'PERCENT',
                value: parseFloat(discountValue),
                minOrderAmount: parseFloat(minOrder) || 0,
                maxDiscountAmount: maxDiscount ? parseFloat(maxDiscount) : undefined,
                expiryDate: '2099-12-31', // Placeholder or use Date Picker
                usageLimitPerUser: 1,
            }).unwrap();

            Alert.alert('Success', 'Campaign submitted for approval.');
            setCouponCode('');
            setDiscountValue('');
            setMinOrder('0');
            setMaxDiscount('');
        } catch {
            Alert.alert('Error', 'Failed to create campaign. Please try again.');
        }
    };

    return (
        <ScrollView style={{ flex: 1, backgroundColor: '#FFFFFF' }} contentContainerStyle={{ padding: 16 }}>
            <Text style={{ fontSize: 24, fontWeight: '700', marginBottom: 16 }}>Restaurant Campaigns</Text>

            <View style={{ marginBottom: 24 }}>
                <Text style={{ fontWeight: '600', marginBottom: 8, color: '#4b5563' }}>Coupon Code</Text>
                <TextInput
                    value={couponCode}
                    onChangeText={setCouponCode}
                    placeholder="e.g. WELCOME10"
                    style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12 }}
                />
            </View>

            <View style={{ marginBottom: 24 }}>
                <Text style={{ fontWeight: '600', marginBottom: 8, color: '#4b5563' }}>Discount Type</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                    {['PERCENT', 'FLAT'].map((type) => (
                        <TouchableOpacity
                            key={type}
                            onPress={() => setDiscountType(type)}
                            style={{
                                flex: 1,
                                padding: 12,
                                borderRadius: 8,
                                backgroundColor: discountType === type ? '#fcd34d' : '#f3f4f6',
                                alignItems: 'center',
                            }}
                        >
                            <Text style={{ fontWeight: discountType === type ? '700' : '400' }}>
                                {type === 'PERCENT' ? 'Percentage (%)' : 'Fixed Amount (₹)'}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            <View style={{ marginBottom: 24 }}>
                <Text style={{ fontWeight: '600', marginBottom: 8, color: '#4b5563' }}>
                    {discountType === 'PERCENT' ? 'Discount Percentage (%)' : 'Discount Amount (₹)'}
                </Text>
                <TextInput
                    style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, backgroundColor: '#FFFFFF' }}
                    keyboardType="numeric"
                    value={discountValue}
                    onChangeText={setDiscountValue}
                    placeholder={`e.g. ${discountType === 'PERCENT' ? '20' : '150'}`}
                />
            </View>

            {discountType === 'PERCENT' && (
                <View style={{ marginBottom: 24 }}>
                    <Text style={{ fontWeight: '600', marginBottom: 8, color: '#4b5563' }}>Max Discount Amount (₹)</Text>
                    <TextInput
                        style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, backgroundColor: '#FFFFFF' }}
                        keyboardType="numeric"
                        value={maxDiscount}
                        onChangeText={setMaxDiscount}
                        placeholder="e.g. 100"
                    />
                </View>
            )}

            <View style={{ marginBottom: 24 }}>
                <Text style={{ fontWeight: '600', marginBottom: 8, color: '#4b5563' }}>Minimum Order Amount (₹)</Text>
                <TextInput
                    style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, backgroundColor: '#FFFFFF' }}
                    keyboardType="numeric"
                    value={minOrder}
                    onChangeText={setMinOrder}
                    placeholder="e.g. 500"
                />
            </View>

            <TouchableOpacity
                onPress={handleSubmit}
                disabled={isLoading}
                style={{
                    backgroundColor: '#16a34a',
                    padding: 16,
                    borderRadius: 8,
                    alignItems: 'center',
                    opacity: isLoading ? 0.7 : 1,
                }}
            >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
                    {isLoading ? 'Submitting...' : 'Submit Request'}
                </Text>
            </TouchableOpacity>
        </ScrollView>
    );
};
