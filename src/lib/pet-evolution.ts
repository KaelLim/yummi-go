/**
 * Pet evolution tables per spec 積分制度.
 * 5 stages span LV1..LV100; XP-per-level table covers LV1..LV30 (current spec coverage).
 */
export const STAGE_THRESHOLDS = [
  { stage: 'egg' as const, minLv: 1, maxLv: 5 },
  { stage: 'baby' as const, minLv: 6, maxLv: 18 },
  { stage: 'youth' as const, minLv: 19, maxLv: 39 },
  { stage: 'adult' as const, minLv: 40, maxLv: 79 },
  { stage: 'max' as const, minLv: 80, maxLv: 100 },
];

export type PetStage = (typeof STAGE_THRESHOLDS)[number]['stage'];

export function stageFromLevel(level: number): PetStage {
  return STAGE_THRESHOLDS.find((s) => level >= s.minLv && level <= s.maxLv)?.stage ?? 'max';
}

/**
 * XP cost per level from spec CSV:
 *   Birth (1-5)  = 30
 *   Baby  (6-10) = 50, (11-12) = 60
 *   Child (13-19) = 80
 *   Teen  (20-26) = 100
 *   Adult (27-30) = 150
 */
export const XP_PER_LEVEL: Record<number, number> = (() => {
  const m: Record<number, number> = {};
  for (let lv = 1; lv <= 5; lv++) m[lv] = 30;
  for (let lv = 6; lv <= 10; lv++) m[lv] = 50;
  for (let lv = 11; lv <= 12; lv++) m[lv] = 60;
  for (let lv = 13; lv <= 19; lv++) m[lv] = 80;
  for (let lv = 20; lv <= 26; lv++) m[lv] = 100;
  for (let lv = 27; lv <= 30; lv++) m[lv] = 150;
  return m;
})();

export function levelFromAccumulatedXp(accXp: number): { level: number; currentXp: number } {
  let cumulative = 0;
  for (let lv = 1; lv <= 30; lv++) {
    const need = XP_PER_LEVEL[lv];
    if (accXp < cumulative + need) return { level: lv, currentXp: accXp - cumulative };
    cumulative += need;
  }
  return { level: 30, currentXp: 0 };
}
