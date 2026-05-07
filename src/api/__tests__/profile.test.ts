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
import { getUserFull, getProfile, updateProfile, signOath } from '../profile';

const mockedDrust = drust as unknown as {
  insert: ReturnType<typeof vi.fn>;
  rpc: ReturnType<typeof vi.fn>;
  rpcRows: ReturnType<typeof vi.fn>;
  list: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
};

describe('profile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getUserFull', () => {
    it('calls get_user_full RPC and returns first row', async () => {
      const fakeResult = {
        column_names: ['id', 'username'],
        rows: [[5, 'alice']],
        row_count: 1,
        truncated: false,
      };
      mockedDrust.rpc.mockResolvedValueOnce(fakeResult);
      mockedDrust.rpcRows.mockReturnValueOnce([
        {
          id: 5,
          username: 'alice',
          display_name: 'Alice',
          oath_signed_at: null,
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
      mockedDrust.rpc.mockResolvedValueOnce({
        column_names: [],
        rows: [],
        row_count: 0,
        truncated: false,
      });
      mockedDrust.rpcRows.mockReturnValueOnce([]);
      expect(await getUserFull(99)).toBeNull();
    });
  });

  describe('getProfile', () => {
    it('lists user_profiles filtered by user_id and returns first', async () => {
      mockedDrust.list.mockResolvedValueOnce({
        records: [
          {
            user_id: 5,
            diet_type: 'vegan',
            challenge_level: 2,
            eat_times: null,
            known_from: null,
            baseline: null,
          },
        ],
      });
      const out = await getProfile(5);
      expect(mockedDrust.list).toHaveBeenCalledWith('user_profiles', {
        user_id: 'eq.5',
      });
      expect(out?.diet_type).toBe('vegan');
    });

    it('returns null when no profile', async () => {
      mockedDrust.list.mockResolvedValueOnce({ records: [] });
      expect(await getProfile(99)).toBeNull();
    });
  });

  describe('updateProfile', () => {
    it('finds profile id then updates', async () => {
      mockedDrust.list.mockResolvedValueOnce({ records: [{ id: 11 }] });
      mockedDrust.update.mockResolvedValueOnce({ record: {} });

      await updateProfile(5, { diet_type: 'vegan', challenge_level: 3 });

      expect(mockedDrust.list).toHaveBeenCalledWith('user_profiles', {
        user_id: 'eq.5',
      });
      expect(mockedDrust.update).toHaveBeenCalledWith('user_profiles', 11, {
        diet_type: 'vegan',
        challenge_level: 3,
      });
    });

    it('throws when no profile exists', async () => {
      mockedDrust.list.mockResolvedValueOnce({ records: [] });
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
});
