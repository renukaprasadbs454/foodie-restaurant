import type { RestaurantReview } from '../features/reviews/types';

export type ExtendedRestaurantReview = RestaurantReview & {
  reviewId: string;
  customerName: string;
  verified: boolean;
  orderInfo: string;
  itemInfo: string;
};

export const MOCK_REVIEWS: ExtendedRestaurantReview[] = [];

export function getMockReviews(): ExtendedRestaurantReview[] {
  return [];
}
