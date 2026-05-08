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
