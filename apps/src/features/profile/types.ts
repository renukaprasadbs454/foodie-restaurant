/**
 * P2-RES-04 profile update — UI-API Restaurant Profile + UpdateRestaurantRequestDto.
 */

import type { RegisterRestaurantRequest } from '../onboarding/types';
import { validateRegistrationForm } from '../onboarding/types';

export type UpdateRestaurantProfileRequest = RegisterRestaurantRequest;

/** PUT profile validation — same §3.3 rules; commission omitted. */
export function validateProfileForm(input: {
  name: string;
  description: string;
  cuisineTypes: string[];
  line1: string;
  line2: string;
  city: string;
  pincode: string;
  latitude: string;
  longitude: string;
}):
  | { ok: true; value: UpdateRestaurantProfileRequest }
  | { ok: false; message: string } {
  return validateRegistrationForm(input);
}


export type ProfileRatingSummary = {
  ratingDisplay: string;
  averageRating: number;
  reviewCount: number;
};

/**
 * Calculates dynamic profile rating from reviews collection or profile API response.
 * Formula: averageRating = sum(all review.ratings) / totalReviews.
 * If no reviews, returns "0 (0 reviews)".
 */
export function calculateProfileRating(
  reviews?: Array<{ restaurantRating?: number | string | null; rating?: number | string | null }> | null,
  profile?: { avgRating?: number | string | null; averageRating?: number | string | null; reviewCount?: number | null; totalReviews?: number | null } | null
): ProfileRatingSummary {
  if (reviews && Array.isArray(reviews)) {
    const validReviews = reviews.filter((r) =>
      Number.isFinite(Number(r.restaurantRating ?? r.rating))
    );
    const totalReviews = validReviews.length;
    if (totalReviews > 0) {
      const sum = validReviews.reduce(
        (acc, r) => acc + Number(r.restaurantRating ?? r.rating),
        0
      );
      const avg = sum / totalReviews;
      const formattedAvg = avg % 1 === 0 ? String(avg) : avg.toFixed(1);
      return {
        ratingDisplay: `${formattedAvg} (${totalReviews} ${totalReviews === 1 ? 'review' : 'reviews'})`,
        averageRating: Number(avg.toFixed(1)),
        reviewCount: totalReviews,
      };
    } else {
      return {
        ratingDisplay: '0 (0 reviews)',
        averageRating: 0,
        reviewCount: 0,
      };
    }
  }

  const backendCount = Number(
    profile?.reviewCount ?? profile?.totalReviews ?? 0
  );
  const backendRating = Number(
    profile?.avgRating ?? profile?.averageRating ?? 0
  );

  if (backendCount > 0) {
    const formattedAvg = backendRating % 1 === 0 ? String(backendRating) : backendRating.toFixed(1);
    return {
      ratingDisplay: `${formattedAvg} (${backendCount} ${backendCount === 1 ? 'review' : 'reviews'})`,
      averageRating: Number(backendRating.toFixed(1)),
      reviewCount: backendCount,
    };
  }

  if (backendRating > 0) {
    const formattedAvg = backendRating % 1 === 0 ? String(backendRating) : backendRating.toFixed(1);
    return {
      ratingDisplay: `${formattedAvg} (0 reviews)`,
      averageRating: Number(backendRating.toFixed(1)),
      reviewCount: 0,
    };
  }

  return {
    ratingDisplay: '0 (0 reviews)',
    averageRating: 0,
    reviewCount: 0,
  };
}
