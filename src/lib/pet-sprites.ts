/**
 * Pet sprite resolution — maps ($pet.stage, $pet.mood) to a PNG path under
 * /public/pet/<stage>/<mood>.png. Centralizes fallback rules so PetView,
 * Profile and Day-30 share one source of truth.
 *
 * AVAILABLE encodes which (stage, mood) combinations have art. Unavailable
 * combinations fall back to that stage's 'normal' cell. The egg stage's
 * 'evolve' mood is rendered by a special filename ('crack') because the
 * art is qualitatively different (crack lines, not a glow).
 */
import type { PetStage } from './pet-evolution';

export type PetMood = 'normal' | 'happy' | 'weak' | 'critical' | 'evolve';

const AVAILABLE: Record<PetStage, ReadonlyArray<PetMood>> = {
  egg:   ['normal', 'evolve'],
  baby:  ['normal', 'happy', 'weak', 'critical', 'evolve'],
  youth: ['normal', 'happy', 'weak', 'critical', 'evolve'],
  // teen sprite folder reuses the prior 'adult' artwork (the v0.3 stage
  // rename moved 'adult' → 'teen' on the level band).
  teen:  ['normal', 'happy', 'weak', 'critical', 'evolve'],
  // adult is the final stage now (was 'max').
  adult: ['normal', 'happy', 'weak', 'critical'],
};

export function spriteFor(stage: PetStage, mood: PetMood): string {
  const moods = AVAILABLE[stage];
  if (!moods) return '/pet/egg/normal.png';
  const resolved: PetMood = moods.includes(mood) ? mood : 'normal';
  const filename =
    stage === 'egg' && resolved === 'evolve' ? 'crack' : resolved;
  return `/pet/${stage}/${filename}.png`;
}
