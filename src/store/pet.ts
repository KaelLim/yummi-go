/**
 * Pet & gems global stores.
 *
 * $pet mirrors the user's pet_states row in the shape used by UI.
 * $gems is a placeholder aggregate for gem balance / fragments / makeup cards.
 *
 * setPetFromRow normalizes a DB row into the store shape and computes the
 * stage from level if the row is missing a stage value.
 */
import { atom } from 'nanostores';
import * as petApi from '@/api/pet';
import { stageFromLevel, type PetStage } from '@/lib/pet-evolution';

export interface PetStoreShape {
  level: number;
  currentXp: number;
  accumulatedXp: number;
  stage: PetStage;
  mood: string;
}

export interface GemsStoreShape {
  balance: number;
  fragments: number;
  makeupCards: number;
}

export const $pet = atom<PetStoreShape | null>(null);
export const $gems = atom<GemsStoreShape>({ balance: 0, fragments: 0, makeupCards: 0 });

export function setPetFromRow(p: petApi.PetState) {
  $pet.set({
    level: p.level,
    currentXp: p.current_xp,
    accumulatedXp: p.accumulated_xp,
    stage: (p.stage as PetStage) ?? stageFromLevel(p.level),
    mood: p.mood,
  });
}

export async function reloadPet(userId: number) {
  const p = await petApi.getPet(userId);
  if (p) setPetFromRow(p);
}

export async function awardXp(userId: number, deltaXp: number) {
  const next = await petApi.addXp(userId, deltaXp);
  setPetFromRow(next);
}
