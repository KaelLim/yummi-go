import { describe, it, expect, beforeEach } from 'vitest';
import type { PetState } from '@/api/pet';
import { $pet, $gems, setPetFromRow } from '../pet';

describe('pet store', () => {
  beforeEach(() => {
    localStorage.clear();
    $pet.set(null);
    $gems.set({ balance: 0, fragments: 0, makeupCards: 0 });
  });

  it('starts with $pet null and default $gems', () => {
    expect($pet.get()).toBeNull();
    expect($gems.get()).toEqual({ balance: 0, fragments: 0, makeupCards: 0 });
  });

  it('setPetFromRow maps DB row into store shape', () => {
    const row: PetState = {
      id: 1,
      user_id: 42,
      level: 7,
      current_xp: 12,
      accumulated_xp: 200,
      stage: 'baby',
      mood: 'happy',
      last_fed_at: null,
      strikes: 0,
      poisoned_until: null,
    };
    setPetFromRow(row);
    expect($pet.get()).toEqual({
      level: 7,
      currentXp: 12,
      accumulatedXp: 200,
      stage: 'baby',
      mood: 'happy',
      strikes: 0,
      poisonedUntil: null,
    });
  });

  it('falls back to stageFromLevel when row stage is null', () => {
    setPetFromRow({
      id: 2,
      user_id: 1,
      level: 25,
      current_xp: 0,
      accumulated_xp: 500,
      stage: null as unknown as string,
      mood: 'normal',
      last_fed_at: null,
      strikes: 0,
      poisoned_until: null,
    });
    // level 25 → 'youth' per STAGE_THRESHOLDS
    expect($pet.get()?.stage).toBe('youth');
    expect($pet.get()?.level).toBe(25);
  });
});
