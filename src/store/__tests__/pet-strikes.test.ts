import { describe, it, expect, beforeEach } from 'vitest';
import {
  $pet,
  addStrike,
  clearStrikes,
  effectiveMood,
  poisonRemainingMs,
  POISON_DURATION_MS,
  STRIKE_THRESHOLD,
  setPetFromRow,
} from '../pet';

function seedPet(): void {
  setPetFromRow({
    id: 1,
    user_id: 1,
    level: 5,
    current_xp: 0,
    accumulated_xp: 100,
    stage: 'baby',
    mood: 'happy',
    last_fed_at: null,
  });
}

describe('pet strikes', () => {
  beforeEach(() => {
    localStorage.clear();
    $pet.set(null);
  });

  it('starts at 0 strikes / poisonedUntil null', () => {
    seedPet();
    const s = $pet.get();
    expect(s?.strikes).toBe(0);
    expect(s?.poisonedUntil).toBeNull();
  });

  it('addStrike increments without poisoning until the threshold', () => {
    seedPet();
    expect(addStrike()).toBe(1);
    expect($pet.get()?.poisonedUntil).toBeNull();
    expect(addStrike()).toBe(2);
    expect($pet.get()?.poisonedUntil).toBeNull();
  });

  it('the third strike sets a 24h poisonedUntil window', () => {
    seedPet();
    const now = 1_700_000_000_000;
    addStrike(now);
    addStrike(now);
    const total = addStrike(now);
    expect(total).toBe(STRIKE_THRESHOLD);
    expect($pet.get()?.poisonedUntil).toBe(now + POISON_DURATION_MS);
  });

  it('caps at 3 — additional strikes do not double the cooldown', () => {
    seedPet();
    const now = 2_000_000_000_000;
    for (let i = 0; i < 6; i++) addStrike(now);
    const s = $pet.get();
    expect(s?.strikes).toBe(STRIKE_THRESHOLD);
    expect(s?.poisonedUntil).toBe(now + POISON_DURATION_MS);
  });

  it('effectiveMood returns critical while poisoned, regardless of stored mood', () => {
    seedPet();
    const now = 3_000_000_000_000;
    addStrike(now);
    addStrike(now);
    addStrike(now);
    // Pet's stored mood is 'happy' from seed; poisoning overrides it.
    expect(effectiveMood($pet.get())).toBe('critical');
  });

  it('effectiveMood returns the stored mood when poisonedUntil is in the past', () => {
    seedPet();
    const cur = $pet.get();
    if (!cur) throw new Error('seed failed');
    $pet.set({ ...cur, strikes: 3, poisonedUntil: Date.now() - 1000 });
    expect(effectiveMood($pet.get())).toBe('happy');
  });

  it('clearStrikes wipes both fields and persists', () => {
    seedPet();
    addStrike();
    addStrike();
    addStrike();
    clearStrikes();
    const s = $pet.get();
    expect(s?.strikes).toBe(0);
    expect(s?.poisonedUntil).toBeNull();
    expect(localStorage.getItem('yummi.pet.strikes')).toBeNull();
    expect(localStorage.getItem('yummi.pet.poisonedUntil')).toBeNull();
  });

  it('persists strikes to localStorage so a reload keeps the state', () => {
    seedPet();
    addStrike();
    expect(JSON.parse(localStorage.getItem('yummi.pet.strikes') ?? 'null')).toBe(1);
  });

  it('expired poison auto-clears on next setPetFromRow', () => {
    // Simulate a stale poisoned window from a previous session.
    localStorage.setItem('yummi.pet.strikes', JSON.stringify(3));
    localStorage.setItem('yummi.pet.poisonedUntil', JSON.stringify(Date.now() - 5000));
    seedPet();
    const s = $pet.get();
    expect(s?.strikes).toBe(0);
    expect(s?.poisonedUntil).toBeNull();
  });

  it('poisonRemainingMs reports time left, 0 once expired', () => {
    seedPet();
    const future = Date.now() + 60_000;
    const cur = $pet.get();
    if (!cur) throw new Error('seed failed');
    $pet.set({ ...cur, poisonedUntil: future });
    expect(poisonRemainingMs($pet.get())).toBeGreaterThan(0);
    $pet.set({ ...cur, poisonedUntil: Date.now() - 1 });
    expect(poisonRemainingMs($pet.get())).toBe(0);
  });
});
