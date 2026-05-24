import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/router', () => ({ navigate: vi.fn() }));
vi.mock('@/api/reviews', () => ({
  createReview: vi.fn().mockResolvedValue({}),
  hasReviewedRestaurant: vi.fn().mockResolvedValue(false),
  REVIEW_XP_FIRST: 20,
  REVIEW_XP_REPEAT: 15,
}));
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

  it('submitting without 素別 shows error (now required)', () => {
    const el = review({ id: '5' });
    el.querySelector<HTMLButtonElement>('.star[data-value="4"]')?.click();
    el.querySelector<HTMLFormElement>('#form')?.requestSubmit();
    expect(el.querySelector<HTMLElement>('#error')?.hidden).toBe(false);
    expect(el.querySelector<HTMLElement>('#error')?.textContent).toContain('素別');
  });

  it('review-only submit replaces the form with a success card (no nav fires)', async () => {
    const el = review({ id: '5' });
    document.body.appendChild(el);
    el.querySelector<HTMLButtonElement>('.star[data-value="4"]')?.click();
    el.querySelector<HTMLButtonElement>('.vegan-chip')?.click();
    el.querySelector<HTMLFormElement>('#form')?.requestSubmit();
    await vi.waitFor(() =>
      expect(el.querySelector('.review-success')).not.toBeNull(),
    );
    expect(mockedCreateReview).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 7, restaurantId: 5, rating: 4 }),
    );
    expect(mockedCreateCheckIn).not.toHaveBeenCalled();
    // Form stays mounted — navigation only fires after the user taps 回到店家.
    expect(mockedRouter.navigate).not.toHaveBeenCalled();
    el.remove();
  });

  it('回到地圖 button on success card routes back to /map', async () => {
    const el = review({ id: '5' });
    document.body.appendChild(el);
    el.querySelector<HTMLButtonElement>('.star[data-value="4"]')?.click();
    el.querySelector<HTMLButtonElement>('.vegan-chip')?.click();
    el.querySelector<HTMLFormElement>('#form')?.requestSubmit();
    await vi.waitFor(() =>
      expect(el.querySelector('#back-to-map')).not.toBeNull(),
    );
    el.querySelector<HTMLButtonElement>('#back-to-map')?.click();
    expect(mockedRouter.navigate).toHaveBeenCalledWith('/map');
    el.remove();
  });

  it('with as-checkin checked, also creates check-in and shows nutrition card', async () => {
    const el = review({ id: '5' });
    document.body.appendChild(el);
    el.querySelector<HTMLButtonElement>('.star[data-value="5"]')?.click();
    el.querySelector<HTMLButtonElement>('.vegan-chip')?.click();
    (el.querySelector<HTMLInputElement>('#as-checkin')!).checked = true;
    el.querySelector<HTMLFormElement>('#form')?.requestSubmit();
    await vi.waitFor(() =>
      expect(el.querySelector('.nutrition-card')).not.toBeNull(),
    );
    expect(mockedCreateReview).toHaveBeenCalled();
    expect(mockedCreateCheckIn).toHaveBeenCalled();
    // Reuses the check-in success layout: 5 cells (cal / protein / carb
    // / fat / fiber) in `.nutrition-grid`.
    expect(el.querySelectorAll('.nutrition-cell').length).toBe(5);
    el.remove();
  });
});
