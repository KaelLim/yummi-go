import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/api/drust', () => ({
  drust: {
    insert: vi.fn(),
    rpc: vi.fn(),
    rpcRows: vi.fn(),
    list: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

import { drust } from '@/api/drust';
import {
  getUserFull,
  getProfile,
  updateProfile,
  signOath,
  setChallengeStartedAt,
  mealFailCount,    // NEW
} from '../profile';

const mockedDrust = drust as unknown as {
  insert: ReturnType<typeof vi.fn>;
  rpc: ReturnType<typeof vi.fn>;
  rpcRows: ReturnType<typeof vi.fn>;
  list: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
};

function mockRpcReturns<T>(rows: T[]): void {
  mockedDrust.rpc.mockResolvedValueOnce({
    column_names: [],
    rows: [],
    row_count: rows.length,
    truncated: false,
  });
  mockedDrust.rpcRows.mockReturnValueOnce(rows);
}

describe('profile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getUserFull', () => {
    it('calls get_user_full RPC and returns first row', async () => {
      mockRpcReturns([
        {
          id: 5,
          username: 'alice',
          display_name: 'Alice',
          oath_signed_at: null,
          challenge_started_at: null,
          diet_type: null,
          challenge_level: null,
          eat_times: null,
          known_from: null,
          baseline: null,
          level: 1,
          current_xp: 0,
          accumulated_xp: 0,
          stage: 'egg',
          mood: 'normal',
          strikes: 0,
          poisoned_until: null,
          gems: 0,
          total_earned: 0,
          card_count: 0,
          fragment_count: 0,
        },
      ]);

      const out = await getUserFull(5);

      expect(mockedDrust.rpc).toHaveBeenCalledWith('get_user_full', {
        user_id: 5,
      });
      expect(out?.id).toBe(5);
      expect(out?.stage).toBe('egg');
    });

    it('returns null when no rows', async () => {
      mockRpcReturns([]);
      expect(await getUserFull(99)).toBeNull();
    });
  });

  describe('getProfile', () => {
    it('routes through profile_for_user RPC', async () => {
      mockRpcReturns([
        { id: 7, user_id: 5, diet_type: 'vegan' },
      ]);
      const out = await getProfile(5);
      expect(mockedDrust.rpc).toHaveBeenCalledWith('profile_for_user', {
        user_id: 5,
      });
      expect(out?.diet_type).toBe('vegan');
      expect(out?.id).toBe(7);
    });

    it('returns null when the RPC has no rows', async () => {
      mockRpcReturns([]);
      expect(await getProfile(99)).toBeNull();
    });
  });

  describe('updateProfile', () => {
    it('finds profile by user_id then patches by row id', async () => {
      mockRpcReturns([{ id: 11, user_id: 5 }]);
      mockedDrust.update.mockResolvedValueOnce({ record: {} });

      await updateProfile(5, { diet_type: 'vegan', challenge_level: 3 });

      expect(mockedDrust.update).toHaveBeenCalledWith('user_profiles', 11, {
        diet_type: 'vegan',
        challenge_level: 3,
      });
    });

    it('throws when no profile exists', async () => {
      mockRpcReturns([]);
      await expect(updateProfile(99, { diet_type: 'vegan' })).rejects.toThrow(
        /not found/i,
      );
    });
  });

  describe('signOath', () => {
    it('updates users with oath_signed_at = ISO timestamp', async () => {
      mockedDrust.update.mockResolvedValueOnce({ record: {} });
      const before = Date.now();
      await signOath(5);
      const after = Date.now();

      expect(mockedDrust.update).toHaveBeenCalledTimes(1);
      const [coll, id, patch] = mockedDrust.update.mock.calls[0];
      expect(coll).toBe('users');
      expect(id).toBe(5);
      const ts = Date.parse(patch.oath_signed_at);
      expect(ts).toBeGreaterThanOrEqual(before);
      expect(ts).toBeLessThanOrEqual(after);
    });
  });

  describe('setChallengeStartedAt', () => {
    it('updates users.challenge_started_at with the given ISO string', async () => {
      mockedDrust.update.mockResolvedValueOnce({ record: {} });
      await setChallengeStartedAt(5, '2026-05-08T10:00:00.000Z');
      expect(mockedDrust.update).toHaveBeenCalledWith('users', 5, {
        challenge_started_at: '2026-05-08T10:00:00.000Z',
      });
    });
  });

  describe('mealFailCount', () => {
    it('returns the fails count from meal_fail_count RPC', async () => {
      mockedDrust.rpc.mockResolvedValueOnce({
        column_names: ['fails'], rows: [[3]], row_count: 1, truncated: false,
      });
      mockedDrust.rpcRows.mockReturnValueOnce([{ fails: 3 }]);
      expect(await mealFailCount(7)).toBe(3);
      expect(mockedDrust.rpc).toHaveBeenCalledWith('meal_fail_count', { user_id: 7 });
    });

    it('returns 0 (and does not throw) on drust error', async () => {
      mockedDrust.rpc.mockRejectedValueOnce(new Error('boom'));
      expect(await mealFailCount(7)).toBe(0);
    });
  });
});
