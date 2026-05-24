/**
 * Per UX_UPDATE_SPEC v0.3:
 *  - All three meals = 20 XP each (was: 3rd meal = 30, with +10 baked in).
 *  - A separate `meal_complete_bonus` mission grants +10 XP when all
 *    three meals are done today — see `lib/missions.ts` for the key and
 *    /check-in/result for the trigger after the 3rd check-in.
 *  - Daily total ceiling for meal-related XP: 70 (20×3 + 10 bonus).
 *  - XP earned past the 100-XP daily pet-feed cap converts to gems at
 *    1:1 (see `store/pet.awardXp`).
 */
export type MealPlan = 1 | 2 | 3;
export type MealIndex = 1 | 2 | 3;

/** Meal-completion bonus awarded once per day after all three meals are
 *  checked in. Lives here so callers don't drift on the constant. */
export const MEAL_COMPLETE_BONUS_XP = 10;
export const MEAL_COMPLETE_BONUS_KEY = 'meal_complete_bonus';

export function mealXp(_mealIndex: MealIndex, _plan: MealPlan): number {
  return 20;
}

export function gemFromOverflow(dailyXp: number): number {
  if (dailyXp < 100) return 0;
  if (dailyXp === 100) return 1;
  return 1 + (dailyXp - 100);
}

export function fragmentFromOverflow(dailyXp: number): number {
  if (dailyXp <= 100) return 0;
  return Math.floor((dailyXp - 100) / 100);
}

export function dailyTotal(checkInsXp: number, missionsCount: number, reviewsCount: number): number {
  return checkInsXp + missionsCount * 15 + reviewsCount * 15;
}
