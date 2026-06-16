/**
 * 守護者典藏冊 — store of pets the user has finished raising.
 *
 * A pet "completes" when it reaches LV30. At that moment it leaves
 * the active slot (the user starts a fresh guardian) and lands here
 * with its individual name preserved. Each completion is its own
 * card: if the user raises two frogs and names them differently,
 * the collection shows two separate frog entries.
 *
 * Phase 2 (merging two same-species cards into a stronger one) is
 * deliberately not modelled here yet — the shape below leaves room
 * for it (the entry carries species + name + completedAt) without
 * pre-committing to a merge schema.
 *
 * Backed by localStorage for the prototype. When drust ownership of
 * this list lands, swap the read/write helpers to call an RPC and
 * keep the same shape so callers don't need to change.
 */
import { KEYS, storage } from '@/lib/storage';

export type PetSpecies =
  | 'frog'
  | 'koala'
  | 'elephant'
  | 'panda'
  | 'owl'
  | 'hedgehog';

export const SPECIES_LIST: PetSpecies[] = [
  'frog',
  'koala',
  'elephant',
  'panda',
  'owl',
  'hedgehog',
];

/** Visual fallback when a species has no sprite asset yet. */
export const SPECIES_EMOJI: Record<PetSpecies, string> = {
  frog: '🐸',
  koala: '🐨',
  elephant: '🐘',
  panda: '🐼',
  owl: '🦉',
  hedgehog: '🦔',
};

export interface CompletedPet {
  /** Stable id — generated once, used as the React-style key. */
  id: string;
  /** Custom name the user gave this guardian during onboarding. */
  name: string;
  species: PetSpecies;
  /** Epoch ms at LV30 completion. */
  completedAt: number;
}

function readAll(): CompletedPet[] {
  const raw = storage.get<unknown>(KEYS.PET_COLLECTION, []);
  if (!Array.isArray(raw)) return [];
  return raw.filter(isEntry);
}

function isEntry(v: unknown): v is CompletedPet {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    typeof o.name === 'string' &&
    typeof o.species === 'string' &&
    SPECIES_LIST.includes(o.species as PetSpecies) &&
    typeof o.completedAt === 'number'
  );
}

/** Most-recent-first list of completed guardians. */
export function listCompletedPets(): CompletedPet[] {
  return readAll().sort((a, b) => b.completedAt - a.completedAt);
}

/** Add an entry. Called when a pet hits LV30. */
export function addCompletedPet(entry: Omit<CompletedPet, 'id'>): CompletedPet {
  const id = `pet-${entry.completedAt.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const next: CompletedPet = { ...entry, id };
  storage.set(KEYS.PET_COLLECTION, [...readAll(), next]);
  return next;
}

/** Test-only / dev-only — wipe the local book. */
export function clearCompletedPets(): void {
  storage.remove(KEYS.PET_COLLECTION);
}
