/**
 * /store/banner/:id — in-app banner detail page.
 *
 * Covers:
 *  - Header back button navigates to /store
 *  - Active banner renders image / partner / title / description /
 *    meta rows / redeem CTA
 *  - Redeem CTA opens the SurveyCake URL in a new tab (with anonId
 *    appended) when the user has a non-guest name
 *  - Disabled banner shows the 已結束 badge instead of the CTA
 *  - Unknown id renders the fallback "查無此活動" state
 *  - Partner-microsite link is INTENTIONALLY absent (removed
 *    2026-06-22 — the detail page shouldn't bounce out externally)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/router', () => ({ navigate: vi.fn() }));
vi.mock('@/api/store-banners', () => ({
  listVisibleBanners: vi.fn(),
  buildSurveycakeUrl: vi.fn(
    (b, args) => (b.surveycake_url ? `${b.surveycake_url}?anonId=${args.anonId}` : null),
  ),
}));
vi.mock('@/lib/name-prompt', () => ({
  requireRealName: vi.fn().mockResolvedValue(undefined),
  hasGuestName: vi.fn(() => false),
}));

import storeBannerDetail from '../store-banner-detail';
import { $user, $profile } from '@/store/user';
import { $locale } from '@/lib/i18n';
import * as router from '@/router';
import * as bannersApi from '@/api/store-banners';
import * as namePrompt from '@/lib/name-prompt';

const mockedRouter = router as unknown as { navigate: ReturnType<typeof vi.fn> };
const mockedList = bannersApi.listVisibleBanners as unknown as ReturnType<typeof vi.fn>;
const mockedBuild = bannersApi.buildSurveycakeUrl as unknown as ReturnType<typeof vi.fn>;
const mockedHasGuest = namePrompt.hasGuestName as unknown as ReturnType<typeof vi.fn>;

const activeBanner = {
  id: 1,
  title: '蓮香齋 8 折用餐券',
  description: '本月限量 30 張，填寫資料後抽獎',
  image_url: null,
  status: 'active',
  cost_gems: 50,
  surveycake_url: 'https://surveycake.example/lianxiang',
  detail_url: 'https://example.com/lianxiang',
  partner_name: '蓮香齋',
  monthly_limit: 30,
  sort_order: 1,
};
const disabledBanner = { ...activeBanner, id: 2, status: 'disabled', title: 'Verde 已結束活動' };

describe('store-banner-detail route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    $user.set({ id: 42, username: 'kael', displayName: '阿凱' });
    $profile.set(null);
    $locale.set('zh');
    mockedHasGuest.mockReturnValue(false);
    // jsdom doesn't implement window.open — stub it.
    vi.spyOn(window, 'open').mockReturnValue(null);
  });

  it('back button returns to /store', async () => {
    mockedList.mockResolvedValue([activeBanner]);
    const el = await storeBannerDetail({ id: '1' });
    el.querySelector<HTMLButtonElement>('#back-btn')?.click();
    expect(mockedRouter.navigate).toHaveBeenCalledWith('/store');
  });

  it('renders active banner content + redeem CTA', async () => {
    mockedList.mockResolvedValue([activeBanner]);
    const el = await storeBannerDetail({ id: '1' });
    expect(el.querySelector('.store-detail-title')?.textContent).toBe(activeBanner.title);
    expect(el.querySelector('.store-detail-partner')?.textContent).toBe('蓮香齋');
    expect(el.querySelector('.store-detail-desc')?.textContent).toBe(activeBanner.description);
    // Meta rows show monthly limit + cost.
    const metaText = el.querySelector('.store-detail-meta-rows')?.textContent ?? '';
    expect(metaText).toContain('30');
    expect(metaText).toContain('50');
    // Redeem CTA present + carries gem icon + amount.
    const cta = el.querySelector<HTMLButtonElement>('#redeem-btn');
    expect(cta).not.toBeNull();
    expect(cta?.textContent).toContain('50');
    // Partner microsite link explicitly removed.
    expect(el.querySelector('.store-detail-partner-link')).toBeNull();
  });

  it('redeem CTA opens the SurveyCake URL with anonId appended', async () => {
    mockedList.mockResolvedValue([activeBanner]);
    const el = await storeBannerDetail({ id: '1' });
    el.querySelector<HTMLButtonElement>('#redeem-btn')?.click();
    await vi.waitFor(() =>
      expect(mockedBuild).toHaveBeenCalledWith(
        expect.objectContaining({ id: 1 }),
        expect.objectContaining({ anonId: 42 }),
      ),
    );
    await vi.waitFor(() =>
      expect(window.open).toHaveBeenCalledWith(
        'https://surveycake.example/lianxiang?anonId=42',
        '_blank',
        'noopener,noreferrer',
      ),
    );
  });

  it('renders 已結束 badge instead of redeem CTA for disabled banner', async () => {
    mockedList.mockResolvedValue([disabledBanner]);
    const el = await storeBannerDetail({ id: '2' });
    expect(el.querySelector('#redeem-btn')).toBeNull();
    expect(el.querySelector('.store-banner-ended')).not.toBeNull();
  });

  it('shows fallback when the banner id does not match any banner', async () => {
    mockedList.mockResolvedValue([activeBanner]);
    const el = await storeBannerDetail({ id: '999' });
    expect(el.querySelector('.store-detail-title')).toBeNull();
    expect(el.querySelector('.store-empty')).not.toBeNull();
    // Back button still works on fallback.
    el.querySelector<HTMLButtonElement>('#back-btn')?.click();
    expect(mockedRouter.navigate).toHaveBeenCalledWith('/store');
  });
});
