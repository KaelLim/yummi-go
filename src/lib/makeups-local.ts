/**
 * Prototype-only localStorage tracking of made-up days.
 *
 * Per UX_UPDATE_SPEC_v0.1 §5, makeup is "direct Gem payment, no card item"
 * — which is a clean model, but the back-end column doesn't exist yet.
 * This module fakes persistence in localStorage so the calendar prototype
 * can demo correctly; a future PR will migrate to a drust column (e.g.
 * user_profiles.made_up_days JSON list, or a makeups table).
 *
 * Stored shape: `{ days: number[], history: { day: number, gemCost: number,
 * madeAt: string }[] }` keyed by user id. `days` is the canonical set;
 * `history` is for the modal's debt-tracking math (count of makeups in
 * the current month → tier the cost).
 */

const KEY_PREFIX = 'yummi:makeups:';

export interface MakeupHistoryEntry {
  day: number;
  gemCost: number;
  madeAt: string; // ISO timestamp
}

export interface MakeupState {
  days: number[];
  history: MakeupHistoryEntry[];
}

const EMPTY: MakeupState = { days: [], history: [] };

function key(userId: number): string {
  return KEY_PREFIX + userId;
}

export function readMakeups(userId: number): MakeupState {
  try {
    const raw = localStorage.getItem(key(userId));
    if (!raw) return { ...EMPTY };
    const parsed = JSON.parse(raw) as MakeupState;
    return {
      days: Array.isArray(parsed.days) ? parsed.days : [],
      history: Array.isArray(parsed.history) ? parsed.history : [],
    };
  } catch {
    return { ...EMPTY };
  }
}

export function recordMakeup(
  userId: number,
  entry: MakeupHistoryEntry,
): MakeupState {
  const cur = readMakeups(userId);
  if (!cur.days.includes(entry.day)) cur.days = [...cur.days, entry.day];
  cur.history = [...cur.history, entry];
  localStorage.setItem(key(userId), JSON.stringify(cur));
  return cur;
}

/** Count this user's makeups for the calendar month that contains `now`. */
export function countMakeupsInMonth(
  history: MakeupHistoryEntry[],
  now: Date = new Date(),
): number {
  const ym = now.toISOString().slice(0, 7); // "YYYY-MM"
  return history.filter((h) => h.madeAt.slice(0, 7) === ym).length;
}

/**
 * Per spec §5: 1st–3rd makeup of the month → 100 gems, 4th onwards → 300.
 * `priorThisMonth` should be the count BEFORE this makeup is recorded.
 */
export function priceFor(priorThisMonth: number): number {
  return priorThisMonth < 3 ? 100 : 300;
}
