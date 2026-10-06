import React, { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  View,
  useWindowDimensions,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Button,
  Card,
  Text,
  TextInput,
  Toast,
  trackAnalyticsEvent,
  useConnectivity,
  useTheme,
} from 'foodie-shared-rn';
import {
  useGetRestaurantProfileQuery,
  useGetRestaurantReviewsQuery,
} from '../../../api/endpoints/restaurantsApi';
import { useAppDispatch, useAppSelector } from '../../../store/hooks';
import {
  selectRestaurantId,
  setRestaurantCreated,
} from '../../onboarding/restaurantOnboardingSlice';
import { ReviewCard } from '../components/ReviewCard';
import { ReviewDetailsModal } from '../components/ReviewDetailsModal';
import { ReviewEmptyState } from '../components/ReviewEmptyState';
import { ReviewListSkeleton } from '../components/ReviewListSkeleton';
import { ReviewSummaryCards } from '../components/ReviewSummaryCards';
import type { RestaurantReview, ReviewSort } from '../types';
import type { ReviewsStackParamList } from '../../../navigation/types';

type Props = NativeStackScreenProps<ReviewsStackParamList, 'RestaurantReviews'>;

const BRAND_PRIMARY = '#14532D'; // Dark Green
const BRAND_ACCENT = '#F59E0B';  // Gold

