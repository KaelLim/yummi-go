/**
 * Store winners — public 中獎名單 for the Gem store's second tab.
 *
 * drust `store_winners` is the source of truth (admin writes rows from
 * the monthly draw export). The fixture in `lib/fixtures/store-winners`
 * stands in until drust has the collection seeded.
 *
 * Display rules:
 *   - display_name is rendered with `maskName()` so we never reveal
 *     the full identifier on a public list (e.g. "Demo User" → "D***").
 *   - listVisibleWinners groups by banner_id at the caller's discretion;
 *     we return the flat list sorted newest-first.
 */
import { drust } from './drust';
import { STORE_WINNERS_FIXTURE } from '@/lib/fixtures/store-winners';

export interface StoreWinner {
  id: number;
  banner_id: number;
  banner_title: string;
  /** Display name kept for back-compat / fallback (e.g. when email
   *  is missing). The winners tab now shows masked email by default. */
  display_name: string;
  /** Google email of the winner. Stored so the public list can show
   *  the email's first 3 chars instead of the display-name initial. */
  email: string | null;
  drawn_at: string;
}

export async function listVisibleWinners(): Promise<StoreWinner[]> {
  try {
    const result = await drust.list<StoreWinner>('store_winners', { limit: '100' });
    if (result.records.length > 0) {
      return result.records.slice().sort((a, b) => b.drawn_at.localeCompare(a.drawn_at));
    }
  } catch (err) {
    console.warn('[store] listVisibleWinners drust read failed, using fixture:', err);
  }
  return STORE_WINNERS_FIXTURE
    .slice()
    .sort((a, b) => b.drawn_at.localeCompare(a.drawn_at));
}

/**
 * Mask an email so the public winners list shows just the first 3
 * characters of the local part + stars + the domain. e.g.
 *   "demo.user@gmail.com" → "dem***@gmail.com"
 *   "ab@gmail.com"        → "ab***@gmail.com"
 *   "a@gmail.com"         → "a***@gmail.com"
 * Strings without an "@" (e.g. legacy display names) fall back to
 * "first 3 chars + ***".
 */
export function maskEmail(s: string): string {
  if (!s) return '＊＊＊';
  const atIdx = s.indexOf('@');
  if (atIdx <= 0) {
    const head = s.slice(0, 3);
    return head + '***';
  }
  const local = s.slice(0, atIdx);
  const domain = s.slice(atIdx); // includes '@'
  const head = local.slice(0, 3);
  return head + '***' + domain;
}

/** Legacy name-masker kept for callers that still pass a display
 *  name (no @). Internally just forwards to maskEmail's no-at path. */
export function maskName(s: string): string {
  return maskEmail(s);
}
