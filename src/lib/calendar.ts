/**
 * Month-grid builder for the calendar page.
 *
 * Maps each calendar date in the target month to a status the calendar
 * cell can render directly. Status tiers (per UX_UPDATE_SPEC_v0.1 §5):
 *
 *   - 'done'      — has a check-in for that challenge day (green check,
 *                   permanent). Also used for makeup-completed days.
 *   - 'makeable'  — within the last 3 calendar days, no check-in yet,
 *                   streak is still alive (gray dot, tappable).
 *   - 'lost'      — older than 3 days, no check-in, no makeup.
 *   - 'future'    — calendar date > today.
 *   - 'pre'       — calendar date < challenge_started_at.
 *   - 'today'     — calendar date === today (plain bold number).
 *
 * The calendar shows real calendar dates, not challenge day_numbers — but
 * each in-challenge date maps to a `dayNumber` (1-30) that we use to
 * cross-reference check-ins.
 */

export type DayStatus = 'done' | 'makeable' | 'lost' | 'future' | 'pre' | 'today';

export interface CalendarCell {
  /** ISO date string YYYY-MM-DD. */
  iso: string;
  /** Day of month (1-31). */
  dayOfMonth: number;
  /** Mapped challenge day_number, or null if outside the 30-day window. */
  dayNumber: number | null;
  status: DayStatus;
}

export interface BuildCalendarArgs {
  /** Anchor month, defaults to the month containing `now`. */
  anchor?: Date;
  now: Date;
  challengeStartedAt: Date | null;
  challengeLengthDays?: number;
  /** Set of challenge day_numbers the user has a check-in for. */
  checkedInDays: Set<number>;
  /** Set of challenge day_numbers the user has made up. */
  madeUpDays: Set<number>;
}

const MS_PER_DAY = 86400_000;
/**
 * A missed day stays makeable for 72 hours (≈ 3 calendar-day window from
 * the start of the missed day). After that the day rolls to `lost` and
 * is no longer payable per UX_UPDATE_SPEC v0.3 §6. The 72h is a per-day
 * countdown, independent of streak state (losing one streak day does
 * not shorten this window; the rule is purely time-based).
 */
const MAKEUP_WINDOW_DAYS = 3;

function isoDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Build a calendar grid for the anchor month. Returns 6 weeks worth of
 * cells starting on Sunday of the week containing the 1st — leading days
 * from the prior month and trailing days from the next month are included
 * so the grid is always 42 cells.
 */
export function buildCalendar({
  anchor,
  now,
  challengeStartedAt,
  challengeLengthDays = 30,
  checkedInDays,
  madeUpDays,
}: BuildCalendarArgs): CalendarCell[] {
  const today = startOfDay(now);
  const anchorMonth = anchor ? new Date(anchor.getFullYear(), anchor.getMonth(), 1) : new Date(today.getFullYear(), today.getMonth(), 1);
  const startWeekday = anchorMonth.getDay(); // 0 = Sunday
  const gridStart = new Date(anchorMonth);
  gridStart.setDate(anchorMonth.getDate() - startWeekday);

  const cells: CalendarCell[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    cells.push(makeCell(d, today, challengeStartedAt, challengeLengthDays, checkedInDays, madeUpDays));
  }
  return cells;
}

function makeCell(
  d: Date,
  today: Date,
  startedAt: Date | null,
  lengthDays: number,
  checkedInDays: Set<number>,
  madeUpDays: Set<number>,
): CalendarCell {
  const iso = isoDate(d);
  const dayOfMonth = d.getDate();

  // dayNumber = floor((d - startedAt) / 1day) + 1, only within the challenge window.
  let dayNumber: number | null = null;
  if (startedAt) {
    const start = startOfDay(startedAt);
    const diff = Math.round((d.getTime() - start.getTime()) / MS_PER_DAY);
    if (diff >= 0 && diff < lengthDays) dayNumber = diff + 1;
  }

  // Date-based status overrides first.
  if (d.getTime() > today.getTime()) {
    return { iso, dayOfMonth, dayNumber, status: 'future' };
  }
  if (d.getTime() === today.getTime()) {
    return { iso, dayOfMonth, dayNumber, status: 'today' };
  }
  if (dayNumber === null) {
    return { iso, dayOfMonth, dayNumber, status: 'pre' };
  }

  // Past in-challenge day.
  if (checkedInDays.has(dayNumber) || madeUpDays.has(dayNumber)) {
    return { iso, dayOfMonth, dayNumber, status: 'done' };
  }
  const daysAgo = Math.round((today.getTime() - d.getTime()) / MS_PER_DAY);
  if (daysAgo <= MAKEUP_WINDOW_DAYS) {
    return { iso, dayOfMonth, dayNumber, status: 'makeable' };
  }
  return { iso, dayOfMonth, dayNumber, status: 'lost' };
}
