import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/api/content', () => ({ getDayScript: vi.fn().mockResolvedValue(null) }));
vi.mock('@/api/daily-progress', () => ({
  getDailyProgress: vi.fn().mockResolvedValue(null),
  upsertDailyProgress: vi.fn().mockResolvedValue(undefined),
  decodeMissions: (row: { missions_done?: string }) => {
    if (!row?.missions_done) return [];
    try {
      return JSON.parse(row.missions_done);
    } catch {
      return [];
    }
  },
}));
vi.mock('@/store/pet', async () => {
  const { atom } = await import('nanostores');
  return {
    $pet: atom(null),
    reloadPet: vi.fn().mockResolvedValue(undefined),
  };
});

import { setupDaySync } from '../day-sync';
import { $user } from '../user';
import { $today, markMissionDone } from '../today';
import { $ui } from '../ui';

describe('setupDaySync — user-change carryover guard', () => {
  beforeEach(() => {
    $user.set(null);
    $today.set({ dayNumber: 1, totalXpToday: 0, missionsDone: [], luckyColor: '' });
    // Force a stable $ui so the subscriber doesn't flap.
    $ui.set({ ...$ui.get(), timeMode: 'real', manualDay: 1 });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('blanks $today.missionsDone when the logged-in user changes', async () => {
    // User A is logged in and finished today's quiz.
    $user.set({ id: 1, username: 'a', displayName: 'A' });
    setupDaySync();
    markMissionDone('quiz', 15);
    expect($today.get().missionsDone).toContain('quiz');

    // User A logs out — day-sync must blank $today so the next user starts clean.
    $user.set(null);
    expect($today.get().missionsDone).toEqual([]);
    expect($today.get().totalXpToday).toBe(0);

    // User B registers / logs in — day-sync triggers a fresh hydrate (mocked
    // to return null), which keeps $today empty for the new account.
    $user.set({ id: 2, username: 'b', displayName: 'B' });
    expect($today.get().missionsDone).toEqual([]);
  });

  it('does not blank $today on the initial boot fire (lastUserId undefined)', () => {
    // Simulate boot where $user is already restored before setupDaySync runs.
    $user.set({ id: 1, username: 'a', displayName: 'A' });
    $today.set({
      dayNumber: 1,
      totalXpToday: 50,
      missionsDone: ['meal:lunch'],
      luckyColor: '紅色',
    });
    setupDaySync();
    // First fire from $ui must not wipe a freshly-bootstrapped session.
    expect($today.get().missionsDone).toContain('meal:lunch');
  });
});
