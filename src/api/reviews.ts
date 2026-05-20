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
