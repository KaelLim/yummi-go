import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/api/drust', () => ({
  drust: {
    insert: vi.fn(),
    list: vi.fn(),
  },
}));

import { drust } from '@/api/drust';
import { createReview, listReviewsForRestaurant, listMyReviews } from '../reviews';

const mocked = drust as unknown as {
  insert: ReturnType<typeof vi.fn>;
  list: ReturnType<typeof vi.fn>;
};

describe('reviews api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createReview', () => {
    it('inserts with required + optional fields', async () => {
      mocked.insert.mockResolvedValueOnce({ id: 1, record: { id: 1 } });
      await createReview({
        userId: 7,
        restaurantId: 3,
        rating: 4,
        text: '不錯',
        veganType: '全素',
      });
      expect(mocked.insert).toHaveBeenCalledWith('restaurant_reviews', {
        user_id: 7,
        restaurant_id: 3,
        rating: 4,
        text: '不錯',
        photo_id: null,
        vegan_type: '全素',
      });
    });

    it('passes nulls for optional fields when omitted', async () => {
      mocked.insert.mockResolvedValueOnce({ id: 2, record: { id: 2 } });
      await createReview({ userId: 1, restaurantId: 2, rating: 5 });
      expect(mocked.insert.mock.calls[0][1]).toMatchObject({
        text: null,
        photo_id: null,
        vegan_type: null,
      });
    });
  });

  describe('listReviewsForRestaurant', () => {
    it('client-side filters fetched reviews by restaurant_id', async () => {
      mocked.list.mockResolvedValueOnce({
        records: [
          { id: 1, restaurant_id: 3, user_id: 5 },
          { id: 2, restaurant_id: 5, user_id: 5 },
          { id: 3, restaurant_id: 3, user_id: 9 },
        ],
      });
      const out = await listReviewsForRestaurant(3);
      expect(mocked.list).toHaveBeenCalledWith('restaurant_reviews', { sort: 'id' });
      expect(out.map((r) => r.id)).toEqual([1, 3]);
    });
  });

  describe('listMyReviews', () => {
    it('client-side filters fetched reviews by user_id', async () => {
      mocked.list.mockResolvedValueOnce({
        records: [
          { id: 1, restaurant_id: 3, user_id: 7 },
          { id: 2, restaurant_id: 5, user_id: 1 },
        ],
      });
      const out = await listMyReviews(7);
      expect(mocked.list).toHaveBeenCalledWith('restaurant_reviews', { sort: 'id' });
      expect(out.map((r) => r.id)).toEqual([1]);
    });
  });
});
