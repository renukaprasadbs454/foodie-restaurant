export interface CreateCouponBody {
  code: string;
  discountType: 'FLAT' | 'PERCENT';
  value: number;
  minOrderAmount: number;
  maxDiscountAmount?: number;
  expiryDate: string;
  usageLimitTotal?: number;
  usageLimitPerUser: number;
  funderType?: string;
  couponType?: string;
  benefitMode?: string;
}

export interface RestaurantCoupon {
  couponId: string;
  code: string;
  title?: string;
  discountType: 'PERCENT' | 'FLAT' | 'FIXED';
  value: number;
  minOrderAmount: number;
  maxDiscountAmount?: number | null;
  expiryDate: string;
  usageLimitTotal?: number | null;
  usageLimitPerUser?: number;
  restaurantId?: string | null;
  restaurantName?: string | null;
  isActive: boolean;
  approvalStatus?: string;
  couponType?: string;
  funderType?: string;
  benefitMode?: string;
  zoneId?: string | null;
  zoneName?: string | null;
}

export interface GetRestaurantCouponsArgs {
  restaurantId: string;
  zoneId?: string | null;
}

export interface ToggleCouponStatusArgs {
  couponId: string;
  isActive: boolean;
  restaurantId: string;
  zoneId?: string | null;
}

/**
 * Preserves the exact calendar date (YYYY-MM-DD) from user input or server payload
 * without applying unintended UTC/local timezone conversion shifts.
 */
