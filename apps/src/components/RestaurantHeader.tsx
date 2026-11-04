import React, { useEffect, useState } from 'react';
import { Platform, Pressable, View, useWindowDimensions, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Modal, Text, useTheme } from 'foodie-shared-rn';
import Feather from '@expo/vector-icons/Feather';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { selectRestaurantId, setRestaurantCreated } from '../features/onboarding/restaurantOnboardingSlice';
import { logoutRestaurant } from '../features/auth/session';
import { store } from '../store/store';
import { useGetRestaurantProfileQuery, useToggleRestaurantStatusMutation } from '../api/endpoints/restaurantsApi';
import {
  useCheckActiveOrdersQuery,
  useLazyCheckActiveOrdersQuery,
  useGetRestaurantOrdersQuery,
} from '../api/endpoints/ordersApi';
import { useGetNotificationsQuery } from '../api/endpoints/notificationsApi';
import { RestaurantSupportModal } from '../features/profile/components/RestaurantSupportModal';
import { toUnwrappedApiError } from '../features/auth/apiError';
import {
  hasActiveAcceptedOrders,
  OFFLINE_BLOCKED_WARNING_MESSAGE,
} from '../features/orders/types';

let isAutoOverridden = false;

type Props = {
  title?: string;
  subtitle?: string;
  navigation?: any;
  showBack?: boolean;
  onLogout?: () => void;
};

const BRAND_PRIMARY = '#14532D'; // Dark Green
const BRAND_ACCENT = '#F59E0B';  // Amber / Gold

