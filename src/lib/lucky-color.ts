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

/**
 * challenge_scripts.lucky_color is stored in Traditional Chinese (e.g. '紅色',
 * '黃色/橘色') because that's how the spec CSV ships. The matchers and palette
 * swatches use English keys, so callers normalize at the boundary.
 *
 * Returns null for unrecognised input so callers can fall back gracefully
 * (e.g. show the raw string label without a colored swatch).
 */
const ZH_TO_EN: Array<[RegExp, LuckyColor]> = [
  [/紅/, 'red'],
  [/黃|橘|橙/, 'yellow'],
  [/綠/, 'green'],
  [/紫/, 'purple'],
  [/黑/, 'black'],
  [/白/, 'white'],
];

export function normalizeLuckyColor(value: string | null | undefined): LuckyColor | null {
  if (!value) return null;
  const lower = value.toLowerCase().trim();
  if ((COLORS as readonly string[]).includes(lower)) return lower as LuckyColor;
  for (const [re, color] of ZH_TO_EN) {
    if (re.test(value)) return color;
  }
  return null;
}
