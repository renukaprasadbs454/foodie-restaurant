import React, { useEffect, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  View,
  useWindowDimensions,
  RefreshControl,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Skeleton,
  Text,
  trackAnalyticsEvent,
  useConnectivity,
  useTheme,
} from 'foodie-shared-rn';
import {
  useGetRestaurantProfileQuery,
  useGetRestaurantQuery,
  useGetDashboardSummaryQuery,
  useToggleRestaurantStatusMutation,
} from '../../../api/endpoints/restaurantsApi';
import { useGetRestaurantOrdersQuery, useTransitionOrderStatusMutation } from '../../../api/endpoints/ordersApi';
import { useAppDispatch, useAppSelector } from '../../../store/hooks';
import {
  selectRestaurantId,
  setRestaurantCreated,
} from '../../onboarding/restaurantOnboardingSlice';
import { useRestaurantOrdersSubscription } from '../hooks/useRestaurantOrdersSubscription';
import { formatMoney, validateRejectReason } from '../types';
import type { OrdersStackParamList } from '../../../navigation/types';
import { DemoModeIndicator } from '../../../components/DemoModeIndicator';
import { MOCK_CONFIG } from '../../../config/mockConfig';
import { getMockDashboardSummary, getMockRestaurantProfile } from '../../../mock';
import { IncomingOrderAlertModal } from '../components/IncomingOrderAlertModal';
import { RejectOrderModal } from '../components/RejectOrderModal';
import { OrderCard } from '../components/OrderCard';

type Props = NativeStackScreenProps<OrdersStackParamList, 'Dashboard'>;

const BRAND_PRIMARY = '#14532D'; // Primary Dark Green
const BRAND_ACCENT = '#F59E0B';  // Accent Orange/Gold

