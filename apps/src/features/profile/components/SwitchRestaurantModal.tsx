import React from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Avatar, Text, useTheme } from 'foodie-shared-rn';
import Feather from '@expo/vector-icons/Feather';
import {
  restaurantsApi,
  useGetMyRestaurantsQuery,
} from '../../../api/endpoints/restaurantsApi';
import { useAppDispatch, useAppSelector } from '../../../store/hooks';
import {
  selectRestaurantId,
  setActiveRestaurantId,
  setRestaurantStatus,
} from '../../onboarding/restaurantOnboardingSlice';
import { ENV } from '../../../constants/env';

type Props = {
  visible: boolean;
  onClose: () => void;
  onAddAnotherRestaurant?: () => void;
  onSelectRestaurant?: (resto: any) => void;
};

const BRAND_PRIMARY = '#14532D';
const BRAND_ACCENT = '#F59E0B';

export function SwitchRestaurantModal({
  visible,
  onClose,
  onAddAnotherRestaurant,
  onSelectRestaurant,
}: Props) {
  const { tokens } = useTheme();
  const dispatch = useAppDispatch();
  const currentActiveId = useAppSelector(selectRestaurantId);
  const { data: myRestaurants, isLoading, refetch } = useGetMyRestaurantsQuery(
    undefined,
    { skip: !visible, refetchOnFocus: true }
  );
  const restaurantsList: any[] = Array.isArray(myRestaurants) ? myRestaurants : [];

  const handleSelectRestaurant = (resto: any) => {
    if (resto.restaurantId && resto.restaurantId !== currentActiveId) {
      dispatch(setActiveRestaurantId(resto.restaurantId));
      if (resto.status) {
        dispatch(setRestaurantStatus(resto.status));
      }
      dispatch(
        restaurantsApi.util.invalidateTags([
          { type: 'Restaurant', id: 'LIST' },
          { type: 'Restaurant' as any, id: 'MY_LIST' },
          { type: 'Restaurant', id: resto.restaurantId },
          { type: 'Order' as any, id: 'LIST' },
          { type: 'Order' as any, id: 'ACTIVE_CHECK' },
          { type: 'Menu' as any, id: 'LIST' },
          { type: 'Review' as any, id: 'LIST' },
          { type: 'Coupon' as any, id: 'LIST' },
        ])
      );
    }
    onClose();
    onSelectRestaurant?.(resto);
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
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={styles.headerIcon}>
                <Feather name="repeat" size={18} color={BRAND_PRIMARY} />
              </View>
              <View>
                <Text style={styles.title}>Switch Restaurant</Text>
                <Text style={styles.subtitle}>Select active restaurant portal</Text>
              </View>
            </View>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close switch restaurant modal"
              style={({ pressed }) => [
                styles.closeButton,
                pressed && { backgroundColor: '#F1F5F9' },
              ]}
            >
              <Feather name="x" size={20} color="#64748B" />
            </Pressable>
          </View>

          {/* List of Restaurants */}
          <ScrollView
            style={styles.scrollList}
            contentContainerStyle={{ padding: 16, gap: 12 }}
            showsVerticalScrollIndicator={false}
          >
            {isLoading && restaurantsList.length === 0 ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={BRAND_PRIMARY} />
                <Text style={styles.loadingText}>Loading your restaurants…</Text>
              </View>
            ) : restaurantsList.length > 0 ? (
              restaurantsList.map((resto: any) => {
                const isActive = resto.restaurantId === currentActiveId;
                const badge = getStatusBadge(resto.status);
                const isOnline = Boolean(resto.isOpen);
                const logoUri = resto.logoImageUrl
                  ? resto.logoImageUrl.startsWith('/api')
                    ? `${ENV.apiBaseUrl}${resto.logoImageUrl}`
                    : resto.logoImageUrl
                  : null;

                const locationStr =
                  resto.address?.city ||
                                    resto.address?.line1 ||
                  'Location not set';

                return (
                  <Pressable
                    key={resto.restaurantId}
                    onPress={() => handleSelectRestaurant(resto)}
                    accessibilityRole="button"
                    accessibilityLabel={`Switch to ${resto.name}`}
                    style={({ pressed }) => [
                      styles.restaurantItem,
                      isActive && styles.activeRestaurantItem,
                      pressed && styles.pressedRestaurantItem,
                    ]}
                  >
                    <View style={styles.itemRow}>
                      <Avatar
                        uri={logoUri}
                        initials={(resto.name || 'R').slice(0, 2).toUpperCase()}
                        size={48}
                        accessibilityLabel={resto.name}
                      />

                      <View style={{ flex: 1, gap: 4 }}>
                        <View style={styles.nameRow}>
                          <Text style={styles.restoName} numberOfLines={1}>
                            {resto.name}
                          </Text>
                          {isActive && (
                            <View style={styles.activePill}>
                              <Text style={styles.activePillText}>Active</Text>
                            </View>
                          )}
                        </View>

                        <Text style={styles.restoLocation} numberOfLines={1}>
                          📍 {locationStr}
                        </Text>

                        {/* Badges: Status and Online/Offline */}
                        <View style={styles.badgeRow}>
                          <View
                            style={[
                              styles.statusBadge,
                              { backgroundColor: badge.bg },
                            ]}
                          >
                            <Text
                              style={[
                                styles.statusBadgeText,
                                { color: badge.text },
                              ]}
                            >
                              {badge.label}
                            </Text>
                          </View>

                          <View
                            style={[
                              styles.onlineBadge,
                              {
                                backgroundColor: isOnline ? '#DCFCE7' : '#F1F5F9',
                                borderColor: isOnline ? '#86EFAC' : '#CBD5E1',
                              },
                            ]}
                          >
                            <View
                              style={[
                                styles.onlineDot,
                                { backgroundColor: isOnline ? '#16A34A' : '#94A3B8' },
                              ]}
                            />
                            <Text
                              style={[
                                styles.onlineText,
                                { color: isOnline ? '#15803D' : '#64748B' },
                              ]}
                            >
                              {isOnline ? 'Online' : 'Offline'}
                            </Text>
                          </View>
                        </View>
                      </View>

                      {isActive ? (
                        <View style={styles.checkIconCircle}>
                          <Feather name="check" size={16} color="#FFFFFF" />
                        </View>
                      ) : (
                        <Feather name="chevron-right" size={20} color="#94A3B8" />
                      )}
                    </View>
                  </Pressable>
                );
              })
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No restaurants registered yet.</Text>
              </View>
            )}
          </ScrollView>

          {/* Footer Action: Add Another Restaurant */}
          <View style={styles.footer}>
            <Pressable
              onPress={() => {
                onClose();
                onAddAnotherRestaurant?.();
              }}
              accessibilityRole="button"
              accessibilityLabel="Add Another Restaurant"
              style={({ pressed }) => [
                styles.addAnotherButton,
                pressed && { opacity: 0.9 },
              ]}
            >
              <Feather name="plus-circle" size={18} color="#FFFFFF" />
              <Text style={styles.addAnotherButtonText}>
                Add Another Restaurant
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    maxHeight: '85%',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 12,
    color: '#64748B',
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollList: {
    maxHeight: 400,
  },
  loadingContainer: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    color: '#64748B',
  },
  emptyContainer: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#64748B',
  },
  restaurantItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    padding: 14,
  },
  activeRestaurantItem: {
    borderColor: BRAND_PRIMARY,
    backgroundColor: '#F0FDF4',
  },
  pressedRestaurantItem: {
    backgroundColor: '#F8FAFC',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  restoName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    flex: 1,
  },
  activePill: {
    backgroundColor: BRAND_PRIMARY,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  activePillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  restoLocation: {
    fontSize: 12,
    color: '#64748B',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  onlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  onlineText: {
    fontSize: 11,
    fontWeight: '700',
  },
  checkIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: BRAND_PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderColor: '#F1F5F9',
    backgroundColor: '#F8FAFC',
  },
  addAnotherButton: {
    backgroundColor: BRAND_PRIMARY,
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addAnotherButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
