import React from 'react';
import {
    RefreshControl,
    SafeAreaView,
    ScrollView,
    View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
    Badge,
    Button,
    Card,
    EmptyState,
    LoadingSpinner,
    Text,
    trackAnalyticsEvent,
    useConnectivity,
    useTheme,
} from 'foodie-shared-rn';
import {
    useGetRestaurantSettlementsQuery,
    useGetRestaurantEarningsQuery,
    type RestaurantSettlement,
} from '../../../api/endpoints/settlementsApi';
import { useGetDashboardSummaryQuery } from '../../../api/endpoints/restaurantsApi';
import type { ProfileStackParamList } from '../../../navigation/types';
import { MOCK_CONFIG } from '../../../config/mockConfig';
import { RequestPayoutModal } from '../components/RequestPayoutModal';

type Props = NativeStackScreenProps<ProfileStackParamList, 'SettlementHistory'>;

const BRAND_PRIMARY = '#14532D';
const BRAND_ACCENT = '#F59E0B';

// Component uses live data exclusively

const PayoutProgressBar = ({ status }: { status?: string }) => {
    let step = 0;
    if (status === 'PROCESSING') step = 1;
    if (status === 'COMPLETED') step = 2;
    if (status === 'FAILED') step = -1;

    const steps = [
        { label: 'Requested', isActive: step >= 0, isError: false },
        { label: 'Approved', isActive: step >= 1, isError: false },
        { label: 'Bank Credit', isActive: step >= 2, isError: step === -1 },
    ];

    if (step === -1) {
        steps[2].label = 'Failed';
        steps[2].isActive = true;
    }

    return (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, marginBottom: 4, paddingHorizontal: 4 }}>
            {steps.map((s, idx) => (
                <React.Fragment key={idx}>
                    <View style={{ alignItems: 'center', flex: 1, zIndex: 1 }}>
                        <View style={{
                            width: 14, height: 14, borderRadius: 7,
                            backgroundColor: s.isError ? '#DC2626' : (s.isActive ? '#14532D' : '#E2E8F0'),
                            borderWidth: 2, borderColor: '#FFFFFF',
                        }} />
                        <Text variant="caption" style={{ fontSize: 10, marginTop: 4, color: s.isError ? '#DC2626' : (s.isActive ? '#14532D' : '#94A3B8'), textAlign: 'center', fontWeight: s.isActive ? 'bold' : 'normal' }}>
                            {s.label}
                        </Text>
                    </View>
                    {idx < steps.length - 1 && (
                        <View style={{ flex: 1.5, height: 2, backgroundColor: steps[idx + 1].isActive ? (steps[idx + 1].isError ? '#DC2626' : '#14532D') : '#E2E8F0', marginHorizontal: -12, zIndex: 0 }} />
                    )}
                </React.Fragment>
            ))}
        </View>
    );
};