export function DashboardScreen({ navigation }: Props) {
  const { tokens } = useTheme();
  const { isConnected } = useConnectivity();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const dispatch = useAppDispatch();
  const storedRestaurantId = useAppSelector(selectRestaurantId);

  const profileQuery = useGetRestaurantProfileQuery(undefined, {
    skip: Boolean(storedRestaurantId),
  });

  const activeQuery = useGetRestaurantOrdersQuery(
    { page: 0, size: 20, sort: 'placedAt' },
    {
      refetchOnFocus: true,
      pollingInterval: 5000, // Poll every 5 seconds for real-time customer order updates without UI interruption
    },
  );

  const summaryQuery = useGetDashboardSummaryQuery(undefined, {
    skip: !storedRestaurantId,
    refetchOnFocus: true,
  });

  const [transitionStatus] = useTransitionOrderStatusMutation();
  const [dismissedAlertOrderIds, setDismissedAlertOrderIds] = useState<string[]>([]);
  const [rejectingOrder, setRejectingOrder] = useState<{ orderId: string; orderNumber: string } | null>(null);
  const [manualRefresh, setManualRefresh] = useState(false);

  useEffect(() => {
    if (profileQuery.data?.restaurantId && !storedRestaurantId) {
      dispatch(
        setRestaurantCreated({
          restaurantId: profileQuery.data.restaurantId,
          status: profileQuery.data.status ?? 'APPROVED',
        }),
      );
    }
  }, [dispatch, profileQuery.data, storedRestaurantId]);

  const restaurantId =
    storedRestaurantId ??
    profileQuery.data?.restaurantId ??
    activeQuery.data?.find((o) => o.restaurantId)?.restaurantId ??
    (MOCK_CONFIG.ENABLE_MOCK_FALLBACK ? MOCK_CONFIG.DEFAULT_MOCK_RESTAURANT_ID : undefined);

  const { wsActive } = useRestaurantOrdersSubscription(restaurantId ?? null);

  const restaurantQuery = useGetRestaurantQuery(restaurantId ?? '', {
    skip: !restaurantId,
  });

  // Determine if we should use Mock Fallback
  const apiOrders = activeQuery.data;
  const apiProfile = restaurantQuery.data;
  const isUsingMock =
    MOCK_CONFIG.ENABLE_MOCK_FALLBACK &&
    (!isConnected ||
      activeQuery.isError ||
      !apiOrders ||
      apiOrders.length === 0 ||
      restaurantQuery.isError ||
      !apiProfile);

  const mockSummary = getMockDashboardSummary();
  const mockProfile = getMockRestaurantProfile();

  // Data selection: Real API data if available, else Mock Fallback
  const displayRestaurantName =
    apiProfile?.name ?? (isUsingMock ? mockProfile.name : 'Foodie Restaurant');
  const displayLogoUrl =
    apiProfile?.logoImageUrl ?? (isUsingMock ? mockProfile.logoImageUrl : null);
  const displayStatus =
    apiProfile?.status ?? (isUsingMock ? mockProfile.status : 'APPROVED');

  const orders =
    apiOrders && apiOrders.length > 0
      ? apiOrders
      : isUsingMock
        ? mockSummary.recentOrders
        : [];

  const todayOrdersCount = summaryQuery.data
    ? (summaryQuery.data.totalOrders || 0)
    : isUsingMock
      ? mockSummary.todayOrdersCount
      : 0;

  const pendingOrdersCount = summaryQuery.data
    ? (summaryQuery.data.pendingOrders || 0)
    : isUsingMock
      ? mockSummary.pendingOrdersCount
      : 0;

  const completedOrdersCount = summaryQuery.data
    ? (summaryQuery.data.completedOrders || 0)
    : isUsingMock
      ? mockSummary.completedOrdersCount
      : 0;

  const totalRevenue = summaryQuery.data
    ? (typeof summaryQuery.data.grossSales === 'number' ? summaryQuery.data.grossSales : Number(summaryQuery.data.grossSales) || 0)
    : isUsingMock
      ? mockSummary.grossRevenue
      : 0;

  useEffect(() => {
    trackAnalyticsEvent('restaurant_dashboard_viewed');
  }, []);

  const [toggleStatus] = useToggleRestaurantStatusMutation();

  useEffect(() => {
    if (!apiProfile) return;
    const desc = apiProfile.description || '';
    const openMatch = desc.match(/\[OPEN:(.*?)\]/);
    const closeMatch = desc.match(/\[CLOSE:(.*?)\]/);
    if (!openMatch || !closeMatch) return;

    const parseTime = (t: string) => {
      const match = t.match(/(\d+):(\d+)\s*(AM|PM)/i);
      if (!match) return 0;
      let [_, h, m, p] = match;
      let hours = parseInt(h, 10);
      if (p.toUpperCase() === 'PM' && hours < 12) hours += 12;
      if (p.toUpperCase() === 'AM' && hours === 12) hours = 0;
      return hours * 60 + parseInt(m, 10);
    };

    const now = new Date();
    const currentMins = now.getHours() * 60 + now.getMinutes();

    const openMins = parseTime(openMatch[1]);
    const closeMins = parseTime(closeMatch[1]);

    const shouldBeOpen = currentMins >= openMins && currentMins < closeMins;
    if (apiProfile.isOpen !== shouldBeOpen) {
      void toggleStatus(shouldBeOpen);
    }
  }, [apiProfile, toggleStatus]);

  // LOADING STATE
  const isProfileLoading = !storedRestaurantId && profileQuery.isLoading;
  const isDataLoading =
    Boolean(restaurantId) &&
    !isUsingMock &&
    ((restaurantQuery.isLoading && !restaurantQuery.data) ||
      (activeQuery.isLoading && !activeQuery.data));

  if (isProfileLoading || isDataLoading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: tokens.color.background,
          padding: tokens.spacing.md,
          justifyContent: 'center',
          gap: tokens.spacing.md,
        }}
      >
        <Text variant="heading2" style={{ color: BRAND_PRIMARY, textAlign: 'center' }}>
          Loading restaurant dashboard…
        </Text>
        <Skeleton.Block width="100%" height={140} />
        <Skeleton.Block width="100%" height={200} />
      </View>
    );
  }

  // MISSING RESTAURANT PROFILE STATE (when mock fallback disabled and no profile)
  if (!restaurantId && !MOCK_CONFIG.ENABLE_MOCK_FALLBACK) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: tokens.color.background,
          padding: tokens.spacing.xl,
          justifyContent: 'center',
          gap: tokens.spacing.md,
        }}
      >
        <EmptyState
          title="Restaurant Profile Not Found"
          description="No registered restaurant profile was found for this account. Please complete registration or retry."
          accessibilityLabel="Missing restaurant profile"
        />
        <View style={{ gap: tokens.spacing.sm }}>
          <Button
            label="Register Restaurant"
            accessibilityLabel="Register Restaurant"
            style={{ backgroundColor: BRAND_PRIMARY }}
            onPress={() => dispatch(setRestaurantCreated({ restaurantId: '', status: 'PENDING' }))}
          />
          <Button
            label="Retry Loading Profile"
            accessibilityLabel="Retry Loading Profile"
            variant="secondary"
            onPress={() => {
              void profileQuery.refetch();
            }}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: tokens.color.background }}>
      <ScrollView
        contentContainerStyle={{
          padding: tokens.spacing.md,
          gap: tokens.spacing.md,
          paddingBottom: 80,
          maxWidth: isWide ? 1200 : undefined,
          alignSelf: isWide ? 'center' : undefined,
          width: '100%',
        }}
        refreshControl={
          <RefreshControl
            refreshing={manualRefresh && (activeQuery.isFetching || summaryQuery.isFetching)}
            onRefresh={() => {
              setManualRefresh(true);
              void activeQuery.refetch().then(() => setManualRefresh(false));
              void summaryQuery.refetch().then(() => setManualRefresh(false));
            }}
          />
        }
      >
        {/* DEMO MODE BADGE (SUBTLE) */}
        {isUsingMock ? <DemoModeIndicator isMockActive={true} /> : null}

        {/* BRANDING HEADER BANNER */}
        <Card
          style={{
            backgroundColor: BRAND_PRIMARY,
            padding: tokens.spacing.lg,
            borderRadius: 16,
            borderColor: 'rgba(245, 158, 11, 0.3)',
            borderWidth: 1,
            gap: tokens.spacing.sm,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <View style={{ gap: 4, flex: 1 }}>
              <Text
                variant="heading1"
                style={{ color: '#FFFFFF', fontWeight: 'bold' }}
                accessibilityRole="header"
              >
                {displayRestaurantName}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.xs }}>
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: BRAND_ACCENT,
                  }}
                />
                <Text variant="caption" style={{ color: BRAND_ACCENT, fontWeight: 'bold' }}>
                  ONLINE & ACCEPTING ORDERS
                </Text>
                <Text variant="caption" style={{ color: '#A7F3D0', fontSize: 11 }}>
                  ({displayStatus})
                </Text>
              </View>
            </View>

            {displayLogoUrl ? (
              <Image
                source={{ uri: displayLogoUrl }}
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  borderWidth: 2,
                  borderColor: BRAND_ACCENT,
                }}
              />
            ) : (
              <View
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 26,
                  backgroundColor: 'rgba(255,255,255,0.15)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: BRAND_ACCENT,
                }}
              >
                <Text style={{ fontSize: 24 }}>🍳</Text>
              </View>
            )}
          </View>

          {/* Connection / Channel Status */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.xs, marginTop: 4 }}>
            {!isConnected ? (
              <Text variant="caption" style={{ color: '#F87171' }}>
                ⚠️ Offline — Demo data active.
              </Text>
            ) : isUsingMock ? (
              <Text variant="caption" style={{ color: '#FDE68A' }}>
                ● Demo mode active (Mock data loaded)
              </Text>
            ) : null}
          </View>
        </Card>

        {/* SUMMARY CARDS GRID */}
        <View style={{ gap: tokens.spacing.sm }}>
          <Text variant="heading2" style={{ color: BRAND_PRIMARY, fontSize: 18 }}>
            Executive Overview
          </Text>

          {/* 2x2 Grid of Summary Cards */}
          <View style={{ flexDirection: 'row', gap: tokens.spacing.sm }}>
            {/* My Earning Card */}
            <Pressable style={{ flex: 1 }} onPress={() => navigation.getParent()?.navigate('ProfileTab', { screen: 'SettlementHistory' })}>
              <Card
                style={{
                  padding: tokens.spacing.md,
                  borderRadius: 14,
                  borderLeftWidth: 4,
                  borderLeftColor: BRAND_ACCENT,
                  backgroundColor: '#FEF3C7',
                  gap: 4,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text variant="caption" style={{ color: '#92400E', fontWeight: 'bold' }}>
                    My Earning
                  </Text>
                  <Text style={{ fontSize: 16 }}>💰</Text>
                </View>
                <Text variant="heading2" style={{ color: '#92400E', fontSize: 20, fontWeight: 'bold' }}>
                  {formatMoney(totalRevenue)}
                </Text>
                <Text variant="caption" style={{ color: '#B45309' }}>
                  Sales total
                </Text>
              </Card>
            </Pressable>

            {/* Today's Orders */}
            <Pressable style={{ flex: 1 }} onPress={() => navigation.getParent()?.navigate('OrdersTab')}>
              <Card
                style={{
                  padding: tokens.spacing.md,
                  borderRadius: 14,
                  borderLeftWidth: 4,
                  borderLeftColor: BRAND_PRIMARY,
                  gap: 4,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text variant="caption" color={tokens.color.textSecondary}>
                    Today's Orders
                  </Text>
                  <Text style={{ fontSize: 16 }}>📦</Text>
                </View>
                <Text variant="heading1" style={{ color: BRAND_PRIMARY, fontSize: 26, fontWeight: 'bold' }}>
                  {todayOrdersCount}
                </Text>
                <Text variant="caption" color={tokens.color.textSecondary}>
                  Total received today
                </Text>
              </Card>
            </Pressable>
          </View>

          <View style={{ flexDirection: 'row', gap: tokens.spacing.sm }}>
            {/* Pending Orders */}
            <Pressable style={{ flex: 1 }} onPress={() => navigation.getParent()?.navigate('OrdersTab')}>
              <Card
                style={{
                  padding: tokens.spacing.md,
                  borderRadius: 14,
                  borderLeftWidth: 4,
                  borderLeftColor: BRAND_ACCENT,
                  gap: 4,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text variant="caption" color={tokens.color.textSecondary}>
                    Pending Orders
                  </Text>
                  <Text style={{ fontSize: 16 }}>⏳</Text>
                </View>
                <Text variant="heading1" style={{ color: BRAND_ACCENT, fontSize: 26, fontWeight: 'bold' }}>
                  {pendingOrdersCount}
                </Text>
                <Text variant="caption" style={{ color: BRAND_ACCENT, fontWeight: '600' }}>
                  Needs kitchen action
                </Text>
              </Card>
            </Pressable>

            {/* Completed Orders */}
            <Pressable style={{ flex: 1 }} onPress={() => navigation.getParent()?.navigate('OrdersTab')}>
              <Card
                style={{
                  padding: tokens.spacing.md,
                  borderRadius: 14,
                  borderLeftWidth: 4,
                  borderLeftColor: '#16A34A',
                  gap: 4,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text variant="caption" color={tokens.color.textSecondary}>
                    Completed
                  </Text>
                  <Text style={{ fontSize: 16 }}>✅</Text>
                </View>
                <Text variant="heading1" style={{ color: '#16A34A', fontSize: 26, fontWeight: 'bold' }}>
                  {completedOrdersCount}
                </Text>
                <Text variant="caption" color={tokens.color.textSecondary}>
                  Dispatched & Served
                </Text>
              </Card>
            </Pressable>
          </View>
        </View>

        {/* QUICK ACTIONS ROW */}
        <View style={{ gap: tokens.spacing.xs, marginTop: tokens.spacing.xs }}>
          <Text variant="heading2" style={{ color: BRAND_PRIMARY, fontSize: 18 }}>
            Quick Actions
          </Text>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.xs }}>
            <Button
              label="📋 Live Orders"
              accessibilityLabel="Open order queue"
              style={{ flex: 1, minWidth: 140, backgroundColor: BRAND_PRIMARY }}
              onPress={() => {
                trackAnalyticsEvent('open_queue_tapped');
                navigation.getParent()?.navigate('OrdersTab');
              }}
            />
            <Button
              label="🍽️ Menu"
              accessibilityLabel="Open menu"
              variant="secondary"
              style={{ flex: 1, minWidth: 140 }}
              onPress={() => {
                trackAnalyticsEvent('open_menu_tapped');
                navigation.getParent()?.navigate('MenuTab');
              }}
            />
            <Button
              label="💰 Settlements"
              accessibilityLabel="Open settlement history"
              variant="secondary"
              style={{ flex: 1, minWidth: 140 }}
              onPress={() => {
                navigation.getParent()?.navigate('ProfileTab', {
                  screen: 'SettlementHistory',
                });
              }}
            />
            <Button
              label="⭐ Reviews"
              accessibilityLabel="Open reviews"
              variant="secondary"
              style={{ flex: 1, minWidth: 140 }}
              onPress={() => {
                trackAnalyticsEvent('open_reviews_tapped');
                navigation.getParent()?.navigate('ReviewsTab');
              }}
            />
            <Button
              label="👤 Profile"
              accessibilityLabel="Open profile"
              variant="secondary"
              style={{ flex: 1, minWidth: 140 }}
              onPress={() => {
                trackAnalyticsEvent('open_profile_tapped');
                navigation.getParent()?.navigate('ProfileTab', {
                  screen: 'RestaurantProfile',
                });
              }}
            />
          </View>
        </View>

        {/* RECENT ORDERS SECTION */}
        <Card style={{ padding: tokens.spacing.md, gap: tokens.spacing.md, borderRadius: 14 }}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottomWidth: 1,
              borderBottomColor: tokens.color.border,
              paddingBottom: tokens.spacing.xs,
            }}
          >
            <Text variant="heading2" style={{ color: BRAND_PRIMARY, fontSize: 17 }}>
              Recent Orders
            </Text>
            <Pressable
              onPress={() => navigation.getParent()?.navigate('OrdersTab')}
              accessibilityRole="button"
              accessibilityLabel="View all orders"
            >
              <Text variant="label" style={{ color: BRAND_PRIMARY }}>
                View All Queue →
              </Text>
            </Pressable>
          </View>

          {orders.length === 0 ? (
            <EmptyState
              title="No Recent Orders"
              description="New customer orders will appear here automatically."
              accessibilityLabel="No recent orders"
            />
          ) : (
            <View style={{ gap: tokens.spacing.sm }}>
              {orders.slice(0, 5).map((order) => (
                <OrderCard
                  key={order.orderId}
                  order={order}
                  isTransitioning={false}
                  onViewDetails={() => {
                    trackAnalyticsEvent('order_opened', { orderId: order.orderId });
                    navigation.navigate('RestaurantOrderDetails', {
                      orderId: order.orderId,
                    });
                  }}
                  onTransitionStatus={async (orderId, targetStatus) => {
                    try {
                      await transitionStatus({ orderId, targetStatus }).unwrap();
                      if (targetStatus === 'ACCEPTED') {
                        await transitionStatus({ orderId, targetStatus: 'PREPARING' }).unwrap();
                      }
                    } catch (e) {
                      // Error handled by mutation
                    }
                  }}
                  onOpenRejectModal={(orderId, orderNumber) => {
                    setRejectingOrder({ orderId, orderNumber });
                  }}
                />
              ))}
            </View>
          )}
        </Card>
      </ScrollView>

      {/* INCOMING ORDER ALERT MODAL WITH SOUND */}
      {(() => {
        const incomingOrderNeedingAction = orders.find(
          (o) => (o.status === 'CONFIRMED' || o.status === 'PLACED') && !dismissedAlertOrderIds.includes(o.orderId)
        ) ?? null;

        return (
          <>
            <IncomingOrderAlertModal
              order={incomingOrderNeedingAction}
              visible={Boolean(incomingOrderNeedingAction)}
              onAccept={async (orderId) => {
                setDismissedAlertOrderIds((prev) => [...prev, orderId]);
                try {
                  await transitionStatus({ orderId, targetStatus: 'ACCEPTED' }).unwrap();
                  void activeQuery.refetch();
                } catch (e) { }
              }}
              onReject={(orderId) => {
                const target = orders.find((o) => o.orderId === orderId);
                setDismissedAlertOrderIds((prev) => [...prev, orderId]);
                if (target) {
                  setRejectingOrder({ orderId: target.orderId, orderNumber: target.orderNumber });
                }
              }}
            />

            <RejectOrderModal
              visible={Boolean(rejectingOrder)}
              orderNumber={rejectingOrder?.orderNumber}
              loading={false}
              onConfirm={(reason) => {
                if (rejectingOrder) {
                  void transitionStatus({
                    orderId: rejectingOrder.orderId,
                    targetStatus: 'REJECTED',
                    reason,
                  }).unwrap();
                  setRejectingOrder(null);
                  void activeQuery.refetch();
                }
              }}
              onCancel={() => setRejectingOrder(null)}
            />
          </>
        );
      })()}
    </View>
  );
}
