/**
 * Today / challenge stores.
 *
 * $today tracks per-day progression: which day, accumulated xp earned today,
 * which mission keys are done, and the lucky color hint shown to the user.
 * $challenge holds the loaded scripts and the current day's script.
 */
import { atom } from 'nanostores';
import type { ChallengeScript } from '@/api/content';

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

export function markMissionDone(key: string, xpEarned: number) {
  const t = $today.get();
  if (t.missionsDone.includes(key)) return;
  $today.set({
    ...t,
    missionsDone: [...t.missionsDone, key],
    totalXpToday: t.totalXpToday + xpEarned,
  });
}

export function setDay(scripts: ChallengeScript[], dayNumber: number) {
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
