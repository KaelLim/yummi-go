/**
 * Pet evolution tables — UX_UPDATE_SPEC v0.3 alignment.
 *
 * 30-day / 5-stage First Pet model. Flat 30 XP per level (LV1-30 covers
 * 900 total XP, matching a 30-day average of 30 XP/day after the 100-XP
 * daily cap funnels overflow into gems instead of pet XP).
 *
 * Stage naming follows the v0.3 audit decision:
 *   - egg → baby → youth → teen → adult
 * (the 5th/final stage is "adult" not "max"; the old "adult" range was
 * renamed to "teen" and the old "max" became "adult"). Sprite folders
 * under `public/pet/` were renamed in lockstep.
 *
 * LV30 is the final stage; XP earned past the LV30 boundary holds the
 * level at 30 (handled by `levelFromAccumulatedXp` returning the last
 * level once the cumulative ceiling is hit).
 */
export const STAGE_THRESHOLDS = [
  { stage: 'egg' as const,   minLv: 1,  maxLv: 5 },
  { stage: 'baby' as const,  minLv: 6,  maxLv: 12 },
  { stage: 'youth' as const, minLv: 13, maxLv: 19 },
  { stage: 'teen' as const,  minLv: 20, maxLv: 26 },
  { stage: 'adult' as const, minLv: 27, maxLv: 30 },
];

export type PetStage = (typeof STAGE_THRESHOLDS)[number]['stage'];

export function stageFromLevel(level: number): PetStage {
  return STAGE_THRESHOLDS.find((s) => level >= s.minLv && level <= s.maxLv)?.stage ?? 'adult';
}

/** True when the pet has reached the LV27-30 band (final stage). */
export function isFinalStage(level: number): boolean {
  return level >= 27;
}

/** Flat 30 XP per level for LV1-30. */
const XP_PER_LEVEL_FLAT = 30;
export const XP_PER_LEVEL: Record<number, number> = (() => {
  const m: Record<number, number> = {};
  for (let lv = 1; lv <= 30; lv++) m[lv] = XP_PER_LEVEL_FLAT;
  return m;
})();

export function levelFromAccumulatedXp(accXp: number): { level: number; currentXp: number } {
  let cumulative = 0;
  for (let lv = 1; lv <= 30; lv++) {
    const need = XP_PER_LEVEL[lv];
    if (accXp < cumulative + need) return { level: lv, currentXp: accXp - cumulative };
    cumulative += need;
  }
  // Past LV30 — cap at the final level so the XP progress bar can show
  // 100% rather than wrapping into LV31+.
  return { level: 30, currentXp: XP_PER_LEVEL[30] };
}
