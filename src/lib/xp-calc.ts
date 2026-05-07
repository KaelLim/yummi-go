/**
 * Per spec 積分制度:
 *  - meal 1 = 20 XP
 *  - meal 2 = 20 XP
 *  - meal 3 = 30 XP (encouragement bonus regardless of declared plan)
 *  - daily XP overflow > 100 converts to gems (1 base + 1 per extra XP)
 *  - daily XP overflow per 100 also yields fragments
 */
export type MealPlan = 1 | 2 | 3;
export type MealIndex = 1 | 2 | 3;

export function mealXp(mealIndex: MealIndex, _plan: MealPlan): number {
  if (mealIndex === 1) return 20;
  if (mealIndex === 2) return 20;
  return 30;
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
