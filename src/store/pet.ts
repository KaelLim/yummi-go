/**
 * Pet & gems global stores.
 *
 * $pet mirrors the user's pet_states row. Strikes / poison_until are
 * server-side fields now (drust pet_states.strikes + pet_states.poisoned_until).
 * The store still exposes them as numbers / epoch-ms for the UI; we
 * convert at the API boundary.
 *
 * $gems is a placeholder aggregate for gem balance / fragments / makeup
 * cards.
 */
import { atom } from 'nanostores';
import * as petApi from '@/api/pet';
import { stageFromLevel, type PetStage } from '@/lib/pet-evolution';
import type { PetMood } from '@/lib/pet-sprites';

export const POISON_DURATION_MS = 24 * 60 * 60 * 1000; // 24h
export const STRIKE_THRESHOLD = 3;

export interface PetStoreShape {
  level: number;
  currentXp: number;
  accumulatedXp: number;
  stage: PetStage;
  mood: string;
  strikes: number;
  poisonedUntil: number | null; // epoch ms, parsed from pet_states.poisoned_until ISO string
}

export interface GemsStoreShape {
  balance: number;
  fragments: number;
  makeupCards: number;
}

export const $pet = atom<PetStoreShape | null>(null);
export const $gems = atom<GemsStoreShape>({ balance: 0, fragments: 0, makeupCards: 0 });

function isoToEpoch(iso: string | null): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : ms;
}

function epochToIso(ms: number | null): string | null {
  return ms === null ? null : new Date(ms).toISOString();
}

export function setPetFromRow(p: petApi.PetState) {
  $pet.set({
    level: p.level,
    currentXp: p.current_xp,
    accumulatedXp: p.accumulated_xp,
    stage: (p.stage as PetStage) ?? stageFromLevel(p.level),
    mood: p.mood,
    strikes: p.strikes ?? 0,
    poisonedUntil: isoToEpoch(p.poisoned_until ?? null),
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

/**
 * Append one strike to the user's drust row. The third strike triggers a
 * 24-hour mood=critical penalty (寵物食物中毒). Optimistically updates the
 * store to the new count so the UI reacts immediately, then persists; on
 * failure the next refresh will reconcile.
 *
 * `now` is injectable for tests. Returns the new total.
 */
export async function addStrike(
  userId: number,
  now: number = Date.now(),
): Promise<number> {
  const cur = $pet.get();
  if (!cur) return 0;
  const strikes = Math.min(STRIKE_THRESHOLD, cur.strikes + 1);
  const poisonedUntil =
    strikes >= STRIKE_THRESHOLD ? now + POISON_DURATION_MS : cur.poisonedUntil;
  $pet.set({ ...cur, strikes, poisonedUntil });
  try {
    await petApi.setStrikes(userId, strikes, epochToIso(poisonedUntil));
  } catch (err) {
    console.warn('[pet] setStrikes failed:', err);
  }
  return strikes;
}

/** Dev / admin pardon. Wipes both strike count and active poison window. */
export async function clearStrikes(userId: number): Promise<void> {
  const cur = $pet.get();
  if (!cur) return;
  $pet.set({ ...cur, strikes: 0, poisonedUntil: null });
  try {
    await petApi.clearStrikes(userId);
  } catch (err) {
    console.warn('[pet] clearStrikes failed:', err);
  }
}

/**
 * The mood the UI should actually render. While poisonedUntil is in the
 * future, we override whatever drust has stored — even if the pet is
 * happy from XP, food poisoning takes priority.
 */
export function effectiveMood(state: PetStoreShape | null): PetMood {
  if (!state) return 'normal';
  if (state.poisonedUntil && state.poisonedUntil > Date.now()) {
    return 'critical';
  }
  return (state.mood as PetMood) ?? 'normal';
}

/** Milliseconds remaining on an active poison window (0 if not poisoned). */
export function poisonRemainingMs(state: PetStoreShape | null): number {
  if (!state?.poisonedUntil) return 0;
  return Math.max(0, state.poisonedUntil - Date.now());
}
