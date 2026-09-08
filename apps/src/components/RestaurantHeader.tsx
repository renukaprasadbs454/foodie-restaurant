import React from 'react';
import { Pressable, View, useWindowDimensions, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, useTheme } from 'foodie-shared-rn';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { selectRestaurantId } from '../features/onboarding/restaurantOnboardingSlice';
import { logoutRestaurant } from '../features/auth/session';
import { store } from '../store/store';
import { useGetRestaurantProfileQuery, useToggleRestaurantStatusMutation } from '../api/endpoints/restaurantsApi';
import { useGetNotificationsQuery } from '../api/endpoints/notificationsApi';

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
  const { data: profile } = useGetRestaurantProfileQuery(undefined, { skip: !restaurantId });
  const [toggleStatus] = useToggleRestaurantStatusMutation();

  const notificationsQuery = useGetNotificationsQuery(
    { unreadOnly: true, page: 0, size: 20 },
    { skip: !restaurantId, pollingInterval: 15000 }
  );
  const unreadCount = notificationsQuery.data?.length || 0;

  const isOnline = profile?.isOpen ?? false;

  const displayTitle: string = title;
  const displaySubtitle: string =
    subtitle ?? (restaurantId ? `Restaurant #${restaurantId.slice(0, 8)}` : 'Restaurant Partner Portal');

  const canGoBack = showBack || (navigation && typeof navigation.canGoBack === 'function' && navigation.canGoBack());



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
              <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' }}>
                ←
              </Text>
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

        {/* RIGHT ACTION CONTROLS: ONLINE STATUS, BELL & PROFILE AVATAR */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.sm }}>
          {/* ONLINE / OFFLINE TOGGLE PILL */}
          <Pressable
            onPress={() => {
              if (isOnline) {
                Alert.alert(
                  'Confirm Offline',
                  'Are you sure you want to go offline? You will stop receiving new orders.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Confirm', style: 'destructive', onPress: () => toggleStatus(false) },
                  ]
                );
              } else {
                toggleStatus(true);
              }
            }}
            accessibilityRole="button"
            accessibilityLabel={`Restaurant status ${isOnline ? 'Online' : 'Offline'}`}
            style={({ pressed }) => [{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 12,
              gap: 6,
              backgroundColor: isOnline ? '#064E3B' : '#7F1D1D',
              borderWidth: 1,
              borderColor: isOnline ? '#059669' : '#DC2626',
              opacity: pressed ? 0.8 : 1,
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

          {/* NOTIFICATION BELL ICON WITH AMBER DOT */}
          <Pressable
            onPress={handleNotificationPress}
            accessibilityRole="button"
            accessibilityLabel="Notifications"
            style={({ pressed }) => [{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: pressed ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.08)',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }]}
          >
            <Text style={{ fontSize: 20 }}>🔔</Text>
            {unreadCount > 0 && (
              <View
                style={{
                  position: 'absolute',
                  top: -2,
                  right: -2,
                  backgroundColor: '#EF4444',
                  borderRadius: 12,
                  paddingHorizontal: 5,
                  minWidth: 20,
                  height: 20,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1.5,
                  borderColor: BRAND_PRIMARY,
                }}
              >
                <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: 'bold' }}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Text>
              </View>
            )}
          </Pressable>

        </View>
      </View>

      {/* SUBTLE AMBER BOTTOM ACCENT LINE */}
      <View style={{ height: 2, backgroundColor: BRAND_ACCENT }} />
    </View>
  );
}

