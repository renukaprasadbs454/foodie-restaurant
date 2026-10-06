/**
 * P2-RES-04 restaurant reviews (read-only) — UI-API RestaurantReviews §12.2.
 */

export type RestaurantReview = {
  id?: string;
  orderId?: string;
  customerId?: string;
  customerName?: string;
  restaurantRating: number;
  rating?: number;
  deliveryRating?: number | null;
  comment?: string | null;
  createdAt?: string;
  date?: string;
  verified?: boolean;
  itemInfo?: string;
};

export type ReviewSort = 'createdAt' | 'restaurantRating';

export const REVIEW_SORT_WHITELIST: readonly ReviewSort[] = [
  'createdAt',
  'restaurantRating',
] as const;

export const DEFAULT_REVIEWS_PAGE_SIZE = 20;

export type RestaurantReviewsParams = {
  restaurantId: string;
  page?: number;
  size?: number;
  sort?: ReviewSort;
};

export function isReviewSort(value: string): value is ReviewSort {
  return (REVIEW_SORT_WHITELIST as readonly string[]).includes(value);
}
