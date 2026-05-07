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
import { getPet, addXp, setMood } from '../pet';

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
};

describe('pet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getPet', () => {
    it('lists pet_states by user_id and returns first', async () => {
      mockedDrust.list.mockResolvedValueOnce({ records: [basePet] });
      const out = await getPet(5);
      expect(mockedDrust.list).toHaveBeenCalledWith('pet_states', {
        user_id: 'eq.5',
      });
      expect(out).toEqual(basePet);
    });

    it('returns null when none', async () => {
      mockedDrust.list.mockResolvedValueOnce({ records: [] });
      expect(await getPet(99)).toBeNull();
    });
  });

  describe('addXp', () => {
    it('adds xp and updates pet row with new level/stage/timestamps', async () => {
      mockedDrust.list.mockResolvedValueOnce({
        records: [{ ...basePet, accumulated_xp: 0 }],
      });
      mockedDrust.update.mockResolvedValueOnce({ record: {} });

      // 30 XP -> LV1 fills, advances to LV2 with currentXp=0
      const out = await addXp(5, 30);

      const [coll, id, patch] = mockedDrust.update.mock.calls[0];
      expect(coll).toBe('pet_states');
      expect(id).toBe(1);
      expect(patch.accumulated_xp).toBe(30);
      // LV1 needs 30, so 30 -> level 2, currentXp=0
      expect(patch.level).toBe(2);
      expect(patch.current_xp).toBe(0);
      expect(patch.stage).toBe('egg'); // levels 1-5 are egg
      expect(typeof patch.last_fed_at).toBe('string');

      expect(out.accumulated_xp).toBe(30);
      expect(out.level).toBe(2);
    });

    it('crosses to baby stage at level 6', async () => {
      // levels 1..5 each cost 30 -> 150 to be at start of LV6
      mockedDrust.list.mockResolvedValueOnce({
        records: [{ ...basePet, accumulated_xp: 149 }],
      });
      mockedDrust.update.mockResolvedValueOnce({ record: {} });

      const out = await addXp(5, 1);

      expect(out.accumulated_xp).toBe(150);
      expect(out.level).toBe(6);
      expect(out.stage).toBe('baby');
      const [, , patch] = mockedDrust.update.mock.calls[0];
      expect(patch.stage).toBe('baby');
    });

    it('throws when no pet exists', async () => {
      mockedDrust.list.mockResolvedValueOnce({ records: [] });
      await expect(addXp(99, 10)).rejects.toThrow(/pet not found/i);
    });
  });

  describe('setMood', () => {
    it('updates pet mood', async () => {
      mockedDrust.list.mockResolvedValueOnce({ records: [basePet] });
      mockedDrust.update.mockResolvedValueOnce({ record: {} });

      await setMood(5, 'happy');

      expect(mockedDrust.update).toHaveBeenCalledWith('pet_states', 1, {
        mood: 'happy',
      });
    });

    it('throws when no pet', async () => {
      mockedDrust.list.mockResolvedValueOnce({ records: [] });
      await expect(setMood(99, 'happy')).rejects.toThrow(/pet not found/i);
    });
  });
});
