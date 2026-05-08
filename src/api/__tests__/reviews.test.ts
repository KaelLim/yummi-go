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
    it('filters by restaurant_id and sorts by id', async () => {
      mocked.list.mockResolvedValueOnce({ records: [{ id: 9 }] });
      const out = await listReviewsForRestaurant(3);
      expect(mocked.list).toHaveBeenCalledWith('restaurant_reviews', {
        restaurant_id: 'eq.3',
        sort: 'id',
        limit: '100',
      });
      expect(out).toHaveLength(1);
    });
  });

  describe('listMyReviews', () => {
    it('filters by user_id', async () => {
      mocked.list.mockResolvedValueOnce({ records: [] });
      await listMyReviews(7);
      expect(mocked.list).toHaveBeenCalledWith('restaurant_reviews', {
        user_id: 'eq.7',
        sort: 'id',
        limit: '100',
      });
    });
  });
});
