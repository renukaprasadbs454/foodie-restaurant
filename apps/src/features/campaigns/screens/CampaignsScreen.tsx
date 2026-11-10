import React, { useState, useRef } from 'react';
import {
  View,
  ScrollView,
  Switch,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { Text } from 'foodie-shared-rn';
import {
  useGetRestaurantCouponsQuery,
  useToggleCouponStatusMutation,
  type RestaurantCoupon,
  formatValidityDate,
  resolveRestaurantZone,
} from '../../../api/endpoints/couponsApi';
import { useGetRestaurantProfileQuery } from '../../../api/endpoints/restaurantsApi';

export const CampaignsScreen = () => {
  const {
    data: profile,
    isLoading: isProfileLoading,
    refetch: refetchProfile,
  } = useGetRestaurantProfileQuery();

  const restaurantId = profile?.restaurantId || '';
  const restaurantZone = resolveRestaurantZone(profile);

  const {
    data: coupons = [],
    isLoading: isCouponsLoading,
    isFetching,
    refetch: refetchCoupons,
  } = useGetRestaurantCouponsQuery(
    { restaurantId, zoneId: restaurantZone },
    {
      skip: !restaurantId,
      pollingInterval: 15000,
      refetchOnFocus: true,
      refetchOnReconnect: true,
    },
  );

  const [toggleCoupon] = useToggleCouponStatusMutation();

  // Prevent multiple clicks while a request is processing
  const [updatingIds, setUpdatingIds] = useState<Record<string, boolean>>({});
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    text: string;
    type: 'success' | 'error';
  } | null>(null);

  const messageTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showNotification = (text: string, type: 'success' | 'error') => {
    if (messageTimeoutRef.current) {
      clearTimeout(messageTimeoutRef.current);
    }
    setStatusMessage({ text, type });
    messageTimeoutRef.current = setTimeout(() => {
      setStatusMessage(null);
    }, 3500);
  };

  const handleToggle = async (coupon: RestaurantCoupon, nextActive: boolean) => {
    if (!restaurantId) return;

    const id = coupon.couponId || coupon.code;

    // Prevent duplicate clicks if already processing
    if (updatingIds[id]) {
      return;
    }

    setUpdatingIds((prev) => ({ ...prev, [id]: true }));

    try {
      // RTK Query optimistic update will immediately reflect the new state in the UI.
      // We await query confirmation before displaying success notification.
      await toggleCoupon({
        couponId: coupon.couponId,
        isActive: nextActive,
        restaurantId,
        zoneId: restaurantZone,
      }).unwrap();

      const actionText = nextActive ? 'enabled' : 'disabled';
      showNotification(
        `Coupon "${coupon.code}" ${actionText} successfully. Changes are live for customers.`,
        'success',
      );
    } catch {
      // On error, RTK Query automatically rolls back the optimistic update
      Alert.alert(
        'Update Failed',
        'Could not update coupon status. The previous status has been restored. Please check your connection and try again.',
      );
      showNotification(`Failed to update "${coupon.code}". Previous status restored.`, 'error');
    } finally {
      setUpdatingIds((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  const onRefresh = async () => {
    setIsManualRefreshing(true);
    try {
      await Promise.all([refetchProfile(), refetchCoupons()]);
    } finally {
      setIsManualRefreshing(false);
    }
  };

  const isLoading = isProfileLoading || (Boolean(restaurantId) && isCouponsLoading);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl refreshing={isManualRefreshing} onRefresh={onRefresh} colors={['#16A34A']} />
      }
    >
      {/* Header Section */}
      <View style={styles.header}>
        <Text style={styles.title}>Restaurant Promos</Text>
        <Text style={styles.subtitle}>
          Admin-created coupons assigned to your restaurant. Toggle availability for customer orders.
        </Text>
      </View>

      {/* Dynamic Status Feedback Notification Banner */}
      {statusMessage && (
        <TouchableOpacity
          onPress={() => setStatusMessage(null)}
          style={[
            styles.notificationBanner,
            statusMessage.type === 'success'
              ? styles.notificationSuccess
              : styles.notificationError,
          ]}
        >
          <Text style={styles.notificationIcon}>
            {statusMessage.type === 'success' ? '✓' : '⚠️'}
          </Text>
          <Text
            style={[
              styles.notificationText,
              statusMessage.type === 'success'
                ? styles.notificationTextSuccess
                : styles.notificationTextError,
            ]}
          >
            {statusMessage.text}
          </Text>
        </TouchableOpacity>
      )}

      {/* Admin Control Notice */}
      <View style={styles.infoBanner}>
        <Text style={styles.infoBannerIcon}>🛡️</Text>
        <Text style={styles.infoBannerText}>
          Coupon parameters (discount values, limits, and validity dates) are controlled by Admin.
          Restaurant users can only enable or disable coupons.
        </Text>
      </View>

      {/* Loading State */}
      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#16A34A" />
          <Text style={styles.loadingText}>Loading assigned promos...</Text>
        </View>
      ) : !restaurantId ? (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyTitle}>Restaurant Not Available</Text>
          <Text style={styles.emptySubtitle}>
            Unable to resolve restaurant profile. Please check your login credentials.
          </Text>
        </View>
      ) : coupons.length === 0 ? (
        /* Empty State */
        <View style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>🏷️</Text>
          <Text style={styles.emptyTitle}>No Assigned Coupons</Text>
          <Text style={styles.emptySubtitle}>
            No coupons have been assigned to your restaurant by Admin yet. When Admin creates a
            coupon for your store, it will appear here for you to enable or disable.
          </Text>
        </View>
      ) : (
        /* Coupon List */
        <View style={styles.couponList}>
          {coupons.map((coupon) => {
            const isPercent = coupon.discountType === 'PERCENT';
            const couponKey = coupon.couponId || coupon.code;
            const isUpdating = Boolean(updatingIds[couponKey]);
            const discountLabel = isPercent
              ? `${coupon.value}% OFF`
              : `₹${coupon.value} FLAT OFF`;
            const discountTypeLabel = isPercent
              ? 'Percentage Discount'
              : 'Fixed Amount Discount';

            return (
              <View
                key={couponKey}
                style={[
                  styles.couponCard,
                  !coupon.isActive && styles.couponCardDisabled,
                ]}
              >
                {/* Coupon Header: Code & Status */}
                <View style={styles.cardHeader}>
                  <View style={styles.codeContainer}>
                    <Text style={styles.codeText}>{coupon.code}</Text>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      coupon.isActive
                        ? styles.statusBadgeActive
                        : styles.statusBadgeInactive,
                    ]}
                  >
                    <View
                      style={[
                        styles.statusDot,
                        coupon.isActive
                          ? styles.statusDotActive
                          : styles.statusDotInactive,
                      ]}
                    />
                    <Text
                      style={[
                        styles.statusText,
                        coupon.isActive
                          ? styles.statusTextActive
                          : styles.statusTextInactive,
                      ]}
                    >
                      {coupon.isActive ? 'ACTIVE' : 'DISABLED'}
                    </Text>
                  </View>
                </View>

                {coupon.title ? (
                  <Text style={styles.couponTitleText}>{coupon.title}</Text>
                ) : null}

                {/* Coupon Details Grid */}
                <View style={styles.detailsGrid}>
                  {/* Row 1 */}
                  <View style={styles.detailRow}>
                    <View style={styles.detailColumn}>
                      <Text style={styles.detailLabel}>Discount</Text>
                      <Text style={styles.detailValuePrimary}>{discountLabel}</Text>
                      <Text style={styles.detailSubLabel}>{discountTypeLabel}</Text>
                    </View>

                    <View style={styles.detailColumn}>
                      <Text style={styles.detailLabel}>Min Order Amount</Text>
                      <Text style={styles.detailValue}>
                        {coupon.minOrderAmount > 0 ? `₹${coupon.minOrderAmount}` : 'No Minimum'}
                      </Text>
                    </View>
                  </View>

                  {/* Row 2 */}
                  <View style={styles.detailRow}>
                    <View style={styles.detailColumn}>
                      <Text style={styles.detailLabel}>Max Discount Amount</Text>
                      <Text style={styles.detailValue}>
                        {coupon.maxDiscountAmount ? `₹${coupon.maxDiscountAmount}` : 'No Maximum Cap'}
                      </Text>
                    </View>

                    <View style={styles.detailColumn}>
                      <Text style={styles.detailLabel}>Validity Period</Text>
                      <Text style={styles.detailValue}>
                        Valid till {formatValidityDate(coupon.expiryDate)}
                      </Text>
                    </View>
                  </View>

                  {/* Row 3: Admin % & Restaurant % Share */}
                  <View style={styles.detailRow}>
                    <View style={styles.detailColumn}>
                      <Text style={styles.detailLabel}>Admin Share</Text>
                      <Text style={[styles.detailValue, { color: '#2563EB', fontWeight: '700' }]}>
                        {coupon.adminDiscount != null
                          ? (coupon.discountType === 'PERCENT' ? `${coupon.adminDiscount}%` : `₹${coupon.adminDiscount}`)
                          : (coupon.discountType === 'PERCENT' ? `${Math.round(coupon.value / 2)}%` : `₹${Math.round(coupon.value / 2)}`)}
                      </Text>
                      <Text style={styles.detailSubLabel}>Platform Absorbed</Text>
                    </View>

                    <View style={styles.detailColumn}>
                      <Text style={styles.detailLabel}>Restaurant Share</Text>
                      <Text style={[styles.detailValue, { color: '#D97706', fontWeight: '700' }]}>
                        {coupon.restaurantDiscount != null
                          ? (coupon.discountType === 'PERCENT' ? `${coupon.restaurantDiscount}%` : `₹${coupon.restaurantDiscount}`)
                          : (coupon.discountType === 'PERCENT' ? `${Math.round(coupon.value - Math.round(coupon.value / 2))}%` : `₹${Math.round(coupon.value - Math.round(coupon.value / 2))}`)}
                      </Text>
                      <Text style={styles.detailSubLabel}>Co-Funded Deducted</Text>
                    </View>
                  </View>
                </View>

                {/* Co-funded Promo Sharing Note */}
                <View style={{
                  backgroundColor: '#F0FDF4',
                  borderColor: '#DCFCE7',
                  borderWidth: 1,
                  borderRadius: 8,
                  padding: 8,
                  marginBottom: 10,
                }}>
                  <Text style={{ fontSize: 11, color: '#166534', lineHeight: 15 }}>
                    🤝 Zomato & Swiggy Model: Restaurant share ({coupon.restaurantDiscount != null ? `${coupon.restaurantDiscount}%` : `${Math.round(coupon.value / 2)}%`}) is deducted from order settlement only when customer orders with this coupon.
                  </Text>
                </View>

                {/* Footer Controls */}
                <View style={styles.cardFooter}>
                  <View style={styles.adminTag}>
                    <Text style={styles.adminTagText}>🔒 Admin-Controlled</Text>
                  </View>

                  <View style={styles.toggleRow}>
                    <Text style={styles.toggleLabel}>
                      {coupon.isActive ? 'Enabled for Customers' : 'Disabled for Customers'}
                    </Text>
                    {isUpdating && (
                      <ActivityIndicator
                        size="small"
                        color={coupon.isActive ? '#16A34A' : '#9CA3AF'}
                        style={{ marginLeft: 8 }}
                      />
                    )}
                    <Switch
                      value={coupon.isActive}
                      onValueChange={(val) => handleToggle(coupon, val)}
                      disabled={isUpdating}
                      trackColor={{ false: '#D1D5DB', true: '#86EFAC' }}
                      thumbColor={coupon.isActive ? '#16A34A' : '#9CA3AF'}
                      style={{ marginLeft: 8 }}
                    />
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
    lineHeight: 20,
  },
  notificationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
  },
  notificationSuccess: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  notificationError: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  notificationIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  notificationText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  notificationTextSuccess: {
    color: '#065F46',
  },
  notificationTextError: {
    color: '#991B1B',
  },
  infoBanner: {
    flexDirection: 'row',
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    alignItems: 'flex-start',
  },
  infoBannerIcon: {
    fontSize: 18,
    marginRight: 10,
    marginTop: 1,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 13,
    color: '#1E40AF',
    lineHeight: 18,
  },
  centerContainer: {
    paddingVertical: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 12,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: '#E5E7EB',
    borderWidth: 1,
    marginTop: 12,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 320,
  },
  couponList: {
    gap: 16,
  },
  couponCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderColor: '#E5E7EB',
    borderWidth: 1,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  couponCardDisabled: {
    backgroundColor: '#FAFAFA',
    borderColor: '#E5E7EB',
    opacity: 0.85,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  codeContainer: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  codeText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#15803D',
    letterSpacing: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeActive: {
    backgroundColor: '#DCFCE7',
  },
  statusBadgeInactive: {
    backgroundColor: '#F3F4F6',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusDotActive: {
    backgroundColor: '#16A34A',
  },
  statusDotInactive: {
    backgroundColor: '#9CA3AF',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusTextActive: {
    color: '#15803D',
  },
  statusTextInactive: {
    color: '#6B7280',
  },
  couponTitleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  detailsGrid: {
    borderTopColor: '#F3F4F6',
    borderTopWidth: 1,
    paddingTop: 12,
    marginBottom: 12,
    gap: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailColumn: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailValuePrimary: {
    fontSize: 16,
    fontWeight: '700',
    color: '#15803D',
  },
  detailSubLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 1,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopColor: '#F3F4F6',
    borderTopWidth: 1,
    paddingTop: 12,
  },
  adminTag: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  adminTagText: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '500',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toggleLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4B5563',
  },
});
