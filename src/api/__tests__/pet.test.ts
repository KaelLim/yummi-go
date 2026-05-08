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
import { getPet, addXp, setMood, setStrikes, clearStrikes } from '../pet';

const mockedDrust = drust as unknown as {
  rpc: ReturnType<typeof vi.fn>;
  rpcRows: ReturnType<typeof vi.fn>;
  list: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
};

const basePet = {
  id: 1,
  user_id: 5,
  level: 1,
  current_xp: 0,
  accumulated_xp: 0,
  stage: 'egg',
  mood: 'normal',
  last_fed_at: null,
  strikes: 0,
  poisoned_until: null,
};

function mockPetRpcReturns(row: Record<string, unknown> | null): void {
  mockedDrust.rpc.mockResolvedValueOnce({
    column_names: [],
    rows: [],
    row_count: row ? 1 : 0,
    truncated: false,
  });
  mockedDrust.rpcRows.mockReturnValueOnce(row ? [row] : []);
}

describe('pet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getPet', () => {
    it('routes through pet_for_user RPC', async () => {
      mockPetRpcReturns(basePet);
      const out = await getPet(5);
      expect(mockedDrust.rpc).toHaveBeenCalledWith('pet_for_user', { user_id: 5 });
      expect(out).toEqual(basePet);
    });

    it('returns null when the RPC has no rows', async () => {
      mockPetRpcReturns(null);
      expect(await getPet(99)).toBeNull();
    });
  });

  describe('addXp', () => {
    it('adds xp and updates pet row with new level/stage/timestamps', async () => {
      mockPetRpcReturns({ ...basePet, accumulated_xp: 0 });
      mockedDrust.update.mockResolvedValueOnce({ record: {} });

      const out = await addXp(5, 30);

      const [coll, id, patch] = mockedDrust.update.mock.calls[0];
      expect(coll).toBe('pet_states');
      expect(id).toBe(1);
      expect(patch.accumulated_xp).toBe(30);
      expect(patch.level).toBe(2);
      expect(patch.current_xp).toBe(0);
      expect(patch.stage).toBe('egg');
      expect(typeof patch.last_fed_at).toBe('string');

      expect(out.accumulated_xp).toBe(30);
      expect(out.level).toBe(2);
    });

    it('crosses to baby stage at level 6', async () => {
      mockPetRpcReturns({ ...basePet, accumulated_xp: 149 });
      mockedDrust.update.mockResolvedValueOnce({ record: {} });

      const out = await addXp(5, 1);

      expect(out.accumulated_xp).toBe(150);
      expect(out.level).toBe(6);
      expect(out.stage).toBe('baby');
      const [, , patch] = mockedDrust.update.mock.calls[0];
      expect(patch.stage).toBe('baby');
    });

    it('throws when no pet exists', async () => {
      mockPetRpcReturns(null);
      await expect(addXp(99, 10)).rejects.toThrow(/pet not found/i);
    });
  });

  describe('setMood', () => {
    it('updates pet mood', async () => {
      mockPetRpcReturns(basePet);
      mockedDrust.update.mockResolvedValueOnce({ record: {} });

      await setMood(5, 'happy');

      expect(mockedDrust.update).toHaveBeenCalledWith('pet_states', 1, {
        mood: 'happy',
      });
    });

    it('throws when no pet', async () => {
      mockPetRpcReturns(null);
      await expect(setMood(99, 'happy')).rejects.toThrow(/pet not found/i);
    });
  });

  describe('setStrikes', () => {
    it('writes strikes + poisoned_until via update_record', async () => {
      mockPetRpcReturns(basePet);
      mockedDrust.update.mockResolvedValueOnce({ record: {} });
      const future = '2026-05-09T10:00:00.000Z';
      const out = await setStrikes(5, 3, future);
      expect(mockedDrust.update).toHaveBeenCalledWith('pet_states', 1, {
        strikes: 3,
        poisoned_until: future,
      });
      expect(out.strikes).toBe(3);
      expect(out.poisoned_until).toBe(future);
    });
  });

  describe('clearStrikes', () => {
    it('zeros strikes and poison via update_record', async () => {
      mockPetRpcReturns({ ...basePet, strikes: 3, poisoned_until: 'x' });
      mockedDrust.update.mockResolvedValueOnce({ record: {} });
      const out = await clearStrikes(5);
      expect(mockedDrust.update).toHaveBeenCalledWith('pet_states', 1, {
        strikes: 0,
        poisoned_until: null,
      });
      expect(out.strikes).toBe(0);
      expect(out.poisoned_until).toBeNull();
    });
  });
});
