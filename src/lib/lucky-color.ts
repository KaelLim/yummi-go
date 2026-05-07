/**
 * Lucky-color groupings (寬鬆建檔):
 *  - black & purple group together
 *  - yellow groups with orange
 */
export const COLORS = ['red', 'yellow', 'green', 'purple', 'black', 'white'] as const;
export type LuckyColor = (typeof COLORS)[number];

export function matchesLucky(foodColors: string[], luckyColor: LuckyColor): boolean {
  if (luckyColor === 'purple' || luckyColor === 'black') {
    return foodColors.some((c) => c === 'purple' || c === 'black');
  }
  if (luckyColor === 'yellow') {
    return foodColors.some((c) => c === 'yellow' || c === 'orange');
  }
  return foodColors.includes(luckyColor);
}

export function dailyLuckyColor(dayIndex: number): LuckyColor {
  const cycle: LuckyColor[] = ['red', 'yellow', 'green', 'purple', 'white'];
  return cycle[dayIndex % cycle.length];
}
