/**
 * Store banners — Gem-store campaign promos.
 *
 * Read-only API. drust's `store_banners` collection is the source of
 * truth; this module wraps the list + filter logic so callers don't
 * have to deal with the status enum. The fixture in
 * `lib/fixtures/store-banners.ts` serves as a fallback when drust is
 * unreachable or hasn't been seeded yet.
 *
 * Status semantics:
 *   active   — render full colour, tappable
 *   disabled — render greyed image with 「已結束」 overlay, not tappable
 *   archive  — never returned by listVisibleBanners; hidden from UI
 */
import { drust } from './drust';
import { STORE_BANNERS_FIXTURE } from '@/lib/fixtures/store-banners';

export interface StoreBanner {
  id: number;
  title: string;
  description: string | null;
  image_url: string | null;
  /** 'active' | 'disabled' | 'archive' */
  status: string;
  cost_gems: number;
  /** Redeem URL — opens SurveyCake (or wherever) with anonId +
   *  googleEmail appended. Surfaced as the "兌換" button. */
  surveycake_url: string | null;
  /** Standalone "詳細" URL — campaign landing / partner microsite that
   *  doesn't take query params. Surfaced as a sibling button next to
   *  redeem. Falls back to surveycake_url when empty so old fixtures
   *  still render two buttons. */
  detail_url: string | null;
  partner_name: string | null;
  monthly_limit: number | null;
  sort_order: number;
}

/**
 * Returns banners with status === 'active' or 'disabled', sorted by
 * sort_order. Archive rows are omitted entirely.
 *
 * Falls back to the fixture when drust returns nothing or throws.
 */
export async function listVisibleBanners(): Promise<StoreBanner[]> {
  try {
    const result = await drust.list<StoreBanner>('store_banners', { limit: '50' });
    const live = result.records
      .filter((b) => b.status !== 'archive')
      .sort((a, b) => a.sort_order - b.sort_order);
    if (live.length > 0) return live;
  } catch (err) {
    console.warn('[store] listVisibleBanners drust read failed, using fixture:', err);
  }
  return STORE_BANNERS_FIXTURE
    .filter((b) => b.status !== 'archive')
    .sort((a, b) => a.sort_order - b.sort_order);
}

/**
 * Build the deep link to SurveyCake with the user's identifiers
 * appended as query params, so the form can pre-fill them and the
 * downstream gem-deduction webhook (Phase B) can attribute the
 * submission. Returns null when the banner has no surveycake_url
 * (e.g. disabled banners or admin oversight).
 */
export function buildSurveycakeUrl(
  banner: StoreBanner,
  args: { anonId: number; googleEmail: string | null },
): string | null {
  if (!banner.surveycake_url) return null;
  const url = new URL(banner.surveycake_url);
  url.searchParams.set('anonId', String(args.anonId));
  if (args.googleEmail) url.searchParams.set('googleEmail', args.googleEmail);
  return url.toString();
}
