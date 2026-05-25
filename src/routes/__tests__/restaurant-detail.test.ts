import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/router', () => ({ navigate: vi.fn() }));
vi.mock('@/api/content', () => ({ getRestaurant: vi.fn() }));
vi.mock('@/api/reviews', () => ({ listReviewsForRestaurant: vi.fn() }));

import detail from '../restaurant-detail';
import * as content from '@/api/content';
import * as reviews from '@/api/reviews';
import * as router from '@/router';

const mockedContent = content as unknown as { getRestaurant: ReturnType<typeof vi.fn> };
const mockedReviews = reviews as unknown as { listReviewsForRestaurant: ReturnType<typeof vi.fn> };
const mockedRouter = router as unknown as { navigate: ReturnType<typeof vi.fn> };

const restaurant = {
  id: 5,
  name: '草盛園',
  address: '台北市中山區雙城街',
  lat: 25.06, lng: 121.52,
  place_type: 'chinese',
  pin_color: 'green' as const,
  is_partner: 1,
  partner_discount: '8 折',
};

describe('restaurant-detail route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders header skeleton synchronously', () => {
    mockedContent.getRestaurant.mockResolvedValue(null);
    mockedReviews.listReviewsForRestaurant.mockResolvedValue([]);
    const el = detail({ id: '5' });
    expect(el.querySelector('#title')?.textContent).toBe('載入中…');
    expect(el.querySelector('#meta')).not.toBeNull();
  });

  it('populates name, address, partner tag, discount after load', async () => {
    mockedContent.getRestaurant.mockResolvedValue(restaurant);
    mockedReviews.listReviewsForRestaurant.mockResolvedValue([]);
    const el = detail({ id: '5' });
    await vi.waitFor(() => expect(el.querySelector('#title')?.textContent).toBe('草盛園'));
    expect(el.textContent).toContain('台北市中山區雙城街');
    expect(el.querySelector('.map-partner-tag')).not.toBeNull();
    expect(el.textContent).toContain('8 折');
  });

  it('shows empty state when no reviews', async () => {
    mockedContent.getRestaurant.mockResolvedValue(restaurant);
    mockedReviews.listReviewsForRestaurant.mockResolvedValue([]);
    const el = detail({ id: '5' });
    await vi.waitFor(() => {
      expect(el.querySelector('.reviews-empty')?.textContent).toContain('還沒有評論');
    });
  });

  it('renders a list of reviews when present', async () => {
    mockedContent.getRestaurant.mockResolvedValue(restaurant);
    mockedReviews.listReviewsForRestaurant.mockResolvedValue([
      {
        id: 1, user_id: 1, restaurant_id: 5,
        rating: 4, text: 'Tasty', photo_id: null,
        vegan_type: '全素', status: 'approved',
        created_at: '2026-01-01 12:00:00',
      },
    ]);
    const el = detail({ id: '5' });
    await vi.waitFor(() => {
      expect(el.querySelectorAll('.review-item').length).toBe(1);
    });
    expect(el.textContent).toContain('Tasty');
    expect(el.textContent).toContain('全素');
    expect(el.textContent).toContain('★★★★☆');
  });

  it('back button routes to /map; add-review routes to /map/restaurant/:id/review', async () => {
    mockedContent.getRestaurant.mockResolvedValue(restaurant);
    mockedReviews.listReviewsForRestaurant.mockResolvedValue([]);
    const el = detail({ id: '5' });
    el.querySelector<HTMLButtonElement>('#back-btn')?.click();
    expect(mockedRouter.navigate).toHaveBeenCalledWith('/map');
    el.querySelector<HTMLButtonElement>('#add-review')?.click();
    // add-review now passes through requireRealName before navigating,
    // so the navigate fires in a microtask after the click handler awaits.
    await vi.waitFor(() => {
      expect(mockedRouter.navigate).toHaveBeenCalledWith('/map/restaurant/5/review');
    });
  });
});
