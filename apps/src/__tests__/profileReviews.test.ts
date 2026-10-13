import { validateProfileForm, calculateProfileRating } from '../features/profile/types';
import { isReviewSort } from '../features/reviews/types';

describe('profile + reviews helpers (P2-RES-04)', () => {
  it('validates profile PUT payload without commission', () => {
    const result = validateProfileForm({
      name: 'Spice Hub',
      description: 'South Indian',
      cuisineTypes: ['SOUTH_INDIAN'],
      line1: '12 MG Road',
      line2: '',
      city: 'Bengaluru',
      pincode: '560001',
      latitude: '12.97',
      longitude: '77.59',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.name).toBe('Spice Hub');
      expect(
        'commissionPct' in (result.value as Record<string, unknown>),
      ).toBe(false);
    }
  });

  it('whitelists review sort fields', () => {
    expect(isReviewSort('createdAt')).toBe(true);
    expect(isReviewSort('restaurantRating')).toBe(true);
    expect(isReviewSort('totalAmount')).toBe(false);
  });

  it('calculates dynamic profile rating from reviews collection', () => {
    const reviews = [
      { restaurantRating: 5, rating: 5 },
      { restaurantRating: 4, rating: 4 },
      { restaurantRating: 3, rating: 3 },
    ];
    const result = calculateProfileRating(reviews);
    expect(result.averageRating).toBe(4.0);
    expect(result.reviewCount).toBe(3);
    expect(result.ratingDisplay).toBe('4 (3 reviews)');
  });

  it('handles single review with singular "review" display', () => {
    const reviews = [{ restaurantRating: 5 }];
    const result = calculateProfileRating(reviews);
    expect(result.averageRating).toBe(5);
    expect(result.reviewCount).toBe(1);
    expect(result.ratingDisplay).toBe('5 (1 review)');
  });

  it('displays 0 (0 reviews) when there are no reviews', () => {
    const result = calculateProfileRating([]);
    expect(result.averageRating).toBe(0);
    expect(result.reviewCount).toBe(0);
    expect(result.ratingDisplay).toBe('0 (0 reviews)');
  });

  it('falls back to profile API counts when reviews list is absent', () => {
    const profile = { avgRating: 4.5, reviewCount: 8 };
    const result = calculateProfileRating(null, profile);
    expect(result.averageRating).toBe(4.5);
    expect(result.reviewCount).toBe(8);
    expect(result.ratingDisplay).toBe('4.5 (8 reviews)');
  });
});
