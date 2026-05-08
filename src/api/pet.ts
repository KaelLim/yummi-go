/**
 * Pet state module: read pet, accumulate XP, set mood.
 *
 * addXp() recomputes level/stage from accumulated XP using pet-evolution
 * tables, persists everything, and stamps last_fed_at.
 */
import { drust } from './drust';
import {
  levelFromAccumulatedXp,
  stageFromLevel,
} from '@/lib/pet-evolution';

export interface PetState {
  id: number;
  user_id: number;
  level: number;
  current_xp: number;
  accumulated_xp: number;
  stage: string;
  mood: string;
  last_fed_at: string | null;
}

/**
 * drust list filters are silently ignored (see api/profile.ts), so we fetch
 * all pet_states and filter client-side. Holds while pet_states stays under
 * the 20-row cap; otherwise this needs a server-side RPC.
 */
export async function getPet(userId: number): Promise<PetState | null> {
  const result = await drust.list<PetState>('pet_states');
  return result.records.find((p) => p.user_id === userId) ?? null;
}

export async function addXp(
  userId: number,
  deltaXp: number,
): Promise<PetState> {
  const pet = await getPet(userId);
  if (!pet) throw new Error('Pet not found');
  const newAcc = pet.accumulated_xp + deltaXp;
  const { level, currentXp } = levelFromAccumulatedXp(newAcc);
  const stage = stageFromLevel(level);
  const last_fed_at = new Date().toISOString();
  await drust.update('pet_states', pet.id, {
    accumulated_xp: newAcc,
    current_xp: currentXp,
    level,
    stage,
    last_fed_at,
  });
  return {
    ...pet,
    accumulated_xp: newAcc,
    current_xp: currentXp,
    level,
    stage,
    last_fed_at,
  };
}

export async function setMood(userId: number, mood: string): Promise<void> {
  const pet = await getPet(userId);
  if (!pet) throw new Error('Pet not found');
  await drust.update('pet_states', pet.id, { mood });
}
