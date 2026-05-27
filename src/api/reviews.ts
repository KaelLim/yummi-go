/**
 * Restaurant reviews module — anon-callable CRUD on restaurant_reviews.
 *
 * Default `status` on insert is 'pending' (per drust schema default_value);
 * the moderation queue / approval pipeline is out of scope for the prototype
 * — reviews land directly visible on the detail page.
 */
import { drust } from './drust';

export interface RestaurantReview {
  id: number;
  user_id: number;
  restaurant_id: number;
  rating: number;
  text: string | null;
  photo_id: string | null;
  vegan_type: string | null;
  status: string;
  created_at: string;
}

export interface CreateReviewArgs {
  userId: number;
  restaurantId: number;
  rating: number;
  text?: string | null;
  photoId?: string | null;
  veganType?: string | null;
}

export async function createReview(args: CreateReviewArgs): Promise<RestaurantReview> {
  const result = await drust.insert<RestaurantReview>('restaurant_reviews', {
    user_id: args.userId,
    restaurant_id: args.restaurantId,
    rating: args.rating,
    text: args.text ?? null,
    photo_id: args.photoId ?? null,
    vegan_type: args.veganType ?? null,
  });
  return result.record;
}

export interface UpdateReviewArgs {
  rating: number;
  text?: string | null;
  photoId?: string | null;
  veganType?: string | null;
}

export async function updateReview(
  reviewId: number,
  args: UpdateReviewArgs,
): Promise<RestaurantReview> {
  const result = await drust.update<RestaurantReview>('restaurant_reviews', reviewId, {
    rating: args.rating,
    text: args.text ?? null,
    photo_id: args.photoId ?? null,
    vegan_type: args.veganType ?? null,
  });
  // Track the edit timestamp client-side so the 24h / 1× rule (§4.6) can
  // be enforced without a schema change to restaurant_reviews. localStorage
  // is per-device, which is acceptable for the prototype — worst case a
  // user on a fresh device can re-edit, but the prod schema is expected
  // to gain an `edited_at` column before launch.
  markReviewEdited(reviewId);
  return result.record;
}

export async function deleteReview(reviewId: number): Promise<void> {
  await drust.delete('restaurant_reviews', reviewId);
}

/**
 * drust list filters are silently ignored (see api/profile.ts), so the
 * restaurant_id / user_id filter happens client-side after fetching the
 * up-to-20-row page. Holds while total reviews stay small; needs an RPC
 * once the prototype expects real review volume.
 */
export async function listReviewsForRestaurant(
  restaurantId: number,
): Promise<RestaurantReview[]> {
  const result = await drust.list<RestaurantReview>('restaurant_reviews', {
    sort: 'id',
  });
  return result.records.filter((r) => r.restaurant_id === restaurantId);
}

export async function listMyReviews(userId: number): Promise<RestaurantReview[]> {
  const result = await drust.list<RestaurantReview>('restaurant_reviews', {
    sort: 'id',
  });
  return result.records.filter((r) => r.user_id === userId);
}

/**
 * Has this user already reviewed this restaurant? Used to drive the
 * UX_UPDATE_SPEC v0.3 §4 rule: 20 XP for the first review per restaurant
 * per user, 15 XP for each subsequent review. drust's `list` filter is
 * ignored server-side, so we fetch the page and check client-side. Fine
 * at prototype scale (small review volume).
 */
export async function hasReviewedRestaurant(
  userId: number,
  restaurantId: number,
): Promise<boolean> {
  try {
    const rows = await listReviewsForRestaurant(restaurantId);
    return rows.some((r) => r.user_id === userId);
  } catch {
    // Soft-fail on network: assume not reviewed so the user gets the
    // higher XP — better to over-pay on a transient error than to
    // silently under-pay.
    return false;
  }
}

export const REVIEW_XP_FIRST = 20;
export const REVIEW_XP_REPEAT = 15;

/** Spec §4.6: minimum window between create and first allowed delete. */
export const REVIEW_DELETE_LOCK_MS = 30 * 60 * 1000;
/** Spec §4.6: 1 edit per 24h, tracked via localStorage timestamp. */
export const REVIEW_EDIT_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const REVIEW_EDITED_AT_KEY = 'yummi:review_edited';

interface EditedAtMap {
  [reviewId: string]: string; // ISO timestamp of last edit
}

function readEditedAtMap(): EditedAtMap {
  try {
    const raw = localStorage.getItem(REVIEW_EDITED_AT_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as EditedAtMap;
  } catch {
    return {};
  }
}

function writeEditedAtMap(m: EditedAtMap): void {
  try {
    localStorage.setItem(REVIEW_EDITED_AT_KEY, JSON.stringify(m));
  } catch {
    // localStorage full or disabled — accept the loss; the API still
    // updated the row, only the 24h client-side cooldown is degraded.
  }
}

export function markReviewEdited(reviewId: number, atIso?: string): void {
  const m = readEditedAtMap();
  m[String(reviewId)] = atIso ?? new Date().toISOString();
  writeEditedAtMap(m);
}

export function reviewEditedAt(reviewId: number): Date | null {
  const m = readEditedAtMap();
  const v = m[String(reviewId)];
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Look up the user's own review for a restaurant, if any. Used by the
 * review form to flip into edit mode (spec §4.6 — 1 user × 1 restaurant
 * = 1 review). Returns null on no match or transient error.
 */
export async function getMyReviewForRestaurant(
  userId: number,
  restaurantId: number,
): Promise<RestaurantReview | null> {
  try {
    const rows = await listReviewsForRestaurant(restaurantId);
    return rows.find((r) => r.user_id === userId) ?? null;
  } catch {
    return null;
  }
}

/**
 * Returns all reviews drust will give us in one list call (capped at 20
 * rows server-side until an RPC replaces this). Used by the map page to
 * compute per-restaurant vegan-tier consensus — once 3+ reviewers agree
 * on a tier for a restaurant, that tier shows as a tag on the pin's
 * bottom card.
 */
export async function listAllReviews(): Promise<RestaurantReview[]> {
  const result = await drust.list<RestaurantReview>('restaurant_reviews', {
    sort: 'id',
  });
  return result.records;
}

/**
 * Aggregate consensus vegan_type tiers per restaurant.
 *
 * Each review's `vegan_type` is treated as a comma-separated list, so a
 * single review tagged "全素,蛋奶素" contributes to both buckets. A tier
 * surfaces in the result for a restaurant once it's been picked by at
 * least `threshold` distinct reviews (default 3).
 *
 * Result shape: `Map<restaurantId, string[]>` where the string[] preserves
 * insertion order (most-picked tier first within each restaurant).
 */
export function aggregateConsensusTiers(
  reviews: RestaurantReview[],
  threshold = 3,
): Map<number, string[]> {
  const counts = new Map<number, Map<string, number>>();
  for (const r of reviews) {
    if (!r.vegan_type) continue;
    const tiers = r.vegan_type
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (tiers.length === 0) continue;
    let perRest = counts.get(r.restaurant_id);
    if (!perRest) {
      perRest = new Map();
      counts.set(r.restaurant_id, perRest);
    }
    for (const t of tiers) {
      perRest.set(t, (perRest.get(t) ?? 0) + 1);
    }
  }
  const out = new Map<number, string[]>();
  for (const [restId, perRest] of counts) {
    const winners = [...perRest.entries()]
      .filter(([, c]) => c >= threshold)
      .sort((a, b) => b[1] - a[1])
      .map(([t]) => t);
    if (winners.length > 0) out.set(restId, winners);
  }
  return out;
}
