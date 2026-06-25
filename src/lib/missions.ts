/**
 * Mission catalogue + per-day status derivation for the home page's
 * "今日任務" card and its see-all sheet.
 *
 * Per UX_UPDATE_SPEC_v0.1 §1, the home page surfaces up to two unfinished
 * missions inline and tucks the rest behind a "查看全部" affordance. With the
 * tasks page removed (user pivot 2026-05-19), missions are the only canonical
 * surface for non-meal daily reward loops.
 *
 * `buildMissions` is pure — it takes the current $today / $profile snapshot
 * and returns an ordered, status-tagged list. UI decides how many to render
 * inline.
 */
import type { TodayStoreShape } from '@/store/today';
import { MEAL_COMPLETE_BONUS_KEY, MEAL_COMPLETE_BONUS_XP } from './xp-calc';
import { t } from './i18n';

export interface Mission {
  /** Stable id for de-dup / mission-done lookups. */
  key: string;
  emoji: string;
  label: string;
  /** XP value displayed on the row. 0 means no XP (e.g. 5R sustainable). */
  xp: number;
  /** Route the row navigates to. Optional — 5R rows are self-check, no nav. */
  href?: string;
  /** True once today's mission is done; rows below filter completed by default. */
  done: boolean;
  /** Self-check rows expose a checkbox instead of an arrow. */
  selfCheck?: boolean;
}

export interface BuildMissionsArgs {
  today: TodayStoreShape;
  /** Optional: how many meals the user enabled in eat-times settings. */
  mealCount?: number;
}

const SUSTAINABLE = [
  { key: '5r:refuse', emoji: '🚫', labelKey: 'mission.r.refuse' },
  { key: '5r:reduce', emoji: '📉', labelKey: 'mission.r.reduce' },
  { key: '5r:reuse', emoji: '♻️', labelKey: 'mission.r.reuse' },
  { key: '5r:recycle', emoji: '♻️', labelKey: 'mission.r.recycle' },
  { key: '5r:rot', emoji: '🌱', labelKey: 'mission.r.rot' },
];

/**
 * Build the ordered mission list for the home card + see-all sheet.
 * Meals first (the user's primary daily action), then quiz, lucky color,
 * then the 5R sustainable check-list at the bottom.
 */
export function buildMissions({
  today,
  mealCount = 3,
}: BuildMissionsArgs): Mission[] {
  const done = new Set(today.missionsDone);
  const missions: Mission[] = [];

  // Meal check-ins — one row per enabled meal slot. The label uses positional
  // ordinals (第一餐 / 第二餐 / …) so users who skip a meal still see a
  // coherent count.
  const ordinalKeys = ['checkin.meal1', 'checkin.meal2', 'checkin.meal3'];
  for (let i = 0; i < Math.min(mealCount, 3); i++) {
    const key = `meal:${MEAL_KEY[i]}`;
    missions.push({
      key,
      emoji: '🍽️',
      label: t('mission.mealCheckinFmt').replace('{meal}', t(ordinalKeys[i] ?? 'checkin.meal1')),
      xp: 20,
      href: '/check-in',
      done: done.has(key) || done.has(MEAL_KEY[i]),
    });
  }

  // 完成全日三餐 bonus — UX_UPDATE_SPEC v0.3 §3. Visible from day start
  // as encouragement; marked done after the 3rd meal triggers it.
  // /check-in/result is the awarder.
  const allMealsDone = ['breakfast', 'lunch', 'dinner']
    .slice(0, Math.min(mealCount, 3))
    .every((k) => done.has(`meal:${k}`) || done.has(k));
  missions.push({
    key: MEAL_COMPLETE_BONUS_KEY,
    emoji: '🏅',
    label: t('mission.mealComplete'),
    xp: MEAL_COMPLETE_BONUS_XP,
    done: allMealsDone && done.has(MEAL_COMPLETE_BONUS_KEY),
  });

  missions.push({
    key: 'quiz',
    emoji: '🧪',
    label: t('mission.quiz'),
    xp: 15,
    href: '/tasks/quiz',
    done: done.has('quiz'),
  });

  missions.push({
    key: 'lucky',
    emoji: '🍀',
    label: t('mission.lucky'),
    xp: 15,
    href: '/check-in',
    done: done.has('lucky:hit'),
  });

  // Surface exactly one 5R sustainable action per day. The index cycles
  // through the SUSTAINABLE list by today.dayNumber so the same row stays
  // pinned across reloads on a given day, and rotates to a different
  // action on the next day. User pivot 2026-05-22: «每天只會顯示一個永續任務».
  const dayIdx = ((today.dayNumber - 1) % SUSTAINABLE.length + SUSTAINABLE.length) % SUSTAINABLE.length;
  const r = SUSTAINABLE[dayIdx];
  missions.push({
    key: r.key,
    emoji: r.emoji,
    label: t(r.labelKey),
    xp: 0,
    done: done.has(r.key),
    selfCheck: true,
  });

  // Restaurant verify / review — evergreen CTA into the map, sits at
  // the bottom of the mission list. No XP label, no done state;
  // tapping the row deep-links to the map so users can pick a place
  // to verify or review. (Per user request 2026-06-24: include in
  // the daily mission list as the last item.)
  missions.push({
    key: 'restaurant-action',
    emoji: '📍',
    label: t('mission.restaurant'),
    xp: 0,
    href: '/map',
    done: false,
  });

  return missions;
}

const MEAL_KEY = ['breakfast', 'lunch', 'dinner'];

/** Pick the first N missions that aren't done yet — generic utility. */
export function topUnfinished(missions: Mission[], n = 2): Mission[] {
  return missions.filter((m) => !m.done).slice(0, n);
}

/**
 * Pick the meal mission whose slot matches the current clock hour. If that
 * one is already done (or the user disabled it), step forward through the
 * other meal slots and return the next unfinished one. Returns null when
 * all meal slots are done or none are enabled.
 */
function currentMealMission(missions: Mission[], hour: number): Mission | null {
  const order = ['meal:breakfast', 'meal:lunch', 'meal:dinner'];
  const byKey = new Map(missions.map((m) => [m.key, m] as const));
  const preferred = hour < 11 ? 'meal:breakfast' : hour < 17 ? 'meal:lunch' : 'meal:dinner';
  // Rotate `order` so the preferred slot is first, then iterate.
  const startIdx = order.indexOf(preferred);
  const cycled = order.slice(startIdx).concat(order.slice(0, startIdx));
  for (const k of cycled) {
    const m = byKey.get(k);
    if (m && !m.done) return m;
  }
  return null;
}

/**
 * Home's collapsed missions card always surfaces exactly two rows:
 *   1. the current meal check-in (time-of-day driven),
 *   2. the first unfinished mission that *isn't* a meal check-in (quiz,
 *      lucky color, 5R sustainable action, etc.).
 *
 * If one of those slots has nothing to show (e.g. all meals done), only
 * the other is returned — the card never invents a placeholder row.
 */
export function homeVisibleMissions(
  missions: Mission[],
  hour: number = new Date().getHours(),
): Mission[] {
  const meal = currentMealMission(missions, hour);
  const nonMeal = missions.find((m) => !m.key.startsWith('meal:') && !m.done) ?? null;
  const out: Mission[] = [];
  if (meal) out.push(meal);
  if (nonMeal) out.push(nonMeal);
  return out;
}
