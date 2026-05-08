import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/router', () => ({ navigate: vi.fn() }));
vi.mock('@/api/reviews', () => ({ createReview: vi.fn().mockResolvedValue({}) }));
vi.mock('@/api/check-ins', () => ({ createCheckIn: vi.fn().mockResolvedValue({}) }));
vi.mock('@/api/content', () => ({ getRestaurant: vi.fn().mockResolvedValue({ id: 5, name: '草盛園' }) }));
vi.mock('@/store/pet', () => ({ awardXp: vi.fn().mockResolvedValue(undefined) }));

import review from '../restaurant-review';
import { $user } from '@/store/user';
import * as router from '@/router';
import * as reviewApi from '@/api/reviews';
import * as checkApi from '@/api/check-ins';

const mockedRouter = router as unknown as { navigate: ReturnType<typeof vi.fn> };
const mockedCreateReview = reviewApi.createReview as unknown as ReturnType<typeof vi.fn>;
const mockedCreateCheckIn = checkApi.createCheckIn as unknown as ReturnType<typeof vi.fn>;

describe('restaurant-review route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    $user.set({ id: 7, username: 'u', displayName: 'u' });
    vi.spyOn(window, 'alert').mockImplementation(() => {});
  });

  it('renders 5 stars + 4 vegan-type chips', () => {
    const el = review({ id: '5' });
    expect(el.querySelectorAll('.star').length).toBe(5);
    expect(el.querySelectorAll('.vegan-chip').length).toBe(4);
    expect(el.querySelector('#as-checkin')).not.toBeNull();
  });

  it('submitting without rating shows error', () => {
    const el = review({ id: '5' });
    el.querySelector<HTMLFormElement>('#form')?.requestSubmit();
    expect(el.querySelector<HTMLElement>('#error')?.hidden).toBe(false);
    expect(el.querySelector<HTMLElement>('#error')?.textContent).toContain('評分');
  });

  it('submits review-only and routes to detail', async () => {
    const el = review({ id: '5' });
    document.body.appendChild(el);
    el.querySelector<HTMLButtonElement>('.star[data-value="4"]')?.click();
    el.querySelector<HTMLFormElement>('#form')?.requestSubmit();
    await vi.waitFor(() =>
      expect(mockedRouter.navigate).toHaveBeenCalledWith('/map/restaurant/5'),
    );
    expect(mockedCreateReview).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 7, restaurantId: 5, rating: 4 }),
    );
    expect(mockedCreateCheckIn).not.toHaveBeenCalled();
    el.remove();
  });

  it('with as-checkin checked, also creates check-in and routes to /check-in/success', async () => {
    const el = review({ id: '5' });
    document.body.appendChild(el);
    el.querySelector<HTMLButtonElement>('.star[data-value="5"]')?.click();
    (el.querySelector<HTMLInputElement>('#as-checkin')!).checked = true;
    el.querySelector<HTMLFormElement>('#form')?.requestSubmit();
    await vi.waitFor(() =>
      expect(mockedRouter.navigate).toHaveBeenCalledWith('/check-in/success'),
    );
    expect(mockedCreateReview).toHaveBeenCalled();
    expect(mockedCreateCheckIn).toHaveBeenCalled();
    el.remove();
  });
});
