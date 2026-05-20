/**
 * Streak derivation — counts consecutive challenge days with at least one
 * check-in, ending at "today" (or the most recent prior day if today has
 * no check-in yet — today isn't a "miss" until midnight passes).
 *
 * Per the makeup spec (docs/UX_UPDATE_SPEC_v0.1 §5), a streak only "dies"
 * after four consecutive missed days. So this walker tolerates up to three
 * consecutive misses without breaking the count — the count keeps climbing
 * over any earlier check-ins within that window. Once we see four misses
 * in a row, we stop, since the streak is officially dead from that point
 * backwards.
 *
 * For UI display today (PR-1) this is good enough on its own. PR-3 will
 * layer "marked-as-made-up" semantics on top by passing the user's
 * already-made-up days into `madeUpDays`, which behave like a check-in
 * for streak purposes.
 */
import type { CheckInRow } from '@/api/check-ins';

export const STREAK_DEATH_THRESHOLD = 4;

export interface DeriveStreakArgs {
  /** Rows for one user; any source is fine — we only read `day_number`. */
  checkIns: Pick<CheckInRow, 'day_number'>[];
  /** Today's challenge day (from $today.dayNumber). */
  todayDayNumber: number;
  /** Optional: days the user has made up via /tasks/makeup. */
  madeUpDays?: number[];
}

export function deriveStreak({
  checkIns,
  todayDayNumber,
  madeUpDays = [],
}: DeriveStreakArgs): number {
  if (todayDayNumber < 1) return 0;

  const counted = new Set<number>();
  for (const c of checkIns) counted.add(c.day_number);
  for (const d of madeUpDays) counted.add(d);

  // If today hasn't been checked in yet, don't start counting from a "miss".
  // Start from yesterday so an unchecked-in but ongoing today doesn't reset
  // the user's visible streak.
  let startDay = todayDayNumber;
  if (!counted.has(startDay)) startDay -= 1;
  if (startDay < 1) return 0;

  let streak = 0;
  let consecMisses = 0;
  for (let d = startDay; d >= 1; d--) {
    if (counted.has(d)) {
      streak++;
      consecMisses = 0;
    } else {
      consecMisses++;
      if (consecMisses >= STREAK_DEATH_THRESHOLD) break;
    }
  }
  return streak;
}