export function SettlementHistoryScreen({ navigation }: Props) {
    const { tokens } = useTheme();
    const { isConnected } = useConnectivity();
    const [isPayoutModalOpen, setIsPayoutModalOpen] = React.useState(false);

    const settlementsQuery = useGetRestaurantSettlementsQuery(undefined, {
        refetchOnFocus: true,
    });

    const summaryQuery = useGetDashboardSummaryQuery(undefined, {
        refetchOnFocus: true,
    });

    const earningsQuery = useGetRestaurantEarningsQuery(undefined, {
        refetchOnFocus: true,
    });

    React.useEffect(() => {
        trackAnalyticsEvent('restaurant_settlement_history_viewed');
    }, []);

    const settlements = settlementsQuery.data ?? [];

    // Safely parse balance regardless of RTK Query envelope stripping.
    const pending = earningsQuery.data?.balance ?? earningsQuery.data?.data?.balance ?? 0;

    // Only COMPLETED payouts are truly disbursed to bank
    const disbursed = settlements
        .filter((s: RestaurantSettlement) => s.entryType === 'DEBIT' && s.status === 'COMPLETED')
        .reduce((sum: number, s: RestaurantSettlement) => sum + s.amount, 0);

    // Any requested or currently processing payouts
    const processingAmt = settlements
        .filter((s: RestaurantSettlement) => s.entryType === 'DEBIT' && (s.status === 'REQUESTED' || s.status === 'PROCESSING'))
        .reduce((sum: number, s: RestaurantSettlement) => sum + s.amount, 0);

    const earnings = {
        grossEarnings: summaryQuery.data?.grossSales || 0,
        netSettled: disbursed,
        processingAmount: processingAmt,
        pendingPayout: pending,
        totalOrders: summaryQuery.data?.totalOrders || 0,
        totalSettlements: settlements.length,
    };

    const getStatusBadge = (entryType: RestaurantSettlement['entryType'], status: RestaurantSettlement['status']) => {
        if (entryType === 'CREDIT') return <Badge label="EARNED" tone="success" accessibilityLabel="Credit Earned" />;
        if (entryType === 'DEBIT' && status === 'REQUESTED') return <Badge label="PROCESSING" tone="warning" accessibilityLabel="Processing status" />;
        return <Badge label="SETTLED" tone="neutral" accessibilityLabel="Settled status" />;
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: tokens.color.background }}>
            <ScrollView
                contentContainerStyle={{
                    padding: tokens.spacing.md,
                    gap: tokens.spacing.md,
                    paddingBottom: 60,
                }}
                refreshControl={
                    <RefreshControl
                        refreshing={settlementsQuery.isFetching || summaryQuery.isFetching || earningsQuery.isFetching}
                        onRefresh={() => {
                            void settlementsQuery.refetch();
                            void summaryQuery.refetch();
                            void earningsQuery.refetch();
                        }}
                    />
                }
            >
                {/* Screen Header */}
                <View style={{ gap: tokens.spacing.xs }}>
                    <Button
                        variant="secondary"
                        label="← Back to Settings"
                        onPress={() => navigation.goBack()}
                        accessibilityLabel="Back to Settings"
                        style={{ alignSelf: 'flex-start' }}
                    />
                    <Text variant="heading1" style={{ color: BRAND_PRIMARY }} accessibilityRole="header">
                        Payment & Settlements
                    </Text>
                    <Text variant="caption" color={tokens.color.textSecondary}>
                        Track payouts, revenue splits, commission deductions, and bank disbursements
                    </Text>
                </View>

                {/* Earnings Overview Card */}
                <Card style={{ backgroundColor: BRAND_PRIMARY, padding: tokens.spacing.lg, borderRadius: 16 }}>
                    <Text variant="label" style={{ color: '#E2E8F0', letterSpacing: 1 }}>
                        TOTAL REVENUE (LIFETIME)
                    </Text>
                    <Text variant="heading1" style={{ color: '#FFFFFF', fontSize: 32, marginVertical: 4 }}>
                        ₹{earnings.grossEarnings.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </Text>

                    <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginVertical: 12 }} />

                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <View style={{ flex: 1 }}>
                            <Text variant="caption" style={{ color: '#CBD5E1' }}>
                                Disbursed To Bank
                            </Text>
                            <Text variant="heading3" style={{ color: '#4ADE80' }}>
                                ₹{earnings.netSettled.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </Text>
                        </View>

                        <View style={{ flex: 1, alignItems: 'center' }}>
                            <Text variant="caption" style={{ color: '#CBD5E1' }}>
                                In Process
                            </Text>
                            <Text variant="heading3" style={{ color: '#60A5FA' }}>
                                ₹{earnings.processingAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </Text>
                        </View>

                        <View style={{ flex: 1, alignItems: 'flex-end' }}>
                            <Text variant="caption" style={{ color: '#CBD5E1' }}>
                                Wallet Balance
                            </Text>
                            <Text variant="heading3" style={{ color: BRAND_ACCENT }}>
                                ₹{earnings.pendingPayout.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </Text>
                        </View>
                    </View>
                    <View style={{ marginTop: 16 }}>
                        <Button
                            label="Request Payout"
                            accessibilityLabel="Open Request Payout Modal"
                            variant="primary"
                            onPress={() => setIsPayoutModalOpen(true)}
                            style={{ backgroundColor: '#22C55E', borderColor: '#22C55E' }}
                        />
                    </View>
                </Card>

                {/* Settlement Records Title */}
                <Text variant="heading3" style={{ marginTop: tokens.spacing.xs }}>
                    Settlement History ({settlements.length})
                </Text>

                {settlementsQuery.isLoading ? (
                    <LoadingSpinner accessibilityLabel="Loading settlement history..." />
                ) : settlements.length === 0 ? (
                    <EmptyState
                        title="No Settlements Recorded"
                        description="Completed order payouts will automatically appear here once calculated."
                        accessibilityLabel="No Settlements Recorded"
                    />
                ) : (
                    settlements.map((item: RestaurantSettlement) => (
                        <Card
                            key={item.id}
                            style={{
                                padding: tokens.spacing.md,
                                borderRadius: 12,
                                gap: tokens.spacing.sm,
                                borderWidth: 1,
                                borderColor: '#E2E8F0',
                            }}
                        >
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                <View>
                                    <Text variant="label" style={{ fontWeight: 'bold' }}>
                                        {item.referenceType === 'ORDER_EARNING' ? 'Order Payment' : 'Payout Disbursed'}
                                    </Text>
                                    <Text variant="caption" color={tokens.color.textSecondary}>
                                        {new Date(item.createdAt).toLocaleString()}
                                    </Text>
                                </View>
                                {getStatusBadge(item.entryType, item.status)}
                            </View>

                            <View style={{ height: 1, backgroundColor: '#F1F5F9', marginVertical: 4 }} />

                            <View style={{ gap: 4 }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                    <Text variant="caption" color={tokens.color.textSecondary}>
                                        {item.entryType === 'CREDIT' ? 'Transaction Value' : 'Withdrawal Amount'}
                                    </Text>
                                    <Text variant="heading3" style={{ color: item.entryType === 'CREDIT' ? '#4ADE80' : '#EF4444' }}>
                                        {item.entryType === 'CREDIT' ? '+' : '-'}₹{item.amount.toFixed(2)}
                                    </Text>
                                </View>
                            </View>

                            {item.referenceId && (
                                <View style={{ backgroundColor: '#F8FAFC', padding: 8, borderRadius: 6, marginTop: 4 }}>
                                    <Text variant="caption" style={{ color: '#475569', fontSize: 11 }}>
                                        Ref: {item.referenceId}
                                    </Text>
                                </View>
                            )}

                            {item.entryType === 'DEBIT' && (
                                <View style={{ backgroundColor: '#F0FDF4', padding: 8, borderRadius: 8, marginTop: 8 }}>
                                    <Text variant="caption" style={{ fontWeight: 'bold', color: '#166534', marginBottom: 4 }}>Payout Tracker</Text>
                                    <PayoutProgressBar status={item.status || 'REQUESTED'} />
                                </View>
                            )}
                        </Card>
                    ))
                )}
            </ScrollView>

            <RequestPayoutModal
                visible={isPayoutModalOpen}
                onClose={() => setIsPayoutModalOpen(false)}
                availableBalance={earnings.pendingPayout}
            />
        </SafeAreaView>
    );
}
