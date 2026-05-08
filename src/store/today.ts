/**
 * Today / challenge stores.
 *
 * $today tracks per-day progression: which day, accumulated xp earned today,
 * which mission keys are done, and the lucky color hint shown to the user.
 * $challenge holds the loaded scripts and the current day's script.
 *
 * Mission writes are persisted to drust's `daily_progress` table — one row
 * per (user_id, day_number). The store update is synchronous (UI reacts
 * immediately) and the drust upsert fires-and-forgets in the background.
 */
import { atom } from 'nanostores';
import type { ChallengeScript } from '@/api/content';
import {
  upsertDailyProgress,
  decodeMissions,
  type DailyProgressRow,
} from '@/api/daily-progress';
import { $user } from './user';

export interface TodayStoreShape {
  dayNumber: number;
  totalXpToday: number;
  missionsDone: string[];
  luckyColor: string;
}

export const $today = atom<TodayStoreShape>({
  dayNumber: 1,
  totalXpToday: 0,
  missionsDone: [],
  luckyColor: '',
});

export const $challenge = atom<{
  scripts: ChallengeScript[];
  currentDay: ChallengeScript | null;
}>({ scripts: [], currentDay: null });

function fireUpsert(next: TodayStoreShape): void {
  const user = $user.get();
  if (!user) return;
  void upsertDailyProgress(user.id, next.dayNumber, {
    missions_done: next.missionsDone,
    total_xp: next.totalXpToday,
    lucky_color: next.luckyColor || null,
  }).catch((err) => console.warn('[today] persistDailyProgress failed:', err));
}

export function markMissionDone(key: string, xpEarned: number): void {
  const t = $today.get();
  if (t.missionsDone.includes(key)) return;
  const next: TodayStoreShape = {
    ...t,
    missionsDone: [...t.missionsDone, key],
    totalXpToday: t.totalXpToday + xpEarned,
  };
  $today.set(next);
  fireUpsert(next);
}

/**
 * Hydrate-only: tag a mission as done without crediting XP. Used when we
 * discover at boot/route-load that the backend already has a record (e.g.
 * a quiz_attempts row from earlier today) — XP was credited at the
 * original action, so we just want the UI flag.
 *
 * Does NOT persist to drust — assumes drust already has the row that
 * caused us to call this.
 */
export function markMissionDoneSilent(key: string): void {
  const t = $today.get();
  if (t.missionsDone.includes(key)) return;
  $today.set({ ...t, missionsDone: [...t.missionsDone, key] });
}

/** Dev-only: blank out today's progress without touching the day or scripts. */
export function resetTodayProgress(): void {
  const t = $today.get();
  const next: TodayStoreShape = { ...t, totalXpToday: 0, missionsDone: [] };
  $today.set(next);
  fireUpsert(next);
}

export function setDay(scripts: ChallengeScript[], dayNumber: number): void {
  const cur = scripts.find((s) => s.day_number === dayNumber) ?? null;
  $challenge.set({ scripts, currentDay: cur });
  // Preserve missionsDone / totalXpToday when re-hydrating the SAME day —
  // otherwise navigating between routes (each of which may trigger a
  // re-sync) clobbers in-progress state like 'eco' / 'quiz' completions.
  const prev = $today.get();
  if (prev.dayNumber === dayNumber) {
    $today.set({ ...prev, luckyColor: cur?.lucky_color ?? prev.luckyColor });
  } else {
    $today.set({
      dayNumber,
      totalXpToday: 0,
      missionsDone: [],
      luckyColor: cur?.lucky_color ?? '',
    });
  }
}

/**
 * Hydrate $today from a drust daily_progress row (after day-sync fetched
 * it). Replaces the in-memory state with whatever drust has, including
 * missions_done JSON and persisted XP. No drust write.
 */
export function loadDailyProgress(
  dayNumber: number,
  row: DailyProgressRow | null,
  fallbackLuckyColor: string,
): void {
  if (!row) {
    $today.set({
      dayNumber,
      totalXpToday: 0,
      missionsDone: [],
      luckyColor: fallbackLuckyColor,
    });
    return;
  }
  $today.set({
    dayNumber,
    totalXpToday: row.total_xp,
    missionsDone: decodeMissions(row),
    luckyColor: row.lucky_color ?? fallbackLuckyColor,
  });
}