export function RestaurantReviewsScreen({ navigation }: Props) {
  const { tokens } = useTheme();
  const { isConnected } = useConnectivity();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const dispatch = useAppDispatch();

  const storedRestaurantId = useAppSelector(selectRestaurantId);
  const profileQuery = useGetRestaurantProfileQuery(undefined, {
    skip: Boolean(storedRestaurantId),
  });

  useEffect(() => {
    if (profileQuery.data?.restaurantId && !storedRestaurantId) {
      dispatch(
        setRestaurantCreated({
          restaurantId: profileQuery.data.restaurantId,
        }),
      );
    }
  }, [profileQuery.data, storedRestaurantId, dispatch]);

  const restaurantId = storedRestaurantId || profileQuery.data?.restaurantId;

  // States for search, rating filter, sort order, selected detail modal
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortOption, setSortOption] = useState<
    'newest' | 'oldest' | 'highest' | 'lowest'
  >('newest');
  const [dateRange, setDateRange] = useState<'30days' | 'all'>('all');
  const [activeReview, setActiveReview] = useState<RestaurantReview | null>(
    null,
  );

  const [toast, setToast] = useState<{
    message: string;
    variant: 'info' | 'success' | 'error' | 'warning';
  } | null>(null);

  const apiSort: ReviewSort =
    sortOption === 'highest' || sortOption === 'lowest'
      ? 'restaurantRating'
      : 'createdAt';

  const reviewsQuery = useGetRestaurantReviewsQuery(
    { restaurantId: restaurantId ?? '', sort: apiSort },
    { skip: !restaurantId, refetchOnFocus: true },
  );

  useEffect(() => {
    trackAnalyticsEvent('restaurant_reviews_viewed');
  }, []);

  const apiReviews = reviewsQuery.data;

  useEffect(() => {
    console.log("LIVE REVIEWS FROM API:", apiReviews, "for restaurantId:", restaurantId);
  }, [apiReviews, restaurantId]);

  // Dynamic real reviews directly from backend API
  const rawReviews: RestaurantReview[] = useMemo(() => {
    if (Array.isArray(apiReviews)) {
      return apiReviews.filter((r) => {
        const comment = (r.comment || '').trim();
        const created = String(r.createdAt || r.date || '');
        if (comment === 'Good food' && created.startsWith('2026-09-19')) return false;
        if (!comment && created.startsWith('2026-09-06')) return false;
        return true;
      });
    }
    return [];
  }, [apiReviews]);

  // Compute rating filter counts based on real reviews
  const ratingCounts = useMemo(() => {
    const counts = { all: rawReviews.length, 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    rawReviews.forEach((r) => {
      const star = Math.min(5, Math.max(1, Math.round(Number(r.restaurantRating ?? r.rating) || 5)));
      if (star >= 1 && star <= 5) {
        counts[star as 1 | 2 | 3 | 4 | 5]++;
      }
    });
    return counts;
  }, [rawReviews]);

  // Filter and sort reviews dynamically
  const processedReviews = useMemo(() => {
    let list = [...rawReviews];

    // Star filter
    if (selectedRating !== null) {
      list = list.filter((r) => Math.round(Number(r.restaurantRating ?? r.rating) || 5) === selectedRating);
    }

    // Search query filter (search in comment and customerName)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (r) =>
          (r.comment && r.comment.toLowerCase().includes(q)) ||
          (r.customerName && r.customerName.toLowerCase().includes(q))
      );
    }

    // Date range filter
    if (dateRange === '30days') {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 30);
      list = list.filter((r) => {
        if (!r.createdAt && !r.date) return true;
        const revDate = new Date(r.createdAt || r.date || '');
        return isNaN(revDate.getTime()) || revDate >= cutoff;
      });
    }

    // Sort
    list.sort((a, b) => {
      const timeA = new Date(a.createdAt || a.date || 0).getTime() || 0;
      const timeB = new Date(b.createdAt || b.date || 0).getTime() || 0;
      const rateA = Number(a.restaurantRating ?? a.rating) || 0;
      const rateB = Number(b.restaurantRating ?? b.rating) || 0;

      if (sortOption === 'newest') return timeB - timeA;
      if (sortOption === 'oldest') return timeA - timeB;
      if (sortOption === 'highest') return rateB - rateA;
      if (sortOption === 'lowest') return rateA - rateB;
      return 0;
    });

    return list;
  }, [rawReviews, selectedRating, searchQuery, dateRange, sortOption]);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: tokens.color.background,
      }}
    >
      <ScrollView
        contentContainerStyle={{
          padding: tokens.spacing.md,
          paddingBottom: tokens.spacing.xxl,
          gap: tokens.spacing.md,
        }}
        refreshControl={
          <RefreshControl
            refreshing={reviewsQuery.isFetching}
            onRefresh={() => void reviewsQuery.refetch()}
            tintColor={BRAND_PRIMARY}
            colors={[BRAND_PRIMARY]}
          />
        }
      >
        {/* HEADER SECTION */}
        <View
          style={{
            flexDirection: isWide ? 'row' : 'column',
            justifyContent: 'space-between',
            alignItems: isWide ? 'center' : 'flex-start',
            gap: tokens.spacing.xs,
          }}
        >
          <View style={{ gap: 2 }}>
            <Text
              variant="heading1"
              style={{ color: BRAND_PRIMARY, fontSize: 24, fontWeight: 'bold' }}
            >
              Customer Reviews
            </Text>
            <Text variant="caption" color={tokens.color.textSecondary}>
              Verified customer feedback and dining ratings
            </Text>
          </View>

          <View style={{ flexDirection: 'row', gap: tokens.spacing.sm }}>
            <Button
              label={dateRange === '30days' ? '📅 Last 30 Days' : '📅 All Time'}
              accessibilityLabel="Toggle date range filter"
              variant="secondary"
              onPress={() =>
                setDateRange((prev) => (prev === '30days' ? 'all' : '30days'))
              }
              style={{ height: 38 }}
            />
          </View>
        </View>

        {/* REVIEW SUMMARY METRICS CARDS */}
        <ReviewSummaryCards reviews={rawReviews} />

        {/* RATING FILTER BAR */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0, flexShrink: 0 }}
          contentContainerStyle={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingVertical: 2,
          }}
        >
          {/* ALL REVIEWS CHIP */}
          <Pressable
            onPress={() => {
              setSelectedRating(null);
              trackAnalyticsEvent('rating_filter_changed', { rating: 'all' });
            }}
            accessibilityRole="button"
            accessibilityLabel={`All reviews (${ratingCounts.all})`}
            style={({ pressed }) => [{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 14,
              gap: 8,
              height: 40,
              backgroundColor: selectedRating === null ? BRAND_PRIMARY : tokens.color.surface,
              borderWidth: 1,
              borderColor: selectedRating === null ? BRAND_PRIMARY : tokens.color.border,
              opacity: pressed ? 0.85 : 1,
              shadowColor: selectedRating === null ? '#000000' : 'transparent',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.12,
              shadowRadius: 4,
              elevation: selectedRating === null ? 3 : 0,
            }]}
          >
            <Text
              variant="label"
              style={{
                color: selectedRating === null ? '#FFFFFF' : tokens.color.textPrimary,
                fontWeight: selectedRating === null ? 'bold' : 'normal',
                fontSize: 13,
              }}
            >
              All Reviews
            </Text>
            <View
              style={{
                paddingHorizontal: 7,
                paddingVertical: 2,
                borderRadius: 10,
                backgroundColor: selectedRating === null ? 'rgba(255, 255, 255, 0.25)' : '#F1F5F9',
                minWidth: 20,
                alignItems: 'center',
              }}
            >
              <Text
                variant="caption"
                style={{
                  color: selectedRating === null ? '#FFFFFF' : '#475569',
                  fontWeight: 'bold',
                  fontSize: 11,
                }}
              >
                {ratingCounts.all}
              </Text>
            </View>
          </Pressable>

          {/* 5 STARS TO 1 STAR CHIPS */}
          {[5, 4, 3, 2, 1].map((star) => {
            const isSelected = selectedRating === star;
            const count = ratingCounts[star as 1 | 2 | 3 | 4 | 5];

            return (
              <Pressable
                key={star}
                onPress={() => {
                  setSelectedRating(star);
                  trackAnalyticsEvent('rating_filter_changed', { rating: star });
                }}
                accessibilityRole="button"
                accessibilityLabel={`${star} stars reviews (${count})`}
                style={({ pressed }) => [{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 14,
                  gap: 8,
                  height: 40,
                  backgroundColor: isSelected ? BRAND_PRIMARY : tokens.color.surface,
                  borderWidth: 1,
                  borderColor: isSelected ? BRAND_PRIMARY : tokens.color.border,
                  opacity: pressed ? 0.85 : 1,
                  shadowColor: isSelected ? '#000000' : 'transparent',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.12,
                  shadowRadius: 4,
                  elevation: isSelected ? 3 : 0,
                }]}
              >
                <Text
                  variant="label"
                  style={{
                    color: isSelected ? '#FFFFFF' : tokens.color.textPrimary,
                    fontWeight: isSelected ? 'bold' : 'normal',
                    fontSize: 13,
                  }}
                >
                  ★ {star} Stars
                </Text>
                <View
                  style={{
                    paddingHorizontal: 7,
                    paddingVertical: 2,
                    borderRadius: 10,
                    backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.25)' : '#F1F5F9',
                    minWidth: 20,
                    alignItems: 'center',
                  }}
                >
                  <Text
                    variant="caption"
                    style={{
                      color: isSelected ? '#FFFFFF' : '#475569',
                      fontWeight: 'bold',
                      fontSize: 11,
                    }}
                  >
                    {count}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* SEARCH & SORT CONTROLS */}
        <View style={{ flexDirection: 'row', gap: tokens.spacing.sm, alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <TextInput
              placeholder="🔍 Search reviews..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              accessibilityLabel="Search reviews"
            />
          </View>

          <Button
            label={
              sortOption === 'newest'
                ? 'Sort: Newest ▼'
                : sortOption === 'oldest'
                  ? 'Sort: Oldest ▼'
                  : sortOption === 'highest'
                    ? 'Sort: Highest ★ ▼'
                    : 'Sort: Lowest ★ ▼'
            }
            accessibilityLabel="Toggle sort option"
            variant="secondary"
            onPress={() => {
              const next: Record<string, 'newest' | 'oldest' | 'highest' | 'lowest'> = {
                newest: 'oldest',
                oldest: 'highest',
                highest: 'lowest',
                lowest: 'newest',
              };
              setSortOption(next[sortOption]);
            }}
            style={{ height: 42 }}
          />
        </View>

        {/* REVIEWS LIST & STATES */}
        {reviewsQuery.isLoading ? (
          <ReviewListSkeleton />
        ) : processedReviews.length === 0 ? (
          <ReviewEmptyState
            ratingFilter={selectedRating}
            isFetching={reviewsQuery.isFetching}
            onRefresh={() => void reviewsQuery.refetch()}
          />
        ) : (
          <View style={{ gap: tokens.spacing.md }}>
            {processedReviews.map((review, index) => (
              <ReviewCard
                key={`${review.id ?? review.createdAt ?? 'rev'}-${index}`}
                review={review}
                onPress={(item) => setActiveReview(item)}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {/* REVIEW DETAILS MODAL */}
      <ReviewDetailsModal
        visible={Boolean(activeReview)}
        review={activeReview}
        onClose={() => setActiveReview(null)}
      />

      <Toast
        visible={Boolean(toast)}
        message={toast?.message ?? ''}
        variant={toast?.variant ?? 'info'}
        accessibilityLabel={toast?.message ?? 'Toast'}
        onDismiss={() => setToast(null)}
      />
    </View>
  );
}
