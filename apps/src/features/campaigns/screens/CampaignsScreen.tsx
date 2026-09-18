import React, { useState } from 'react';
import { View, ScrollView, TextInput, TouchableOpacity, Alert } from 'react-native';
import { Text } from 'foodie-shared-rn';

// Dummy API to simulate backend interaction
const createCampaign = async (payload: any) => {
    return new Promise((resolve) => setTimeout(resolve, 1000));
};

export const CampaignsScreen = () => {
    const [couponCode, setCouponCode] = useState('');
    const [funderType, setFunderType] = useState('SHARED');
    const [discountType, setDiscountType] = useState('PERCENTAGE');
    const [restaurantSharePct, setRestaurantSharePct] = useState('50');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (!couponCode) {
            Alert.alert('Error', 'Please enter a coupon code.');
            return;
        }
        setIsSubmitting(true);
        try {
            const shareNum = parseFloat(restaurantSharePct) || 50;
            await createCampaign({
                code: couponCode,
                funderType: funderType,
                couponType: 'RESTAURANT_FIRST_ORDER',
                benefitMode: discountType,
                restaurantShare: shareNum,
                foodieShare: 100 - shareNum,
            });
            Alert.alert('Success', 'Campaign submitted for approval.');
            setCouponCode('');
        } catch {
            Alert.alert('Error', 'Failed to create campaign.');
        } finally {
            setIsSubmitting(false);
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
                <Text style={{ fontWeight: '600', marginBottom: 8, color: '#4b5563' }}>Funder Type</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                    {['RESTAURANT', 'SHARED'].map((type) => (
                        <TouchableOpacity
                            key={type}
                            onPress={() => setFunderType(type)}
                            style={{
                                flex: 1,
                                padding: 12,
                                borderRadius: 8,
                                backgroundColor: funderType === type ? '#fcd34d' : '#f3f4f6',
                                alignItems: 'center',
                            }}
                        >
                            <Text style={{ fontWeight: funderType === type ? '700' : '400' }}>{type}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {funderType === 'SHARED' && (
                <View style={{ marginBottom: 24, padding: 16, backgroundColor: '#f9fafb', borderRadius: 8 }}>
                    <Text style={{ fontWeight: '600', marginBottom: 12, color: '#4b5563' }}>
                        Funding Share: Restaurant {restaurantSharePct}% / Foodie {100 - (parseFloat(restaurantSharePct) || 0)}%
                    </Text>
                    <TextInput
                        style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, backgroundColor: '#FFFFFF' }}
                        keyboardType="numeric"
                        value={restaurantSharePct}
                        onChangeText={setRestaurantSharePct}
                        placeholder="Restaurant % Share (e.g. 50)"
                    />
                </View>
            )}

            <TouchableOpacity
                onPress={handleSubmit}
                disabled={isSubmitting}
                style={{
                    backgroundColor: '#16a34a',
                    padding: 16,
                    borderRadius: 8,
                    alignItems: 'center',
                    opacity: isSubmitting ? 0.7 : 1,
                }}
            >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
                    {isSubmitting ? 'Submitting...' : 'Create Campaign'}
                </Text>
            </TouchableOpacity>
        </ScrollView>
    );
};
