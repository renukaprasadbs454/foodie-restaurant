import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Avatar, Card, Text, useTheme } from 'foodie-shared-rn';
import Feather from '@expo/vector-icons/Feather';
import {
  restaurantsApi,
  useGetMyRestaurantsQuery,
  useToggleSpecificRestaurantStatusMutation,
} from '../../../api/endpoints/restaurantsApi';
import { useAppDispatch, useAppSelector } from '../../../store/hooks';
import {
  selectRestaurantId,
  setActiveRestaurantId,
  setRestaurantStatus,
} from '../../onboarding/restaurantOnboardingSlice';
import { toUnwrappedApiError } from '../../auth/apiError';
import { ENV } from '../../../constants/env';

type Props = {
  onAddAnotherRestaurant: () => void;
  onNavigateToPending?: () => void;
  onNavigateToDocuments?: () => void;
  onToast?: (toast: { message: string; variant: 'info' | 'success' | 'error' | 'warning' }) => void;
};

const BRAND_PRIMARY = '#14532D';
const BRAND_ACCENT = '#F59E0B';

export function MyRestaurantsCard({
  onAddAnotherRestaurant,
  onNavigateToPending,
  onNavigateToDocuments,
  onToast,
}: Props) {
  const { tokens } = useTheme();
  const dispatch = useAppDispatch();
  const currentActiveId = useAppSelector(selectRestaurantId);

  const {
    data: myRestaurants,
    isLoading,
    isFetching,
    refetch,
  } = useGetMyRestaurantsQuery(undefined, { refetchOnFocus: true });
  const restaurantsList: any[] = Array.isArray(myRestaurants) ? myRestaurants : [];

  const [toggleSpecificStatus] = useToggleSpecificRestaurantStatusMutation();
  const [togglingRestoId, setTogglingRestoId] = useState<string | null>(null);

  const handleSwitchRestaurant = (resto: any) => {
    if (resto.restaurantId === currentActiveId) return;

    dispatch(setActiveRestaurantId(resto.restaurantId));
    if (resto.status) {
      dispatch(setRestaurantStatus(resto.status));
    }
    dispatch(
      restaurantsApi.util.invalidateTags([
        { type: 'Restaurant', id: 'LIST' },
        { type: 'Restaurant', id: resto.restaurantId },
        { type: 'Order' as any, id: 'LIST' },
        { type: 'Order' as any, id: 'ACTIVE_CHECK' },
        { type: 'Menu' as any, id: 'LIST' },
        { type: 'Review' as any, id: 'LIST' },
        { type: 'Coupon' as any, id: 'LIST' },
      ])
    );
    onToast?.({
      message: `Switched active portal to "${resto.name}".`,
      variant: 'success',
    });
  };

  const handleToggleOnline = async (resto: any) => {
    const nextIsOpen = !resto.isOpen;
    setTogglingRestoId(resto.restaurantId);
    try {
      await toggleSpecificStatus({
        restaurantId: resto.restaurantId,
        isOpen: nextIsOpen,
      }).unwrap();
      onToast?.({
        message: `${resto.name} is now ${nextIsOpen ? 'Online' : 'Offline'}.`,
        variant: 'success',
      });
      void refetch();
    } catch (err: any) {
      const unwrapped = toUnwrappedApiError(err);
      const msg = unwrapped.message || 'Failed to update restaurant status.';
      onToast?.({ message: msg, variant: 'error' });
      if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.alert === 'function') {
        try {
          window.alert(msg);
        } catch {
          // ignore
        }
      }
    } finally {
      setTogglingRestoId(null);
    }
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'APPROVED':
        return { label: 'Approved', bg: '#DCFCE7', text: '#15803D' };
      case 'PENDING':
        return { label: 'Pending Approval', bg: '#FEF3C7', text: '#B45309' };
      case 'ONBOARDING':
        return { label: 'Incomplete Draft', bg: '#EFF6FF', text: '#1D4ED8' };
      case 'REJECTED':
        return { label: 'Rejected', bg: '#FEE2E2', text: '#B91C1C' };
      case 'SUSPENDED':
        return { label: 'Suspended', bg: '#F1F5F9', text: '#475569' };
      default:
        return { label: status || 'Pending', bg: '#FEF3C7', text: '#B45309' };
    }
  };

  return (
    <Card style={styles.card}>
      {/* CARD HEADER */}
      <View style={styles.cardHeaderRow}>
        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ fontSize: 18 }}>🏪</Text>
            <Text variant="heading2" style={{ color: BRAND_PRIMARY, fontSize: 17, fontWeight: '700' }}>
              My Restaurants
            </Text>
          </View>
          <Text style={{ color: '#64748B', fontSize: 12 }}>
            Manage and switch between your registered restaurants
          </Text>
        </View>

        {/* ADD ANOTHER RESTAURANT BUTTON */}
        <Pressable
          onPress={onAddAnotherRestaurant}
          accessibilityRole="button"
          accessibilityLabel="Add Another Restaurant"
          style={({ pressed }) => [
            styles.addRestaurantBtn,
            pressed && { opacity: 0.85 },
          ]}
        >
          <Feather name="plus" size={15} color="#FFFFFF" />
          <Text style={styles.addRestaurantBtnText}>Add Another Restaurant</Text>
        </Pressable>
      </View>

      <View style={{ height: 1, backgroundColor: tokens.color.border }} />

      {/* RESTAURANTS LIST */}
      {isLoading && restaurantsList.length === 0 ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="small" color={BRAND_PRIMARY} />
          <Text style={{ fontSize: 13, color: '#64748B' }}>Loading registered restaurants…</Text>
        </View>
      ) : restaurantsList.length > 0 ? (
        <View style={{ gap: 12 }}>
          {restaurantsList.map((resto: any) => {
            const isActive = resto.restaurantId === currentActiveId;
            const badge = getStatusBadge(resto.status);
            const isOnline = Boolean(resto.isOpen);
            const isTogglingThis = togglingRestoId === resto.restaurantId;
            const logoUri = resto.logoImageUrl
              ? resto.logoImageUrl.startsWith('/api')
                ? `${ENV.apiBaseUrl}${resto.logoImageUrl}`
                : resto.logoImageUrl
              : null;

            const locationStr =
              resto.address?.city ||
                            resto.address?.line1 ||
              'Address not specified';

            return (
              <View
                key={resto.restaurantId}
                style={[
                  styles.restaurantRowCard,
                  isActive && styles.activeRestaurantRowCard,
                ]}
              >
                {/* TOP DETAILS ROW */}
                <View style={styles.topDetailsRow}>
                  <Avatar
                    uri={logoUri}
                    initials={(resto.name || 'R').slice(0, 2).toUpperCase()}
                    size={46}
                    accessibilityLabel={resto.name}
                  />

                  <View style={{ flex: 1, gap: 2 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                      <Text style={styles.restoTitle} numberOfLines={1}>
                        {resto.name}
                      </Text>
                      {isActive && (
                        <View style={styles.activeBadge}>
                          <Text style={styles.activeBadgeText}>✓ Active</Text>
                        </View>
                      )}
                    </View>

                    <Text style={styles.restoLocationText} numberOfLines={1}>
                      📍 {locationStr}
                    </Text>

                    {/* STATUS & ONLINE BADGES */}
                    <View style={styles.badgesRow}>
                      <View style={[styles.badgePill, { backgroundColor: badge.bg }]}>
                        <Text style={[styles.badgePillText, { color: badge.text }]}>
                          ● {badge.label}
                        </Text>
                      </View>

                      {resto.cuisineTypes && resto.cuisineTypes.length > 0 && (
                        <View style={styles.cuisinePill}>
                          <Text style={styles.cuisinePillText} numberOfLines={1}>
                            {resto.cuisineTypes.slice(0, 2).join(', ')}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>

                {/* BOTTOM CONTROLS ROW: INDEPENDENT ONLINE/OFFLINE TOGGLE + SWITCH BUTTON */}
                <View style={styles.controlsRow}>
                  {/* SEPARATE ONLINE / OFFLINE AVAILABILITY TOGGLE */}
                  <Pressable
                    onPress={() => void handleToggleOnline(resto)}
                    disabled={isTogglingThis}
                    accessibilityRole="button"
                    accessibilityLabel={`${resto.name} status toggle`}
                    style={({ pressed }) => [
                      styles.onlineTogglePill,
                      {
                        backgroundColor: isOnline ? '#ECFDF5' : '#FEF2F2',
                        borderColor: isOnline ? '#10B981' : '#EF4444',
                      },
                      pressed || isTogglingThis ? { opacity: 0.7 } : undefined,
                    ]}
                  >
                    {isTogglingThis ? (
                      <ActivityIndicator size="small" color={isOnline ? '#059669' : '#DC2626'} />
                    ) : (
                      <View
                        style={[
                          styles.toggleDot,
                          { backgroundColor: isOnline ? '#10B981' : '#EF4444' },
                        ]}
                      />
                    )}
                    <Text
                      style={[
                        styles.toggleText,
                        { color: isOnline ? '#065F46' : '#991B1B' },
                      ]}
                    >
                      {isOnline ? 'Online' : 'Offline'}
                    </Text>
                  </Pressable>

                  {/* RESTAURANT SWITCH OR STATUS DETAILS */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    {resto.status === 'PENDING' && onNavigateToPending && (
                      <Pressable
                        onPress={() => {
                          handleSwitchRestaurant(resto);
                          onNavigateToPending();
                        }}
                        style={styles.auxBtn}
                      >
                        <Text style={styles.auxBtnText}>View Status</Text>
                      </Pressable>
                    )}

                    {resto.status === 'ONBOARDING' && onNavigateToDocuments && (
                      <Pressable
                        onPress={() => {
                          handleSwitchRestaurant(resto);
                          onNavigateToDocuments();
                        }}
                        style={styles.auxBtn}
                      >
                        <Text style={styles.auxBtnText}>Complete Setup</Text>
                      </Pressable>
                    )}

                    {isActive ? (
                      <View style={styles.currentActivePill}>
                        <Text style={styles.currentActivePillText}>Currently Managing</Text>
                      </View>
                    ) : (
                      <Pressable
                        onPress={() => handleSwitchRestaurant(resto)}
                        accessibilityRole="button"
                        accessibilityLabel={`Switch to ${resto.name}`}
                        style={({ pressed }) => [
                          styles.switchBtn,
                          pressed && { backgroundColor: '#F0FDF4' },
                        ]}
                      >
                        <Text style={styles.switchBtnText}>Switch Restaurant ➔</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      ) : (
        <View style={styles.emptyState}>
          <Text style={{ color: '#64748B', fontSize: 13, textAlign: 'center' }}>
            No registered restaurants found. Click "Add Another Restaurant" to register a new store.
          </Text>
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    gap: 12,
    borderRadius: 14,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
  },
  addRestaurantBtn: {
    backgroundColor: BRAND_PRIMARY,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: BRAND_ACCENT,
  },
  addRestaurantBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  loadingBox: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  restaurantRowCard: {
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    gap: 10,
  },
  activeRestaurantRowCard: {
    backgroundColor: '#F0FDF4',
    borderColor: BRAND_PRIMARY,
    borderWidth: 1.5,
  },
  topDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  restoTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    flex: 1,
  },
  activeBadge: {
    backgroundColor: BRAND_PRIMARY,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  activeBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  restoLocationText: {
    fontSize: 12,
    color: '#64748B',
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
    flexWrap: 'wrap',
  },
  badgePill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgePillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  cuisinePill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  cuisinePillText: {
    fontSize: 10,
    color: '#475569',
    fontWeight: '500',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
    flexWrap: 'wrap',
  },
  onlineTogglePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  toggleDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  toggleText: {
    fontSize: 12,
    fontWeight: '700',
  },
  switchBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: BRAND_PRIMARY,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  switchBtnText: {
    color: BRAND_PRIMARY,
    fontSize: 12,
    fontWeight: '700',
  },
  currentActivePill: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  currentActivePillText: {
    color: '#15803D',
    fontSize: 12,
    fontWeight: '700',
  },
  auxBtn: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#93C5FD',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  auxBtnText: {
    color: '#1D4ED8',
    fontSize: 11,
    fontWeight: '700',
  },
  emptyState: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