export function extractDateOnly(dateStr?: string | null): string {
  if (!dateStr) return '';
  const s = String(dateStr).trim();

  // 1. Matches YYYY-MM-DD (e.g. 2026-12-03 or 2026-12-03T23:59:59Z)
  const isoMatch = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // 2. Matches DD-MM-YYYY (e.g. 03-12-2026)
  const dmyMatch = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // 3. Matches D/M/YYYY or M/D/YYYY from legacy string
  const slashMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slashMatch) {
    let [, p1, p2, y] = slashMatch;
    let day = p1;
    let month = p2;
    if (Number(p1) <= 12 && Number(p2) > 12) {
      day = p2;
      month = p1;
    }
    return `${y}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  return s;
}

/**
 * Formats coupon validity date to standard DD-MM-YYYY display format
 * without timezone modification.
 */
export function formatCouponValidityDate(dateStr?: string | null): string {
  if (!dateStr) return '';
  const s = String(dateStr).trim();

  // 1. Matches YYYY-MM-DD (or YYYY-MM-DDTHH:mm:ss...)
  const isoMatch = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return `${d.padStart(2, '0')}-${m.padStart(2, '0')}-${y}`;
  }

  // 2. Matches DD-MM-YYYY
  const dmyMatch = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    return `${d.padStart(2, '0')}-${m.padStart(2, '0')}-${y}`;
  }

  // 3. Matches D/M/YYYY or M/D/YYYY from legacy
  const slashMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slashMatch) {
    let [, p1, p2, y] = slashMatch;
    let day = p1;
    let month = p2;
    if (Number(p1) <= 12 && Number(p2) > 12) {
      day = p2;
      month = p1;
    }
    return `${day.padStart(2, '0')}-${month.padStart(2, '0')}-${y}`;
  }

  return s;
}

/**
 * Helper used by Restaurant Promos UI to format validity date cleanly as DD-MM-YYYY
 */
export function formatValidityDate(dateStr?: string | null): string {
  if (!dateStr) return 'No Expiry';
  const formatted = formatCouponValidityDate(dateStr);
  return formatted || dateStr;
}

export function isCouponExpired(expiryDate?: string | null): boolean {
  if (!expiryDate) return false;
  const clean = extractDateOnly(expiryDate);
  if (!clean) return false;
  const parts = clean.split('-');
  if (parts.length !== 3) return false;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const d = parseInt(parts[2], 10);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return false;
  const endOfDay = new Date(y, m, d, 23, 59, 59, 999).getTime();
  return Date.now() > endOfDay;
}

/**
 * Normalizes zone identifiers into standardized canonical zone IDs.
 * Uses actual zone IDs (e.g. 'dz-tumkur', 'dz-bangalore', 'ALL') rather than loose strings.
 */
export function canonicalZoneId(zone?: string | null): string {
  if (!zone || typeof zone !== 'string') return '';
  const z = zone.trim().toLowerCase();
  if (
    z === 'all' ||
    z === 'all-locations' ||
    z === 'all_locations' ||
    z === 'all locations' ||
    z === 'all zones'
  ) {
    return 'ALL';
  }

  // Tumkur zone identifiers
  if (
    z === 'dz-tumkur' ||
    z === 'tumkur' ||
    z === 'tumakuru' ||
    z === 'tumkur zone' ||
    z === 'tmk'
  ) {
    return 'dz-tumkur';
  }

  // Bangalore zone identifiers
  if (
    z === 'dz-bangalore' ||
    z === 'bangalore' ||
    z === 'bengaluru' ||
    z === 'bangalore zone' ||
    z === 'blr'
  ) {
    return 'dz-bangalore';
  }

  // Hubballi zone identifiers
  if (
    z === 'dz-hubballi-zone' ||
    z === 'dz-hubballi' ||
    z === 'hubballi' ||
    z === 'hubli' ||
    z === 'hubballi zone' ||
    z === 'hbl'
  ) {
    return 'dz-hubballi-zone';
  }

  // Mysore zone identifiers
  if (z === 'dz-mysore' || z === 'mysore' || z === 'mysuru' || z === 'mysore zone') {
    return 'dz-mysore';
  }

  // Hassan zone identifiers
  if (z === 'dz-hassan' || z === 'hassan' || z === 'hassan zone') {
    return 'dz-hassan';
  }

  if (z.startsWith('dz-')) {
    return z;
  }

  return `dz-${z.replace(/[\s_]+/g, '-').replace(/-zone$/, '')}`;
}

/**
 * Checks whether a coupon is explicitly configured for All Locations.
 * Rule: Do not assume a missing zone ID means All Locations. Use actual zone IDs.
 */
export function isAllLocationsCoupon(coupon: any): boolean {
  if (!coupon || typeof coupon !== 'object') return false;
  if (coupon.isAllZones === true) return true;

  // Rule: Do not assume a missing zone ID means All Locations
  if (!coupon.zoneId) return false;

  const zId = String(coupon.zoneId).trim().toUpperCase();
  if (
    zId === 'ALL' ||
    zId === 'ALL-LOCATIONS' ||
    zId === 'ALL_LOCATIONS' ||
    zId === 'ALL LOCATIONS' ||
    zId === 'ALL ZONES'
  ) {
    return true;
  }

  const zName = coupon.zoneName ? String(coupon.zoneName).trim().toLowerCase() : '';
  if (
    zName === 'all locations' ||
    zName === 'all zones' ||
    zName === 'all' ||
    /\ball locations\b/i.test(zName) ||
    /\ball zones\b/i.test(zName)
  ) {
    return true;
  }

  return false;
}

/**
 * Validates zone matching between coupon and restaurant.
 * - Compares actual canonical zone IDs.
 * - Never displays a Tumkur-only coupon to a Bangalore restaurant.
 * - Never displays a Bangalore-only coupon to a Tumkur restaurant.
 * - Does not assume a missing zone ID means All Locations.
 * - Does not match if restaurant zone cannot be verified.
 */
export function isZoneMatching(couponZone?: string | null, restaurantZone?: string | null): boolean {
  if (!restaurantZone) return false; // Rule: Do not show coupons if the restaurant's zone cannot be verified
  const rCanonical = canonicalZoneId(restaurantZone);
  if (!rCanonical) return false;

  if (!couponZone) return false; // Rule: Do not assume a missing zone ID means All Locations
  const cCanonical = canonicalZoneId(couponZone);
  if (!cCanonical) return false;

  if (cCanonical === 'ALL') return true;

  return cCanonical === rCanonical;
}

/**
 * Resolves restaurant zone from real restaurant profile data.
 * Does not use mock or hardcoded zone data.
 */
export function resolveRestaurantZone(profile?: any): string {
  if (!profile) return '';
  if (typeof profile === 'string') {
    return canonicalZoneId(profile);
  }

  // 1. Direct assigned zone ID from restaurant profile
  if (profile.zoneId && typeof profile.zoneId === 'string' && profile.zoneId.trim()) {
    const canonical = canonicalZoneId(profile.zoneId);
    if (canonical) return canonical;
  }

  // 2. Direct assigned zone name from restaurant profile
  if (profile.zoneName && typeof profile.zoneName === 'string' && profile.zoneName.trim()) {
    const canonical = canonicalZoneId(profile.zoneName);
    if (canonical) return canonical;
  }

  // 3. City from restaurant address
  if (profile.address?.city && typeof profile.address.city === 'string' && profile.address.city.trim()) {
    const canonical = canonicalZoneId(profile.address.city);
    if (canonical) return canonical;
  }

  return '';
}

export function normalizeCoupon(raw: any): RestaurantCoupon {
  if (!raw || typeof raw !== 'object') {
    return {
      couponId: '',
      code: '',
      discountType: 'PERCENT',
      value: 0,
      minOrderAmount: 0,
      maxDiscountAmount: null,
      expiryDate: '',
      isActive: false,
    };
  }

  const rawType = String(raw.discountType || (raw.benefitMode === 'FLAT' ? 'FLAT' : 'PERCENT')).toUpperCase();
  const discType: 'PERCENT' | 'FLAT' | 'FIXED' =
    rawType === 'FIXED' ? 'FLAT' : (rawType === 'FLAT' ? 'FLAT' : 'PERCENT');
  const val = Number(raw.value ?? raw.discountValue ?? 0);
  const minOrder = Number(raw.minOrderAmount ?? raw.minPurchase ?? 0);
  const maxDisc = raw.maxDiscountAmount != null
    ? Number(raw.maxDiscountAmount)
    : (raw.maxDiscount != null ? Number(raw.maxDiscount) : null);
  const expired = isCouponExpired(raw.expiryDate);
  const active = !expired && raw.isActive !== false && raw.status !== 'DEACTIVATED';
  const id = String(raw.couponId || raw.id || raw.code || '');

  return {
    couponId: id,
    code: String(raw.code || '').trim().toUpperCase(),
    title: raw.title || undefined,
    discountType: discType,
    value: val,
    minOrderAmount: minOrder,
    maxDiscountAmount: maxDisc,
    expiryDate: extractDateOnly(raw.expiryDate) || (raw.expiryDate ? String(raw.expiryDate).slice(0, 10) : ''),
    usageLimitTotal: raw.usageLimitTotal != null ? Number(raw.usageLimitTotal) : null,
    usageLimitPerUser: raw.usageLimitPerUser != null ? Number(raw.usageLimitPerUser) : 1,
    restaurantId: raw.restaurantId ? String(raw.restaurantId).trim() : null,
    restaurantName: raw.restaurantName || null,
    isActive: active,
    approvalStatus: raw.approvalStatus || 'APPROVED',
    couponType: raw.couponType || 'RESTAURANT',
    funderType: raw.funderType || 'RESTAURANT',
    benefitMode: raw.benefitMode,
    zoneId: raw.zoneId || null,
    zoneName: raw.zoneName || null,
  };
}

/**
 * Enforces strict restaurant data and zone isolation.
 * - Restaurant A can only view and manage its own assigned coupons.
 * - Tumkur restaurants only see Tumkur coupons + All Locations coupons.
 * - Bangalore restaurants only see Bangalore coupons + All Locations coupons.
 * - Expired, inactive, or unpublished coupons are not displayed as active promotions.
 */
export function filterCouponsForRestaurant(
  coupons: any[],
  restaurantId: string,
  restaurantZone?: string | null,
): RestaurantCoupon[] {
  if (!Array.isArray(coupons) || !restaurantId || !restaurantId.trim()) {
    return [];
  }
  const cleanRestId = restaurantId.trim();
  const cleanZone = restaurantZone ? canonicalZoneId(restaurantZone) : '';

  const filtered = coupons
    .filter((c) => {
      if (!c || typeof c !== 'object') return false;

      // 1. Exclude deleted coupons
      if (c.status === 'DELETED' || c.isDeleted === true) return false;

      // 2. Exclude unpublished / draft / pending / rejected coupons
      if (c.approvalStatus && String(c.approvalStatus).toUpperCase() !== 'APPROVED') {
        return false;
      }

      // 3. Exclude expired coupons from active promotions
      if (isCouponExpired(c.expiryDate)) {
        return false;
      }

      const couponRestId = c.restaurantId ? String(c.restaurantId).trim() : null;

      // 4. Restaurant data isolation: If assigned to a specific restaurant, must match cleanRestId
      if (couponRestId && couponRestId !== 'ALL') {
        if (couponRestId.toLowerCase() !== cleanRestId.toLowerCase()) {
          return false;
        }
        // If assigned to this specific restaurant, also verify zone if coupon specifies a zone
        if (cleanZone && c.zoneId && canonicalZoneId(c.zoneId) !== 'ALL') {
          return canonicalZoneId(c.zoneId) === cleanZone;
        }
        return true;
      }

      // 5. Zone coupons and All Locations coupons require a verified restaurant zone
      // Rule: Do not show coupons if the restaurant's zone cannot be verified
      if (!cleanZone) {
        return false;
      }

      // 6. All Locations coupons: visible to all eligible restaurants
      if (isAllLocationsCoupon(c)) {
        return true;
      }

      // 7. Zone-specific coupons:
      // Rule: Do not assume a missing zone ID means All Locations
      const couponZone = c.zoneId || c.zoneName;
      if (!couponZone) {
        return false;
      }

      // Rule: Use actual zone IDs, not only zone names
      // Tumkur restaurants see Tumkur coupons, Bangalore restaurants see Bangalore coupons
      return isZoneMatching(couponZone, cleanZone);
    });

  // De-duplicate coupons: prevent duplicate cards if multiple API responses or records exist
  const seenIds = new Set<string>();
  const seenCodes = new Set<string>();
  const deduped: RestaurantCoupon[] = [];

  for (const raw of filtered) {
    const normalized = normalizeCoupon({ ...raw, restaurantId: cleanRestId });
    const idKey = normalized.couponId ? normalized.couponId.trim().toLowerCase() : '';
    const codeKey = normalized.code ? normalized.code.trim().toUpperCase() : '';

    if (idKey && seenIds.has(idKey)) continue;
    if (codeKey && seenCodes.has(codeKey)) continue;

    if (idKey) seenIds.add(idKey);
    if (codeKey) seenCodes.add(codeKey);

    deduped.push(normalized);
  }

  return deduped;
}

