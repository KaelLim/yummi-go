/**
 * Pet state module: read pet, accumulate XP, set mood, manage strikes.
 *
 * Reads use the `pet_for_user` RPC (indexed-style point lookup, replaces
 * the broken list+filter pattern that died at the 20-row cap).
 *
 * Writes still go through `update_record` because drust RPCs are
 * SELECT-only; the write surface enforces nothing at the row level today,
 * so we read-modify-write inside this module rather than letting callers
 * mutate raw rows.
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
  strikes: number;
  poisoned_until: string | null;
}

export async function getPet(userId: number): Promise<PetState | null> {
  const result = await drust.rpc('pet_for_user', { user_id: userId });
  const rows = drust.rpcRows<PetState>(result);
  return rows[0] ?? null;
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

/**
 * Persist a strike bump and (when threshold reached) the poison-until
 * timestamp. Caller computes the new values; this is just the write.
 * Returns the patched row so the store can re-emit without a refetch.
 */
export async function setStrikes(
  userId: number,
  strikes: number,
  poisonedUntil: string | null,
): Promise<PetState> {
  const pet = await getPet(userId);
  if (!pet) throw new Error('Pet not found');
  await drust.update('pet_states', pet.id, {
    strikes,
    poisoned_until: poisonedUntil,
  });
  return { ...pet, strikes, poisoned_until: poisonedUntil };
}

/** Pardon: zero strikes + clear poison window. */
export async function clearStrikes(userId: number): Promise<PetState> {
  return setStrikes(userId, 0, null);
}

/** Dev-only: roll the pet row back to a freshly-hatched LV1 egg. */
export async function resetPet(userId: number): Promise<PetState> {
  const pet = await getPet(userId);
  if (!pet) throw new Error('Pet not found');
  const reset = {
    level: 1,
    current_xp: 0,
    accumulated_xp: 0,
    stage: 'egg',
    mood: 'normal',
    strikes: 0,
    poisoned_until: null,
  };
  await drust.update('pet_states', pet.id, reset);
  return { ...pet, ...reset };
}
