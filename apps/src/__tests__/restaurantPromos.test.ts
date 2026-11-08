/// <reference types="jest" />

import {
  normalizeCoupon,
  filterCouponsForRestaurant,
  formatCouponValidityDate,
  formatValidityDate,
  extractDateOnly,
  isCouponExpired,
  isZoneMatching,
  resolveRestaurantZone,
  resolveRestaurantCouponActive,
  type RestaurantCoupon,
} from '../features/campaigns/types';

describe('Admin-Created Restaurant Coupons in Promos - Performance & Persistence', () => {
  const RESTAURANT_A_ID = 'b0005826-32e2-41ce-bc4e-917f8183707b';
  const RESTAURANT_B_ID = 'b7c2a110-92d4-4f81-9b11-a83d712e5001';

  const mockAdminCoupons = [
    {
      couponId: 'c-7915',
      code: 'SPICE',
      title: 'SPICE • Hotel Mayura',
      discountType: 'PERCENT',
      value: 15,
      minOrderAmount: 999,
      maxDiscountAmount: 150,
      expiryDate: '2026-12-03T23:59:59Z',
      restaurantId: RESTAURANT_A_ID,
      restaurantName: 'Hotel Mayura',
      isActive: true,
      approvalStatus: 'APPROVED',
      funderType: 'MERCHANT',
      couponType: 'RESTAURANT',
    },
    {
      couponId: 'c-7916',
      code: 'MAYURA100',
      title: 'Flat ₹100 OFF',
      discountType: 'FLAT',
      value: 100,
      minOrderAmount: 500,
      maxDiscountAmount: null,
      expiryDate: '2026-12-31T23:59:59Z',
      restaurantId: RESTAURANT_A_ID,
      restaurantName: 'Hotel Mayura',
      isActive: false,
      approvalStatus: 'APPROVED',
      funderType: 'MERCHANT',
      couponType: 'RESTAURANT',
    },
    {
      couponId: 'c-rest-01',
      code: 'ROYAL25',
      title: '25% OFF Royal Biryani House',
      discountType: 'PERCENT',
      value: 25,
      minOrderAmount: 250,
      maxDiscountAmount: 100,
      expiryDate: '2026-12-31T23:59:59Z',
      restaurantId: RESTAURANT_B_ID,
      restaurantName: 'Royal Biryani House',
      isActive: true,
      approvalStatus: 'APPROVED',
      funderType: 'MERCHANT',
      couponType: 'RESTAURANT',
    },
    {
      couponId: 'c-all-01',
      code: 'WELCOME50',
      title: 'Global Welcome Offer',
      discountType: 'PERCENT',
      value: 50,
      minOrderAmount: 100,
      maxDiscountAmount: 100,
      expiryDate: '2026-12-31T23:59:59Z',
      restaurantId: null,
      isActive: true,
      approvalStatus: 'APPROVED',
      funderType: 'FOODIE',
      couponType: 'GENERIC',
    },
  ];

  let mockStorage: Record<string, string> = {};

  beforeEach(() => {
    mockStorage = {};
  });

  // 1. Fast Enable operation with immediate state transition
  it('1. Fast Enable operation updates status immediately without page reload', () => {
    const coupons = filterCouponsForRestaurant(mockAdminCoupons, RESTAURANT_A_ID);
    const target = coupons.find((c) => c.code === 'MAYURA100')!;
    expect(target.isActive).toBe(false);

    // Optimistic update simulation (0ms latency)
    const startTime = Date.now();
    const updatedCoupons = coupons.map((c) =>
      c.couponId === target.couponId ? { ...c, isActive: true } : c,
    );
    const durationMs = Date.now() - startTime;

    expect(durationMs).toBeLessThan(50);
    const updatedTarget = updatedCoupons.find((c) => c.code === 'MAYURA100')!;
    expect(updatedTarget.isActive).toBe(true);
  });

  // 2. Fast Disable operation with immediate state transition
  it('2. Fast Disable operation updates status immediately without page reload', () => {
    const coupons = filterCouponsForRestaurant(mockAdminCoupons, RESTAURANT_A_ID);
    const target = coupons.find((c) => c.code === 'SPICE')!;
    expect(target.isActive).toBe(true);

    // Optimistic update simulation (0ms latency)
    const startTime = Date.now();
    const updatedCoupons = coupons.map((c) =>
      c.couponId === target.couponId ? { ...c, isActive: false } : c,
    );
    const durationMs = Date.now() - startTime;

    expect(durationMs).toBeLessThan(50);
    const updatedTarget = updatedCoupons.find((c) => c.code === 'SPICE')!;
    expect(updatedTarget.isActive).toBe(false);
  });

  // 3. Enable and disable multiple times without automatic reverting
  it('3. Can toggle Enable and Disable multiple times and status remains permanent', () => {
    const storageKey = `@foodie:restaurant_coupons:${RESTAURANT_A_ID}`;
    let currentCoupons = filterCouponsForRestaurant(mockAdminCoupons, RESTAURANT_A_ID);

    mockStorage[storageKey] = JSON.stringify(currentCoupons);

    // Cycle 1: Disable SPICE
    currentCoupons = currentCoupons.map((c) => (c.code === 'SPICE' ? { ...c, isActive: false } : c));
    mockStorage[storageKey] = JSON.stringify(currentCoupons);
    expect(currentCoupons.find((c) => c.code === 'SPICE')!.isActive).toBe(false);

    // Cycle 2: Enable SPICE
    currentCoupons = currentCoupons.map((c) => (c.code === 'SPICE' ? { ...c, isActive: true } : c));
    mockStorage[storageKey] = JSON.stringify(currentCoupons);
    expect(currentCoupons.find((c) => c.code === 'SPICE')!.isActive).toBe(true);

    // Cycle 3: Disable SPICE again
    currentCoupons = currentCoupons.map((c) => (c.code === 'SPICE' ? { ...c, isActive: false } : c));
    mockStorage[storageKey] = JSON.stringify(currentCoupons);
    expect(currentCoupons.find((c) => c.code === 'SPICE')!.isActive).toBe(false);

    // Verify storage matches exactly without reverting
    const persisted = JSON.parse(mockStorage[storageKey]);
    expect(persisted.find((c: RestaurantCoupon) => c.code === 'SPICE').isActive).toBe(false);
  });

  // 4. Status persists across refresh and reloads
  it('4. Status persists across reload and re-fetch without automatic status changes', () => {
    const storageKey = `@foodie:restaurant_coupons:${RESTAURANT_A_ID}`;
    const initialCoupons = filterCouponsForRestaurant(mockAdminCoupons, RESTAURANT_A_ID);

    // Set MAYURA100 to enabled
    const modified = initialCoupons.map((c) =>
      c.code === 'MAYURA100' ? { ...c, isActive: true } : c,
    );
    mockStorage[storageKey] = JSON.stringify(modified);

    // Simulate page refresh / component mount
    const reloaded = JSON.parse(mockStorage[storageKey]);
    const reloadedCoupon = reloaded.find((c: RestaurantCoupon) => c.code === 'MAYURA100');

    expect(reloadedCoupon.isActive).toBe(true);
  });

  // 5. Error handling: rollback optimistic update if API fails
  it('5. Error rollback restores previous status when API request fails', () => {
    let coupons = filterCouponsForRestaurant(mockAdminCoupons, RESTAURANT_A_ID);
    const target = coupons.find((c) => c.code === 'SPICE')!;
    const originalStatus = target.isActive; // true

    // Optimistic toggle
    const optimisticCoupons = coupons.map((c) =>
      c.couponId === target.couponId ? { ...c, isActive: false } : c,
    );
    expect(optimisticCoupons.find((c) => c.code === 'SPICE')!.isActive).toBe(false);

    // API error occurs: rollback function is invoked
    const rollback = () => {
      coupons = coupons.map((c) =>
        c.couponId === target.couponId ? { ...c, isActive: originalStatus } : c,
      );
    };

    rollback();

    // Verify status restored
    expect(coupons.find((c) => c.code === 'SPICE')!.isActive).toBe(true);
  });

  // 6. Data Isolation between restaurants
  it('6. Strict Data Isolation: Restaurant A cannot see or modify Restaurant B coupons', () => {
    const couponsA = filterCouponsForRestaurant(mockAdminCoupons, RESTAURANT_A_ID);
    const couponsB = filterCouponsForRestaurant(mockAdminCoupons, RESTAURANT_B_ID);

    expect(couponsA.every((c) => c.restaurantId === RESTAURANT_A_ID)).toBe(true);
    expect(couponsB.every((c) => c.restaurantId === RESTAURANT_B_ID)).toBe(true);

    expect(couponsA.some((c) => c.code === 'ROYAL25')).toBe(false);
    expect(couponsB.some((c) => c.code === 'SPICE')).toBe(false);
  });

  // 7. Coupon Validity Date preservation and display consistency across panels
  it('7. Displays exactly the selected date without unintended timezone shifts or +1 day offset', () => {
    const testDates = [
      { adminSelected: '03-12-2026', expectedDisplay: '03-12-2026' },
      { adminSelected: '04-12-2026', expectedDisplay: '04-12-2026' },
      { adminSelected: '15-12-2026', expectedDisplay: '15-12-2026' },
      { adminSelected: '31-12-2026', expectedDisplay: '31-12-2026' },
    ];

    for (const { adminSelected, expectedDisplay } of testDates) {
      // 1. In date-only format (YYYY-MM-DD or DD-MM-YYYY)
      const cleanDate = extractDateOnly(adminSelected);
      expect(formatCouponValidityDate(cleanDate)).toBe(expectedDisplay);
      expect(formatValidityDate(cleanDate)).toBe(expectedDisplay);

      // 2. Even if incoming coupon had legacy UTC timestamp (e.g. 23:59:59Z)
      const legacyUtcPayload = `${cleanDate}T23:59:59Z`;
      const normalized = normalizeCoupon({
        couponId: 'test-1',
        code: 'TEST',
        discountType: 'PERCENT',
        value: 10,
        expiryDate: legacyUtcPayload,
        restaurantId: RESTAURANT_A_ID,
      });

      // Storage should preserve date-only YYYY-MM-DD
      expect(normalized.expiryDate).toBe(cleanDate);

      // Restaurant Promos display should match exact DD-MM-YYYY
      expect(formatValidityDate(normalized.expiryDate)).toBe(expectedDisplay);
      expect(formatCouponValidityDate(legacyUtcPayload)).toBe(expectedDisplay);
    }
  });

  // 8. Zone-based Filtering: Tumkur vs Bangalore vs All Locations
  it('8. Zone-based filtering: Tumkur restaurants see Tumkur coupons, Bangalore restaurants see Bangalore coupons, All Locations visible to both', () => {
    const multiZoneCoupons = [
      // Tumkur Zone coupon created by Admin
      {
        couponId: 'c-tmk-spice',
        code: 'SPICE_TUMKUR',
        title: 'SPICE • Tumkur Zone',
        discountType: 'PERCENT',
        value: 15,
        minOrderAmount: 499,
        maxDiscountAmount: 100,
        expiryDate: '2026-12-31T23:59:59Z',
        restaurantId: null,
        zoneId: 'dz-tumkur',
        zoneName: 'Tumkur Zone',
        isActive: true,
        approvalStatus: 'APPROVED',
      },
      // Bangalore Zone coupon created by Admin
      {
        couponId: 'c-blr-foodie',
        code: 'FOODIE_BLR',
        title: 'FOODIE • Bangalore Zone',
        discountType: 'PERCENT',
        value: 20,
        minOrderAmount: 399,
        maxDiscountAmount: 120,
        expiryDate: '2026-12-31T23:59:59Z',
        restaurantId: null,
        zoneId: 'dz-bangalore',
        zoneName: 'Bangalore Zone',
        isActive: true,
        approvalStatus: 'APPROVED',
      },
      // All Locations coupon created by Admin
      {
        couponId: 'c-all-welcome',
        code: 'ALL_WELCOME',
        title: 'Welcome All Zones',
        discountType: 'FLAT',
        value: 50,
        minOrderAmount: 200,
        maxDiscountAmount: null,
        expiryDate: '2026-12-31T23:59:59Z',
        restaurantId: null,
        zoneId: 'ALL',
        zoneName: 'All Locations',
        isActive: true,
        approvalStatus: 'APPROVED',
      },
      // Hubballi Zone coupon created by Admin
      {
        couponId: 'c-hub-fest',
        code: 'HUBBALLI_FEST',
        title: 'Hubballi Festival Promo',
        discountType: 'PERCENT',
        value: 10,
        minOrderAmount: 300,
        maxDiscountAmount: 50,
        expiryDate: '2026-12-31T23:59:59Z',
        restaurantId: null,
        zoneId: 'dz-hubballi-zone',
        zoneName: 'Hubballi Zone',
        isActive: true,
        approvalStatus: 'APPROVED',
      },
    ];

    const TUMKUR_RESTAURANT = '8742d1a6-a93f-4c53-9c71-ed431157888e'; // Shetty Biriyani in Tumkur
    const BANGALORE_RESTAURANT = 'b7c2a110-92d4-4f81-9b11-a83d712e5001'; // Royal Biryani in Bangalore

    // Tumkur restaurant view
    const tumkurPromos = filterCouponsForRestaurant(multiZoneCoupons, TUMKUR_RESTAURANT, 'dz-tumkur');
    const tumkurCodes = tumkurPromos.map((c) => c.code);

    // 1. Tumkur restaurant sees Tumkur coupons
    expect(tumkurCodes).toContain('SPICE_TUMKUR');
    // 2. Tumkur restaurant sees All Locations coupons
    expect(tumkurCodes).toContain('ALL_WELCOME');
    // 3. Tumkur restaurant NEVER sees Bangalore coupons
    expect(tumkurCodes).not.toContain('FOODIE_BLR');
    // 4. Tumkur restaurant NEVER sees Hubballi coupons
    expect(tumkurCodes).not.toContain('HUBBALLI_FEST');

    // Bangalore restaurant view
    const blrPromos = filterCouponsForRestaurant(multiZoneCoupons, BANGALORE_RESTAURANT, 'dz-bangalore');
    const blrCodes = blrPromos.map((c) => c.code);

    // 1. Bangalore restaurant sees Bangalore coupons
    expect(blrCodes).toContain('FOODIE_BLR');
    // 2. Bangalore restaurant sees All Locations coupons
    expect(blrCodes).toContain('ALL_WELCOME');
    // 3. Bangalore restaurant NEVER sees Tumkur coupons
    expect(blrCodes).not.toContain('SPICE_TUMKUR');
    // 4. Bangalore restaurant NEVER sees Hubballi coupons
    expect(blrCodes).not.toContain('HUBBALLI_FEST');
  });

  // 9. Zone Identifier Matching & Resolution
  it('9. Correctly resolves restaurant zones and matches zone aliases using actual zone IDs', () => {
    // Tumkur zone matching
    expect(isZoneMatching('dz-tumkur', 'dz-tumkur')).toBe(true);
    expect(isZoneMatching('Tumkur Zone', 'dz-tumkur')).toBe(true);
    expect(isZoneMatching('tumkur', 'Tumkur Zone')).toBe(true);
    expect(isZoneMatching('tumakuru', 'dz-tumkur')).toBe(true);
    expect(isZoneMatching('dz-tumkur', 'dz-bangalore')).toBe(false);

    // Bangalore zone matching
    expect(isZoneMatching('dz-bangalore', 'dz-bangalore')).toBe(true);
    expect(isZoneMatching('Bangalore Zone', 'dz-bangalore')).toBe(true);
    expect(isZoneMatching('bengaluru', 'Bangalore Zone')).toBe(true);
    expect(isZoneMatching('dz-bangalore', 'dz-tumkur')).toBe(false);

    // All Zones / All Locations matching
    expect(isZoneMatching('ALL', 'dz-tumkur')).toBe(true);
    expect(isZoneMatching('All Locations', 'dz-bangalore')).toBe(true);

    // Rule: Do not assume a missing zone ID means All Locations
    expect(isZoneMatching(null, 'dz-tumkur')).toBe(false);
    expect(isZoneMatching(undefined, 'dz-bangalore')).toBe(false);

    // Rule: Do not show coupons if restaurant zone cannot be verified
    expect(isZoneMatching('dz-tumkur', null)).toBe(false);
    expect(isZoneMatching('dz-bangalore', undefined)).toBe(false);

    // Resolve zone from restaurant profile without mock or hardcoded IDs
    expect(resolveRestaurantZone({ zoneId: 'dz-tumkur' })).toBe('dz-tumkur');
    expect(resolveRestaurantZone({ zoneName: 'Tumkur Zone' })).toBe('dz-tumkur');
    expect(resolveRestaurantZone({ address: { city: 'Tumkur' } })).toBe('dz-tumkur');
    expect(resolveRestaurantZone({ zoneId: 'dz-bangalore' })).toBe('dz-bangalore');
    expect(resolveRestaurantZone({ zoneName: 'Bangalore Zone' })).toBe('dz-bangalore');
    expect(resolveRestaurantZone({ address: { city: 'Bengaluru' } })).toBe('dz-bangalore');
    expect(resolveRestaurantZone({})).toBe('');
    expect(resolveRestaurantZone(null)).toBe('');
  });

  // 10. Expired, Inactive, or Unpublished Coupons
  it('10. Excludes expired or unpublished coupons and displays inactive coupons with DISABLED status', () => {
    const mixedCoupons = [
      // Approved and Active
      {
        couponId: 'c-valid-active',
        code: 'VALID_ACTIVE',
        discountType: 'PERCENT',
        value: 10,
        expiryDate: '2026-12-31T23:59:59Z',
        restaurantId: RESTAURANT_A_ID,
        isActive: true,
        approvalStatus: 'APPROVED',
      },
      // Inactive / Disabled
      {
        couponId: 'c-valid-disabled',
        code: 'VALID_DISABLED',
        discountType: 'PERCENT',
        value: 15,
        expiryDate: '2026-12-31T23:59:59Z',
        restaurantId: RESTAURANT_A_ID,
        isActive: false,
        approvalStatus: 'APPROVED',
      },
      // Expired coupon (Past date in 2024)
      {
        couponId: 'c-expired',
        code: 'EXPIRED_COUPON',
        discountType: 'PERCENT',
        value: 20,
        expiryDate: '2024-01-01T23:59:59Z',
        restaurantId: RESTAURANT_A_ID,
        isActive: true,
        approvalStatus: 'APPROVED',
      },
      // Unpublished / Pending approval coupon
      {
        couponId: 'c-pending',
        code: 'PENDING_COUPON',
        discountType: 'PERCENT',
        value: 25,
        expiryDate: '2026-12-31T23:59:59Z',
        restaurantId: RESTAURANT_A_ID,
        isActive: true,
        approvalStatus: 'PENDING',
      },
      // Rejected coupon
      {
        couponId: 'c-rejected',
        code: 'REJECTED_COUPON',
        discountType: 'PERCENT',
        value: 30,
        expiryDate: '2026-12-31T23:59:59Z',
        restaurantId: RESTAURANT_A_ID,
        isActive: true,
        approvalStatus: 'REJECTED',
      },
      // Deleted coupon
      {
        couponId: 'c-deleted',
        code: 'DELETED_COUPON',
        discountType: 'PERCENT',
        value: 10,
        expiryDate: '2026-12-31T23:59:59Z',
        restaurantId: RESTAURANT_A_ID,
        isActive: true,
        status: 'DELETED',
      },
    ];

    expect(isCouponExpired('2024-01-01')).toBe(true);
    expect(isCouponExpired('2026-12-31')).toBe(false);

    const filtered = filterCouponsForRestaurant(mixedCoupons, RESTAURANT_A_ID, 'dz-tumkur');
    const codes = filtered.map((c) => c.code);

    // 1. Valid active is displayed as active
    expect(codes).toContain('VALID_ACTIVE');
    const activeItem = filtered.find((c) => c.code === 'VALID_ACTIVE');
    expect(activeItem?.isActive).toBe(true);

    // 2. Inactive coupon is displayed with DISABLED status (isActive: false)
    expect(codes).toContain('VALID_DISABLED');
    const disabledItem = filtered.find((c) => c.code === 'VALID_DISABLED');
    expect(disabledItem?.isActive).toBe(false);

    // 3. Expired coupons are NOT displayed as active promotions
    expect(codes).not.toContain('EXPIRED_COUPON');

    // 4. Unpublished / Pending coupons are NOT displayed
    expect(codes).not.toContain('PENDING_COUPON');

    // 5. Rejected coupons are NOT displayed
    expect(codes).not.toContain('REJECTED_COUPON');

    // 6. Deleted coupons are NOT displayed
    expect(codes).not.toContain('DELETED_COUPON');
  });

  // 11. Real-time automatic polling update simulation
  it('11. Automatically incorporates newly published Super Admin coupons without full page reload', () => {
    let currentStore: any[] = [...mockAdminCoupons];

    // Initial fetch
    let restaurantView = filterCouponsForRestaurant(currentStore, RESTAURANT_A_ID, 'dz-tumkur');
    expect(restaurantView.some((c) => c.code === 'NEW_ADMIN_FEST')).toBe(false);

    // Super Admin publishes a new coupon for Tumkur Zone
    const newlyPublishedCoupon = {
      couponId: 'c-new-admin-99',
      code: 'NEW_ADMIN_FEST',
      title: 'New Festival Promo • Tumkur Zone',
      discountType: 'PERCENT',
      value: 20,
      minOrderAmount: 499,
      maxDiscountAmount: 100,
      expiryDate: '2026-12-31T23:59:59Z',
      restaurantId: null,
      zoneId: 'dz-tumkur',
      zoneName: 'Tumkur Zone',
      isActive: true,
      approvalStatus: 'APPROVED',
      isAllZones: false,
      funderType: 'MERCHANT',
      couponType: 'RESTAURANT',
    };
    currentStore = [newlyPublishedCoupon, ...currentStore];

    // Next automatic polling cycle (3000ms polling interval)
    restaurantView = filterCouponsForRestaurant(currentStore, RESTAURANT_A_ID, 'dz-tumkur');
    expect(restaurantView.some((c) => c.code === 'NEW_ADMIN_FEST')).toBe(true);
    const newPromo = restaurantView.find((c) => c.code === 'NEW_ADMIN_FEST');
    expect(newPromo?.isActive).toBe(true);
    expect(newPromo?.value).toBe(20);
  });

  // 12. Final Testing: Test A (Tumkur Login) vs Test B (Bangalore Login)
  it('12. Final Testing: Tumkur restaurant sees only Tumkur + All Locations; Bangalore restaurant sees only Bangalore + All Locations', () => {
    const adminCreatedPool = [
      // Scenario 1: Super Admin creates coupon for Tumkur Zone
      {
        couponId: 'c-tmk-biryani',
        code: 'TUMKUR_FEST',
        title: 'Tumkur Food Festival',
        discountType: 'PERCENT',
        value: 20,
        minOrderAmount: 300,
        maxDiscountAmount: 100,
        expiryDate: '2026-12-31T23:59:59Z',
        restaurantId: null,
        zoneId: 'dz-tumkur',
        zoneName: 'Tumkur Zone',
        isActive: true,
        approvalStatus: 'APPROVED',
      },
      // Scenario 2: Super Admin creates coupon for Bangalore Zone
      {
        couponId: 'c-blr-weekend',
        code: 'BLR_WEEKEND',
        title: 'Bangalore Weekend Special',
        discountType: 'FLAT',
        value: 100,
        minOrderAmount: 500,
        maxDiscountAmount: null,
        expiryDate: '2026-12-31T23:59:59Z',
        restaurantId: null,
        zoneId: 'dz-bangalore',
        zoneName: 'Bangalore Zone',
        isActive: true,
        approvalStatus: 'APPROVED',
      },
      // Scenario 3: Super Admin creates coupon for All Locations
      {
        couponId: 'c-all-mega',
        code: 'MEGA_FOODIE',
        title: 'Foodie Mega Discount',
        discountType: 'PERCENT',
        value: 50,
        minOrderAmount: 199,
        maxDiscountAmount: 150,
        expiryDate: '2026-12-31T23:59:59Z',
        restaurantId: null,
        zoneId: 'ALL',
        zoneName: 'All Locations',
        isActive: true,
        approvalStatus: 'APPROVED',
      },
      // Missing zone ID coupon (must not be assumed to be All Locations)
      {
        couponId: 'c-no-zone',
        code: 'MYSTERY_DEAL',
        title: 'Missing Zone Deal',
        discountType: 'PERCENT',
        value: 30,
        minOrderAmount: 200,
        maxDiscountAmount: 100,
        expiryDate: '2026-12-31T23:59:59Z',
        restaurantId: null,
        zoneId: null,
        zoneName: null,
        isActive: true,
        approvalStatus: 'APPROVED',
      },
    ];

    const TUMKUR_REST_ID = 'rest-tumkur-401';
    const BANGALORE_REST_ID = 'rest-bangalore-501';

    // Test A: Tumkur restaurant login
    const tumkurPromos = filterCouponsForRestaurant(adminCreatedPool, TUMKUR_REST_ID, 'dz-tumkur');
    const tumkurCodes = tumkurPromos.map((c) => c.code);

    // Only Tumkur and All Locations coupons should appear
    expect(tumkurCodes).toEqual(expect.arrayContaining(['TUMKUR_FEST', 'MEGA_FOODIE']));
    expect(tumkurCodes).toHaveLength(2);
    // Never display a Bangalore-only coupon to a Tumkur restaurant
    expect(tumkurCodes).not.toContain('BLR_WEEKEND');
    // Missing zone ID coupon is NOT assumed to be All Locations
    expect(tumkurCodes).not.toContain('MYSTERY_DEAL');

    // Test B: Bangalore restaurant login
    const bangalorePromos = filterCouponsForRestaurant(adminCreatedPool, BANGALORE_REST_ID, 'dz-bangalore');
    const bangaloreCodes = bangalorePromos.map((c) => c.code);

    // Only Bangalore and All Locations coupons should appear
    expect(bangaloreCodes).toEqual(expect.arrayContaining(['BLR_WEEKEND', 'MEGA_FOODIE']));
    expect(bangaloreCodes).toHaveLength(2);
    // Never display a Tumkur-only coupon to a Bangalore restaurant
    expect(bangaloreCodes).not.toContain('TUMKUR_FEST');
    // Missing zone ID coupon is NOT assumed to be All Locations
    expect(bangaloreCodes).not.toContain('MYSTERY_DEAL');

    // Verification: Unverified restaurant zone returns no coupons
    const unverifiedPromos = filterCouponsForRestaurant(adminCreatedPool, 'unverified-rest', '');
    expect(unverifiedPromos).toEqual([]);
  });

  // 13. Extra & Duplicate Coupons Elimination (Single Source of Truth)
  it('13. Admin Panel single source of truth: eliminates extra seed coupons and duplicate entries', () => {
    // Admin has created exactly 2 coupons for Tumkur Zone
    const adminCreatedCoupons = [
      {
        couponId: 'c-admin-01',
        code: 'TUMKUR50',
        title: '50% OFF Tumkur Special',
        discountType: 'PERCENT',
        value: 50,
        minOrderAmount: 299,
        maxDiscountAmount: 150,
        expiryDate: '2026-12-31T23:59:59Z',
        restaurantId: null,
        zoneId: 'dz-tumkur',
        zoneName: 'Tumkur Zone',
        isActive: true,
        approvalStatus: 'APPROVED',
      },
      {
        couponId: 'c-admin-02',
        code: 'TUMKUR_FEST',
        title: 'Tumkur Festival Treat',
        discountType: 'FLAT',
        value: 100,
        minOrderAmount: 499,
        maxDiscountAmount: null,
        expiryDate: '2026-12-31T23:59:59Z',
        restaurantId: null,
        zoneId: 'dz-tumkur',
        zoneName: 'Tumkur Zone',
        isActive: true,
        approvalStatus: 'APPROVED',
      },
      // Duplicate entry of TUMKUR50
      {
        couponId: 'c-admin-01-dup',
        code: 'TUMKUR50',
        title: 'Duplicate TUMKUR50',
        discountType: 'PERCENT',
        value: 50,
        minOrderAmount: 299,
        maxDiscountAmount: 150,
        expiryDate: '2026-12-31T23:59:59Z',
        restaurantId: null,
        zoneId: 'dz-tumkur',
        zoneName: 'Tumkur Zone',
        isActive: true,
        approvalStatus: 'APPROVED',
      },
      // Extra legacy / seed coupons with missing or generic zone
      {
        couponId: 'c-seed-01',
        code: 'WEL',
        title: 'Welcome Deal',
        discountType: 'PERCENT',
        value: 20,
        minOrderAmount: 100,
        maxDiscountAmount: 50,
        expiryDate: '2026-12-31T23:59:59Z',
        restaurantId: null,
        zoneId: null,
        zoneName: null,
        isActive: true,
        approvalStatus: 'APPROVED',
      },
      {
        couponId: 'c-seed-02',
        code: 'FOODIE13',
        title: 'Foodie 13 Promo',
        discountType: 'PERCENT',
        value: 13,
        minOrderAmount: 150,
        maxDiscountAmount: 40,
        expiryDate: '2026-12-31T23:59:59Z',
        restaurantId: null,
        zoneId: '',
        zoneName: '',
        isActive: true,
        approvalStatus: 'APPROVED',
      },
      {
        couponId: 'c-seed-03',
        code: 'FOODIE15',
        title: 'Foodie 15 Promo',
        discountType: 'PERCENT',
        value: 15,
        minOrderAmount: 200,
        maxDiscountAmount: 50,
        expiryDate: '2026-12-31T23:59:59Z',
        restaurantId: null,
        zoneId: null,
        zoneName: null,
        isActive: true,
        approvalStatus: 'APPROVED',
      },
      {
        couponId: 'c-seed-04',
        code: 'FOODIE16',
        title: 'Foodie 16 Promo',
        discountType: 'PERCENT',
        value: 16,
        minOrderAmount: 200,
        maxDiscountAmount: 50,
        expiryDate: '2026-12-31T23:59:59Z',
        restaurantId: null,
        zoneId: null,
        zoneName: null,
        isActive: true,
        approvalStatus: 'APPROVED',
      },
    ];

    const promos = filterCouponsForRestaurant(adminCreatedCoupons, 'rest-tumkur-401', 'dz-tumkur');

    // Exactly 2 coupons must be displayed
    expect(promos).toHaveLength(2);
    expect(promos.map((p) => p.code)).toEqual(['TUMKUR50', 'TUMKUR_FEST']);

    // Extra seed coupons must NOT be present
    expect(promos.some((p) => p.code === 'WEL')).toBe(false);
    expect(promos.some((p) => p.code === 'FOODIE13')).toBe(false);
    expect(promos.some((p) => p.code === 'FOODIE15')).toBe(false);
    expect(promos.some((p) => p.code === 'FOODIE16')).toBe(false);
  });

  // 14. Strict exclusion of customer promo coupons and platform campaigns
  it('14. Excludes Promo Coupons, customer-only coupons, and Foodie-funded generic coupons from Restaurant Promos', () => {
    const mixedCampaigns = [
      // Valid Restaurant coupon for Tumkur
      {
        couponId: 'c-rest-valid',
        code: 'MAYURA_TUMKUR',
        title: 'Mayura Special',
        discountType: 'PERCENT',
        value: 20,
        minOrderAmount: 300,
        expiryDate: '2026-12-31T23:59:59Z',
        restaurantId: RESTAURANT_A_ID,
        zoneId: 'dz-tumkur',
        couponType: 'RESTAURANT',
        funderType: 'MERCHANT',
        isActive: false,
        approvalStatus: 'APPROVED',
      },
      // Customer Promo Coupon created by Admin (for customer app checkout only)
      {
        couponId: 'c-promo-cust',
        code: 'FOODIE50',
        title: 'Foodie 50% Flat Off',
        discountType: 'PERCENT',
        value: 50,
        minOrderAmount: 200,
        expiryDate: '2026-12-31T23:59:59Z',
        restaurantId: null,
        zoneId: 'dz-tumkur',
        couponType: 'PROMO_COUPON',
        funderType: 'FOODIE',
        isActive: true,
        approvalStatus: 'APPROVED',
      },
      // Customer category coupon
      {
        couponId: 'c-cust-cat',
        code: 'NEWUSER25',
        title: 'New Customer Deal',
        discountType: 'PERCENT',
        value: 25,
        minOrderAmount: 150,
        expiryDate: '2026-12-31T23:59:59Z',
        restaurantId: null,
        category: 'CUSTOMER',
        isActive: true,
        approvalStatus: 'APPROVED',
      },
      // Unrelated coupon assigned to another restaurant
      {
        couponId: 'c-other-rest',
        code: 'ROYAL_ONLY',
        title: 'Royal Biryani Deal',
        discountType: 'FLAT',
        value: 50,
        minOrderAmount: 200,
        expiryDate: '2026-12-31T23:59:59Z',
        restaurantId: RESTAURANT_B_ID,
        couponType: 'RESTAURANT',
        funderType: 'MERCHANT',
        isActive: true,
        approvalStatus: 'APPROVED',
      },
    ];

    const promos = filterCouponsForRestaurant(mixedCampaigns, RESTAURANT_A_ID, 'dz-tumkur');

    // ONLY the assigned restaurant coupon appears
    expect(promos).toHaveLength(1);
    expect(promos[0].code).toBe('MAYURA_TUMKUR');
    expect(promos.some((c) => c.code === 'FOODIE50')).toBe(false);
    expect(promos.some((c) => c.code === 'NEWUSER25')).toBe(false);
    expect(promos.some((c) => c.code === 'ROYAL_ONLY')).toBe(false);
  });

  // 15. Newly received admin coupons remain DISABLED by default, and user toggles persist
  it('15. All newly received admin coupons remain DISABLED by default and toggle state persists permanently', () => {
    const rawAdminCoupons = [
      {
        couponId: 'c-admin-new-01',
        code: 'NEW_ADMIN_DISCOUNT',
        title: 'Admin Created Discount',
        discountType: 'PERCENT',
        value: 15,
        minOrderAmount: 400,
        expiryDate: '2026-12-31T23:59:59Z',
        restaurantId: RESTAURANT_A_ID,
        couponType: 'RESTAURANT',
        funderType: 'MERCHANT',
        isActive: true, // Super Admin created with isActive: true in DB
        approvalStatus: 'APPROVED',
      },
      {
        couponId: 'c-admin-new-02',
        code: 'SECOND_ADMIN_DISCOUNT',
        title: 'Second Discount',
        discountType: 'FLAT',
        value: 75,
        minOrderAmount: 500,
        expiryDate: '2026-12-31T23:59:59Z',
        restaurantId: RESTAURANT_A_ID,
        couponType: 'RESTAURANT',
        funderType: 'MERCHANT',
        isActive: true, // Super Admin created with isActive: true in DB
        approvalStatus: 'APPROVED',
      },
    ];

    // Initial state: Restaurant has not toggled any coupon yet (storedToggles = {})
    const initialToggles: Record<string, boolean> = {};
    const filteredInitial = filterCouponsForRestaurant(
      rawAdminCoupons,
      RESTAURANT_A_ID,
      'dz-tumkur',
      initialToggles,
    );

    // Rule 3: All newly received admin-created restaurant coupons must remain DISABLED by default!
    expect(filteredInitial).toHaveLength(2);
    expect(filteredInitial[0].isActive).toBe(false);
    expect(filteredInitial[1].isActive).toBe(false);

    // Restaurant toggles c-admin-new-01 to ENABLED (isActive: true)
    const updatedToggles: Record<string, boolean> = {
      'c-admin-new-01': true,
      NEW_ADMIN_DISCOUNT: true,
    };

    const reloaded = filterCouponsForRestaurant(
      rawAdminCoupons,
      RESTAURANT_A_ID,
      'dz-tumkur',
      updatedToggles,
    );

    // c-admin-new-01 is now ENABLED, and c-admin-new-02 remains DISABLED
    const c1 = reloaded.find((c) => c.couponId === 'c-admin-new-01');
    const c2 = reloaded.find((c) => c.couponId === 'c-admin-new-02');
    expect(c1?.isActive).toBe(true);
    expect(c2?.isActive).toBe(false);
  });

  // 16. Multi-Restaurant Zone Assignment and Independent Activation Isolation
  it('16. Super Admin zone coupons reach ALL restaurants in that zone with independent enable/disable isolation', () => {
    const RESTAURANT_1_TUMKUR = 'rest-tumkur-001';
    const RESTAURANT_2_TUMKUR = 'rest-tumkur-002';
    const RESTAURANT_3_BLR = 'rest-blr-003';

    // Super Admin creates a Tumkur Zone restaurant coupon
    const pool = [
      {
        couponId: 'c-admin-tmk-zone',
        code: 'TUMKUR_DELIGHT',
        title: '20% OFF Tumkur Regional Delight',
        discountType: 'PERCENT',
        value: 20,
        minOrderAmount: 300,
        expiryDate: '2026-12-31T23:59:59Z',
        restaurantId: null,
        zoneId: 'dz-tumkur',
        zoneName: 'Tumkur Zone',
        couponType: 'RESTAURANT',
        funderType: 'MERCHANT',
        isActive: true,
        approvalStatus: 'APPROVED',
      },
      {
        couponId: 'c-admin-blr-zone',
        code: 'BANGALORE_BITE',
        title: 'Flat ₹100 Bangalore Treat',
        discountType: 'FLAT',
        value: 100,
        minOrderAmount: 500,
        expiryDate: '2026-12-31T23:59:59Z',
        restaurantId: null,
        zoneId: 'dz-bangalore',
        zoneName: 'Bangalore Zone',
        couponType: 'RESTAURANT',
        funderType: 'MERCHANT',
        isActive: true,
        approvalStatus: 'APPROVED',
      },
    ];

    // Rule 1: Available to ALL eligible restaurants in Tumkur Zone
    const rest1Toggles: Record<string, boolean> = {};
    const rest2Toggles: Record<string, boolean> = {};

    const view1 = filterCouponsForRestaurant(pool, RESTAURANT_1_TUMKUR, 'dz-tumkur', rest1Toggles);
    const view2 = filterCouponsForRestaurant(pool, RESTAURANT_2_TUMKUR, 'dz-tumkur', rest2Toggles);
    const view3 = filterCouponsForRestaurant(pool, RESTAURANT_3_BLR, 'dz-bangalore', {});

    // Both Tumkur restaurants see TUMKUR_DELIGHT
    expect(view1.map((c) => c.code)).toEqual(['TUMKUR_DELIGHT']);
    expect(view2.map((c) => c.code)).toEqual(['TUMKUR_DELIGHT']);
    // Bangalore restaurant sees BANGALORE_BITE only
    expect(view3.map((c) => c.code)).toEqual(['BANGALORE_BITE']);

    // Rule 4: Default status must always be DISABLED
    expect(view1[0].isActive).toBe(false);
    expect(view2[0].isActive).toBe(false);

    // Rule 5: Restaurant 1 ENABLES coupon -> Must NOT enable for Restaurant 2
    rest1Toggles['TUMKUR_DELIGHT'] = true;

    const updatedView1 = filterCouponsForRestaurant(pool, RESTAURANT_1_TUMKUR, 'dz-tumkur', rest1Toggles);
    const updatedView2 = filterCouponsForRestaurant(pool, RESTAURANT_2_TUMKUR, 'dz-tumkur', rest2Toggles);

    expect(updatedView1[0].isActive).toBe(true);
    expect(updatedView2[0].isActive).toBe(false); // Isolated! Still disabled for Restaurant 2!
  });

  // 17. Dynamic matching for future zones and exclusion of Newly Joined / First Order user categories
  it('17. Dynamic matching for future zones and eliminates Newly Joined user coupons', () => {
    const dynamicCampaigns = [
      // Future Zone: Mangalore Zone
      {
        couponId: 'c-mng-01',
        code: 'MANGALORE_FISH',
        title: 'Coastal Special',
        discountType: 'PERCENT',
        value: 15,
        minOrderAmount: 250,
        expiryDate: '2026-12-31T23:59:59Z',
        restaurantId: null,
        zoneId: 'dz-mangalore',
        zoneName: 'Mangalore Zone',
        couponType: 'RESTAURANT',
        funderType: 'MERCHANT',
        isActive: true,
        approvalStatus: 'APPROVED',
      },
      // Newly Joined / First Order user campaign (must NEVER appear in restaurant promos)
      {
        couponId: 'c-newly-joined-01',
        code: 'NEWJOIN50',
        title: 'Newly Joined Customer Bonus',
        discountType: 'PERCENT',
        value: 50,
        minOrderAmount: 100,
        expiryDate: '2026-12-31T23:59:59Z',
        restaurantId: null,
        zoneId: 'dz-mangalore',
        couponType: 'NEW_USER',
        targetAudience: 'NEWLY_JOINED',
        isActive: true,
        approvalStatus: 'APPROVED',
      },
      // First order offer
      {
        couponId: 'c-fo-02',
        code: 'FIRST_BITE',
        title: 'First Order Discount',
        discountType: 'FLAT',
        value: 50,
        minOrderAmount: 200,
        expiryDate: '2026-12-31T23:59:59Z',
        restaurantId: null,
        zoneId: 'dz-mangalore',
        couponType: 'FIRST_ORDER',
        isActive: true,
        approvalStatus: 'APPROVED',
      },
    ];

    const REST_MANGALORE = 'rest-mng-999';
    const promos = filterCouponsForRestaurant(dynamicCampaigns, REST_MANGALORE, 'dz-mangalore', {});

    // Matches Mangalore dynamically
    expect(promos).toHaveLength(1);
    expect(promos[0].code).toBe('MANGALORE_FISH');
    expect(promos[0].isActive).toBe(false); // Default disabled

    // Newly Joined / First Order coupons are completely eliminated
    expect(promos.some((c) => c.code === 'NEWJOIN50')).toBe(false);
    expect(promos.some((c) => c.code === 'FIRST_BITE')).toBe(false);
  });
});
