/**
 * Pet & gems global stores.
 *
 * $pet mirrors the user's pet_states row in the shape used by UI, with two
 * extra prototype-only fields not persisted in drust:
 *   - strikes (0–3): number of confirmed-violation reports against this user
 *   - poisonedUntil (epoch ms | null): if set in the future, mood is forced
 *     to 'critical' (寵物食物中毒, per spec §三 後台 § 3 strikes 連動懲罰)
 *
 * Both are persisted to localStorage so the punishment survives a refresh
 * during the 24-hour cooldown window.
 *
 * $gems is a placeholder aggregate for gem balance / fragments / makeup
 * cards.
 */
import { atom } from 'nanostores';
import * as petApi from '@/api/pet';
import { stageFromLevel, type PetStage } from '@/lib/pet-evolution';
import type { PetMood } from '@/lib/pet-sprites';
import { storage } from '@/lib/storage';

export const POISON_DURATION_MS = 24 * 60 * 60 * 1000; // 24h
export const STRIKE_THRESHOLD = 3;

export interface PetStoreShape {
  level: number;
  currentXp: number;
  accumulatedXp: number;
  stage: PetStage;
  mood: string;
  strikes: number;
  poisonedUntil: number | null;
}

export interface GemsStoreShape {
  balance: number;
  fragments: number;
  makeupCards: number;
}

export const $pet = atom<PetStoreShape | null>(null);
export const $gems = atom<GemsStoreShape>({ balance: 0, fragments: 0, makeupCards: 0 });

const STRIKE_STORAGE_KEY = 'yummi.pet.strikes';
const POISON_STORAGE_KEY = 'yummi.pet.poisonedUntil';

/** Read persisted strikes/poison state. Survives reload during cooldown. */
function loadStrikeState(): { strikes: number; poisonedUntil: number | null } {
  const strikes = Math.max(
    0,
    Math.min(STRIKE_THRESHOLD, storage.get(STRIKE_STORAGE_KEY, 0)),
  );
  const stored = storage.get<number | null>(POISON_STORAGE_KEY, null);
  if (stored && stored <= Date.now()) {
    storage.remove(STRIKE_STORAGE_KEY);
    storage.remove(POISON_STORAGE_KEY);
    return { strikes: 0, poisonedUntil: null };
  }
  return { strikes, poisonedUntil: stored };
}

function persistStrikeState(strikes: number, poisonedUntil: number | null): void {
  if (strikes === 0 && poisonedUntil === null) {
    storage.remove(STRIKE_STORAGE_KEY);
    storage.remove(POISON_STORAGE_KEY);
    return;
  }
  storage.set(STRIKE_STORAGE_KEY, strikes);
  if (poisonedUntil !== null) storage.set(POISON_STORAGE_KEY, poisonedUntil);
  else storage.remove(POISON_STORAGE_KEY);
}

export function setPetFromRow(p: petApi.PetState) {
  const { strikes, poisonedUntil } = loadStrikeState();
  $pet.set({
    level: p.level,
    currentXp: p.current_xp,
    accumulatedXp: p.accumulated_xp,
    stage: (p.stage as PetStage) ?? stageFromLevel(p.level),
    mood: p.mood,
    strikes,
    poisonedUntil,
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
 * Append one strike to the user's record. The third strike triggers a
 * 24-hour mood=critical penalty (寵物食物中毒). Returns the new total so the
 * caller can decide what UI feedback to show.
 */
export function addStrike(now: number = Date.now()): number {
  const cur = $pet.get();
  if (!cur) return 0;
  const strikes = Math.min(STRIKE_THRESHOLD, cur.strikes + 1);
  const poisonedUntil =
    strikes >= STRIKE_THRESHOLD ? now + POISON_DURATION_MS : cur.poisonedUntil;
  persistStrikeState(strikes, poisonedUntil);
  $pet.set({ ...cur, strikes, poisonedUntil });
  return strikes;
}

/** Dev / admin pardon. Wipes both strike count and active poison window. */
export function clearStrikes(): void {
  const cur = $pet.get();
  if (!cur) return;
  persistStrikeState(0, null);
  $pet.set({ ...cur, strikes: 0, poisonedUntil: null });
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