export function RestaurantHeader({
  title = 'Foodie Partner',
  subtitle,
  navigation,
  showBack = false,
  onLogout,
}: Props) {
  const { tokens } = useTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isWide = width >= 768;

  const restaurantId = useAppSelector(selectRestaurantId);
  const dispatch = useAppDispatch();
  const { data: profile } = useGetRestaurantProfileQuery(undefined, { skip: false });
  const [toggleStatus] = useToggleRestaurantStatusMutation();
  const [supportVisible, setSupportVisible] = useState(false);
  const [activeOrderWarningVisible, setActiveOrderWarningVisible] = useState(false);
  const [confirmOfflineVisible, setConfirmOfflineVisible] = useState(false);
  const [confirmOnlineVisible, setConfirmOnlineVisible] = useState(false);
  const [isToggling, setIsToggling] = useState(false);

  useEffect(() => {
    if (profile?.restaurantId && !restaurantId) {
      dispatch(setRestaurantCreated({ restaurantId: profile.restaurantId, status: profile.status }));
    }
  }, [profile?.restaurantId, profile?.status, restaurantId, dispatch]);

  const effectiveRestaurantId = profile?.restaurantId || restaurantId || '';
  const effectiveRestaurantName = profile?.name || 'Restaurant Partner';

  const { data: activeOrdersCheck } = useCheckActiveOrdersQuery(undefined, {
    pollingInterval: 3000,
  });
  const [triggerCheckActiveOrders] = useLazyCheckActiveOrdersQuery();

  const ordersQuery = useGetRestaurantOrdersQuery(
    { page: 0, size: 20 },
    { pollingInterval: 3000 }
  );

  const notificationsQuery = useGetNotificationsQuery(
    { unreadOnly: true, page: 0, size: 20 },
    { skip: !effectiveRestaurantId, pollingInterval: 15000 }
  );
  const unreadCount = notificationsQuery.data?.length || 0;

  const isOnline = profile?.isOpen ?? false;

  const displayTitle: string = title;
  const displaySubtitle: string =
    subtitle ?? (effectiveRestaurantId ? `Restaurant #${effectiveRestaurantId.slice(0, 8)}` : 'Restaurant Partner Portal');

  const canGoBack = showBack || (navigation && typeof navigation.canGoBack === 'function' && navigation.canGoBack());

  useEffect(() => {
    if (!profile) return;
    const openMatch = profile.description?.match(/\[OPEN:(.*?)\]/i);
    const closeMatch = profile.description?.match(/\[CLOSE:(.*?)\]/i);

    if (!openMatch || !closeMatch) return;

    const parseTime = (val: string) => {
      const match = val.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
      if (!match) return null;
      let h = parseInt(match[1], 10);
      const m = parseInt(match[2], 10);
      const mod = match[3] ? match[3].toUpperCase() : null;
      if (mod === 'PM' && h < 12) h += 12;
      if (mod === 'AM' && h === 12) h = 0;
      return { h, m };
    };

    const open = parseTime(openMatch[1]);
    const close = parseTime(closeMatch[1]);
    if (!open || !close) return;

    const checkStatus = () => {
      // If user toggled manually this session, respect their choice
      if (isAutoOverridden) return;

      try {
        const now = new Date();
        const current = now.getHours() * 60 + now.getMinutes();
        const o = open.h * 60 + open.m;
        const c = close.h * 60 + close.m;

        let shouldBeOpen = false;
        if (c < o) {
          shouldBeOpen = current >= o || current <= c;
        } else {
          shouldBeOpen = current >= o && current <= c;
        }

        if (shouldBeOpen !== isOnline) {
          const hasActive = Boolean(activeOrdersCheck?.hasActiveOrders) || hasActiveAcceptedOrders(ordersQuery.data);
          if (!shouldBeOpen && hasActive) {
            // Keep the restaurant Online until all active orders are completed or cancelled
            return;
          }
          // Fire and forget
          toggleStatus(shouldBeOpen).catch(() => { });
        }
      } catch (e) {
        // ignore
      }
    };

    checkStatus(); // Check immediately
    const interval = setInterval(checkStatus, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [profile?.description, isOnline, toggleStatus, activeOrdersCheck?.hasActiveOrders, ordersQuery.data]);

  const handleToggleClick = async () => {
    isAutoOverridden = true;
    if (isOnline) {
      // 1. Query real-time active customer orders from backend for this restaurant
      let hasActive = Boolean(activeOrdersCheck?.hasActiveOrders);
      try {
        const fresh = await triggerCheckActiveOrders().unwrap();
        if (fresh && typeof fresh.hasActiveOrders === 'boolean') {
          hasActive = fresh.hasActiveOrders;
        } else if (ordersQuery.data) {
          hasActive = hasActiveAcceptedOrders(ordersQuery.data);
        }
      } catch {
        if (ordersQuery.data) {
          hasActive = hasActiveAcceptedOrders(ordersQuery.data);
        }
      }

      if (hasActive) {
        // Show clear popup message!
        setActiveOrderWarningVisible(true);
        if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.alert === 'function') {
          try {
            window.alert(OFFLINE_BLOCKED_WARNING_MESSAGE);
          } catch {
            // ignore
          }
        }
        return;
      }

      // No active orders -> allow switching offline normally via confirmation popup
      setConfirmOfflineVisible(true);
    } else {
      // Offline -> show confirmation popup to switch Online
      setConfirmOnlineVisible(true);
    }
  };

  const handleConfirmOffline = async () => {
    setConfirmOfflineVisible(false);
    setIsToggling(true);
    try {
      await toggleStatus(false).unwrap();
    } catch (err: any) {
      const unwrapped = toUnwrappedApiError(err);
      setActiveOrderWarningVisible(true);
      if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.alert === 'function') {
        try {
          window.alert(unwrapped.message || OFFLINE_BLOCKED_WARNING_MESSAGE);
        } catch {
          // ignore
        }
      }
    } finally {
      setIsToggling(false);
    }
  };

  const handleConfirmOnline = async () => {
    setConfirmOnlineVisible(false);
    setIsToggling(true);
    try {
      await toggleStatus(true).unwrap();
    } catch (err: any) {
      const unwrapped = toUnwrappedApiError(err);
      if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.alert === 'function') {
        try {
          window.alert(unwrapped.message || 'Failed to go online.');
        } catch {
          // ignore
        }
      }
    } finally {
      setIsToggling(false);
    }
  };

  const handleNotificationPress = () => {
    if (navigation && typeof navigation.navigate === 'function') {
      const parent = navigation.getParent();
      if (parent) {
        parent.navigate('ProfileTab', { screen: 'NotificationsHome' });
      } else {
        navigation.navigate('ProfileTab', { screen: 'NotificationsHome' });
      }
    }
  };

  return (
    <View style={{ backgroundColor: BRAND_PRIMARY, zIndex: 100, paddingTop: insets.top }}>
      <View
        style={{
          height: isWide ? 64 : 58,
          paddingHorizontal: tokens.spacing.md,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          maxWidth: isWide ? 1200 : undefined,
          alignSelf: isWide ? 'center' : undefined,
          width: '100%',
        }}
      >
        {/* LEFT BRAND & TITLE AREA */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
          {canGoBack ? (
            <Pressable
              onPress={() => navigation?.goBack()}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              style={({ pressed }) => [{
                padding: 6,
                borderRadius: 8,
                backgroundColor: pressed ? 'rgba(255, 255, 255, 0.15)' : 'transparent',
              }]}
            >
              <Feather name="arrow-left" size={20} color="#FFFFFF" />
            </Pressable>
          ) : null}

          {/* LOGO ICON WITH AMBER ACCENT RING */}
          <View
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              backgroundColor: '#1E6B39',
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1.5,
              borderColor: BRAND_ACCENT,
            }}
          >
            <Text style={{ fontSize: 20 }}>🍳</Text>
          </View>

          {/* TITLE & SUBTITLE */}
          <View style={{ gap: 1, flex: 1 }}>
            <Text
              variant="label"
              style={{
                color: '#FFFFFF',
                fontSize: isWide ? 17 : 15,
                fontWeight: 'bold',
              }}
              numberOfLines={1}
            >
              {displayTitle}
            </Text>

            <Text
              variant="caption"
              style={{
                color: '#A7F3D0',
                fontSize: 11,
              }}
              numberOfLines={1}
            >
              {displaySubtitle}
            </Text>
          </View>
        </View>

        {/* RIGHT ACTION CONTROLS: ONLINE STATUS, LIVE SUPPORT & NOTIFICATION BELL */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.sm }}>
          {/* ONLINE / OFFLINE TOGGLE PILL */}
          <Pressable
            onPress={handleToggleClick}
            accessibilityRole="button"
            accessibilityLabel={`Restaurant status ${isOnline ? 'Online' : 'Offline'}`}
            style={({ pressed }) => [{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 10,
              paddingVertical: 5,
              borderRadius: 12,
              gap: 6,
              backgroundColor: isOnline ? '#064E3B' : '#7F1D1D',
              borderWidth: 1,
              borderColor: isOnline ? '#059669' : '#DC2626',
              opacity: pressed || isToggling ? 0.75 : 1,
              cursor: Platform.OS === 'web' ? 'pointer' : undefined,
            }]}
          >
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: isOnline ? '#22C55E' : '#EF4444',
              }}
            />
            <Text
              variant="caption"
              style={{
                color: isOnline ? '#6EE7B7' : '#FCA5A5',
                fontWeight: 'bold',
                fontSize: 11,
              }}
            >
              {isOnline ? 'Online' : 'Offline'}
            </Text>
          </Pressable>

          {/* LIVE SUPPORT AGENT BUTTON */}
          <Pressable
            onPress={() => setSupportVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Open Admin Support Chat"
            style={({ pressed }) => [{
              width: 38,
              height: 38,
              borderRadius: 19,
              backgroundColor: pressed ? 'rgba(255, 255, 255, 0.25)' : 'rgba(255, 255, 255, 0.15)',
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: 'rgba(255, 255, 255, 0.25)',
            }]}
          >
            <Feather name="headphones" size={18} color="#FFFFFF" />
          </Pressable>

          {/* NOTIFICATION BELL ICON WITH AMBER DOT */}
          <Pressable
            onPress={handleNotificationPress}
            accessibilityRole="button"
            accessibilityLabel="Notifications"
            style={({ pressed }) => [{
              width: 38,
              height: 38,
              borderRadius: 19,
              backgroundColor: pressed ? 'rgba(255, 255, 255, 0.25)' : 'rgba(255, 255, 255, 0.15)',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              borderWidth: 1,
              borderColor: 'rgba(255, 255, 255, 0.25)',
            }]}
          >
            <Feather name="bell" size={18} color={unreadCount > 0 ? '#F59E0B' : '#FFFFFF'} />
            {unreadCount > 0 && (
              <View
                style={{
                  position: 'absolute',
                  top: -2,
                  right: -2,
                  backgroundColor: '#EF4444',
                  borderRadius: 12,
                  paddingHorizontal: 5,
                  minWidth: 18,
                  height: 18,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1.5,
                  borderColor: BRAND_PRIMARY,
                }}
              >
                <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: 'bold' }}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>

      {/* SUBTLE AMBER BOTTOM ACCENT LINE */}
      <View style={{ height: 2, backgroundColor: BRAND_ACCENT }} />

      {/* RESTAURANT ADMIN SUPPORT MODAL */}
      <RestaurantSupportModal
        visible={supportVisible}
        onClose={() => setSupportVisible(false)}
        restaurantId={effectiveRestaurantId}
        restaurantName={effectiveRestaurantName}
      />

      {/* 1. ACTIVE ORDER WARNING POPUP MODAL */}
      <Modal
        visible={activeOrderWarningVisible}
        onRequestClose={() => setActiveOrderWarningVisible(false)}
        accessibilityLabel="Active Order Warning Modal"
        contentStyle={{
          maxWidth: 440,
          width: '92%',
          alignSelf: 'center',
          backgroundColor: '#FFFFFF',
          borderRadius: 16,
          padding: 24,
        }}
      >
        <View style={{ alignItems: 'center', gap: 16 }}>
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: '#FEF3C7',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Feather name="alert-triangle" size={28} color="#D97706" />
          </View>

          <View style={{ gap: 8, alignItems: 'center' }}>
            <Text
              variant="heading2"
              style={{ fontSize: 18, fontWeight: 'bold', color: '#111827', textAlign: 'center' }}
            >
              Cannot Go Offline
            </Text>
            <Text
              variant="body"
              style={{ fontSize: 14, color: '#374151', textAlign: 'center', lineHeight: 22 }}
            >
              {OFFLINE_BLOCKED_WARNING_MESSAGE}
            </Text>
          </View>

          <Button
            label="OK, Understood"
            accessibilityLabel="Dismiss active order warning"
            variant="primary"
            onPress={() => setActiveOrderWarningVisible(false)}
            style={{ width: '100%', marginTop: 8, backgroundColor: '#14532D' }}
          />
        </View>
      </Modal>

      {/* 2. CONFIRM OFFLINE MODAL */}
      <Modal
        visible={confirmOfflineVisible}
        onRequestClose={() => setConfirmOfflineVisible(false)}
        accessibilityLabel="Confirm Offline Modal"
        contentStyle={{
          maxWidth: 440,
          width: '92%',
          alignSelf: 'center',
          backgroundColor: '#FFFFFF',
          borderRadius: 16,
          padding: 24,
        }}
      >
        <View style={{ alignItems: 'center', gap: 16 }}>
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: '#FEE2E2',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Feather name="power" size={28} color="#DC2626" />
          </View>

          <View style={{ gap: 8, alignItems: 'center' }}>
            <Text
              variant="heading2"
              style={{ fontSize: 18, fontWeight: 'bold', color: '#111827', textAlign: 'center' }}
            >
              Go Offline?
            </Text>
            <Text
              variant="body"
              style={{ fontSize: 14, color: '#374151', textAlign: 'center', lineHeight: 22 }}
            >
              Are you sure you want to go offline? You will stop receiving new customer orders.
            </Text>
          </View>

          <View style={{ flexDirection: 'row', gap: 12, width: '100%', marginTop: 8 }}>
            <Button
              label="Cancel"
              accessibilityLabel="Cancel offline switch"
              variant="secondary"
              onPress={() => setConfirmOfflineVisible(false)}
              style={{ flex: 1 }}
            />
            <Button
              label="Go Offline"
              accessibilityLabel="Confirm go offline"
              variant="danger"
              loading={isToggling}
              onPress={handleConfirmOffline}
              style={{ flex: 1, backgroundColor: '#DC2626' }}
            />
          </View>
        </View>
      </Modal>

      {/* 3. CONFIRM ONLINE MODAL */}
      <Modal
        visible={confirmOnlineVisible}
        onRequestClose={() => setConfirmOnlineVisible(false)}
        accessibilityLabel="Confirm Online Modal"
        contentStyle={{
          maxWidth: 440,
          width: '92%',
          alignSelf: 'center',
          backgroundColor: '#FFFFFF',
          borderRadius: 16,
          padding: 24,
        }}
      >
        <View style={{ alignItems: 'center', gap: 16 }}>
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: '#DCFCE7',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Feather name="check-circle" size={28} color="#16A34A" />
          </View>

          <View style={{ gap: 8, alignItems: 'center' }}>
            <Text
              variant="heading2"
              style={{ fontSize: 18, fontWeight: 'bold', color: '#111827', textAlign: 'center' }}
            >
              Go Online?
            </Text>
            <Text
              variant="body"
              style={{ fontSize: 14, color: '#374151', textAlign: 'center', lineHeight: 22 }}
            >
              Are you sure you want to go online? You will start receiving new customer orders.
            </Text>
          </View>

          <View style={{ flexDirection: 'row', gap: 12, width: '100%', marginTop: 8 }}>
            <Button
              label="Cancel"
              accessibilityLabel="Cancel online switch"
              variant="secondary"
              onPress={() => setConfirmOnlineVisible(false)}
              style={{ flex: 1 }}
            />
            <Button
              label="Go Online"
              accessibilityLabel="Confirm go online"
              variant="primary"
              loading={isToggling}
              onPress={handleConfirmOnline}
              style={{ flex: 1, backgroundColor: '#14532D' }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}
