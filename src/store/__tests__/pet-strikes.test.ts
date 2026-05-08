import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/api/pet', () => ({
  setStrikes: vi.fn().mockResolvedValue(undefined),
  clearStrikes: vi.fn().mockResolvedValue(undefined),
  getPet: vi.fn(),
  addXp: vi.fn(),
  setMood: vi.fn(),
  resetPet: vi.fn(),
}));

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
import * as petApi from '@/api/pet';

const mockedPetApi = petApi as unknown as {
  setStrikes: ReturnType<typeof vi.fn>;
  clearStrikes: ReturnType<typeof vi.fn>;
};

const TEST_USER_ID = 1;

function seedPet(): void {
  setPetFromRow({
    id: 1,
    user_id: TEST_USER_ID,
    level: 5,
    current_xp: 0,
    accumulated_xp: 100,
    stage: 'baby',
    mood: 'happy',
    last_fed_at: null,
    strikes: 0,
    poisoned_until: null,
  });
}

describe('pet strikes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    $pet.set(null);
  });

  it('starts at 0 strikes / poisonedUntil null', () => {
    seedPet();
    const s = $pet.get();
    expect(s?.strikes).toBe(0);
    expect(s?.poisonedUntil).toBeNull();
  });

  it('addStrike increments without poisoning until the threshold', async () => {
    seedPet();
    expect(await addStrike(TEST_USER_ID)).toBe(1);
    expect($pet.get()?.poisonedUntil).toBeNull();
    expect(await addStrike(TEST_USER_ID)).toBe(2);
    expect($pet.get()?.poisonedUntil).toBeNull();
  });

  it('the third strike sets a 24h poisonedUntil window', async () => {
    seedPet();
    const now = 1_700_000_000_000;
    await addStrike(TEST_USER_ID, now);
    await addStrike(TEST_USER_ID, now);
    const total = await addStrike(TEST_USER_ID, now);
    expect(total).toBe(STRIKE_THRESHOLD);
    expect($pet.get()?.poisonedUntil).toBe(now + POISON_DURATION_MS);
  });

  it('caps at 3 — additional strikes do not double the cooldown', async () => {
    seedPet();
    const now = 2_000_000_000_000;
    for (let i = 0; i < 6; i++) await addStrike(TEST_USER_ID, now);
    const s = $pet.get();
    expect(s?.strikes).toBe(STRIKE_THRESHOLD);
    expect(s?.poisonedUntil).toBe(now + POISON_DURATION_MS);
  });

  it('effectiveMood returns critical while poisoned, regardless of stored mood', async () => {
    seedPet();
    const now = 3_000_000_000_000;
    await addStrike(TEST_USER_ID, now);
    await addStrike(TEST_USER_ID, now);
    await addStrike(TEST_USER_ID, now);
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

  it('clearStrikes wipes both fields and calls drust', async () => {
    seedPet();
    await addStrike(TEST_USER_ID);
    await addStrike(TEST_USER_ID);
    await addStrike(TEST_USER_ID);
    await clearStrikes(TEST_USER_ID);
    const s = $pet.get();
    expect(s?.strikes).toBe(0);
    expect(s?.poisonedUntil).toBeNull();
    expect(mockedPetApi.clearStrikes).toHaveBeenCalledWith(TEST_USER_ID);
  });

  it('persists strikes to drust on every increment', async () => {
    seedPet();
    await addStrike(TEST_USER_ID);
    expect(mockedPetApi.setStrikes).toHaveBeenCalledWith(TEST_USER_ID, 1, null);
  });

  it('persists ISO-string poisoned_until on the threshold strike', async () => {
    seedPet();
    const now = 4_000_000_000_000;
    await addStrike(TEST_USER_ID, now);
    await addStrike(TEST_USER_ID, now);
    await addStrike(TEST_USER_ID, now);
    const lastCall = mockedPetApi.setStrikes.mock.calls.at(-1);
    expect(lastCall?.[0]).toBe(TEST_USER_ID);
    expect(lastCall?.[1]).toBe(STRIKE_THRESHOLD);
    expect(lastCall?.[2]).toBe(new Date(now + POISON_DURATION_MS).toISOString());
  });

  it('setPetFromRow seeds strikes and parses ISO poisoned_until', () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    setPetFromRow({
      id: 1,
      user_id: TEST_USER_ID,
      level: 5,
      current_xp: 0,
      accumulated_xp: 100,
      stage: 'baby',
      mood: 'happy',
      last_fed_at: null,
      strikes: 2,
      poisoned_until: future,
    });
    const s = $pet.get();
    expect(s?.strikes).toBe(2);
    expect(s?.poisonedUntil).toBe(Date.parse(future));
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
