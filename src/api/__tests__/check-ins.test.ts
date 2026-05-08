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
import { createCheckIn, listCheckIns } from '../check-ins';

const mockedDrust = drust as unknown as {
  insert: ReturnType<typeof vi.fn>;
  list: ReturnType<typeof vi.fn>;
  rpc: ReturnType<typeof vi.fn>;
  rpcRows: ReturnType<typeof vi.fn>;
};

function mockListRpc<T>(rows: T[]): void {
  mockedDrust.rpc.mockResolvedValueOnce({
    column_names: [],
    rows: [],
    row_count: rows.length,
    truncated: false,
  });
  mockedDrust.rpcRows.mockReturnValueOnce(rows);
}

describe('check-ins', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createCheckIn', () => {
    it('inserts encoded JSON for food/nutrition and 0/1 for booleans', async () => {
      const fakeRow = {
        id: 1,
        user_id: 5,
        day_number: 3,
        meal_index: 2,
        timestamp: '2026-05-07T12:00:00Z',
        food_items: '[]',
        nutrition: '{}',
        vegan_type: 'lacto',
        was_meat_replaced: 1,
        lucky_color_matched: 0,
        xp_earned: 10,
        gems_earned: 5,
      };
      mockedDrust.insert.mockResolvedValueOnce({ id: 1, record: fakeRow });

      const out = await createCheckIn({
        userId: 5,
        dayNumber: 3,
        mealIndex: 2,
        foodItems: [{ name: 'rice' }],
        nutrition: { kcal: 300 },
        veganType: 'lacto',
        wasMeatReplaced: true,
        luckyColorMatched: false,
        xpEarned: 10,
        gemsEarned: 5,
      });

      expect(mockedDrust.insert).toHaveBeenCalledTimes(1);
      const [coll, body] = mockedDrust.insert.mock.calls[0];
      expect(coll).toBe('check_ins');
      expect(body.user_id).toBe(5);
      expect(body.day_number).toBe(3);
      expect(body.meal_index).toBe(2);
      expect(body.food_items).toBe(JSON.stringify([{ name: 'rice' }]));
      expect(body.nutrition).toBe(JSON.stringify({ kcal: 300 }));
      expect(body.vegan_type).toBe('lacto');
      expect(body.was_meat_replaced).toBe(1);
      expect(body.lucky_color_matched).toBe(0);
      expect(body.xp_earned).toBe(10);
      expect(body.gems_earned).toBe(5);

      expect(out).toEqual(fakeRow);
    });

    it('encodes booleans both true', async () => {
      mockedDrust.insert.mockResolvedValueOnce({ id: 2, record: {} });
      await createCheckIn({
        userId: 1,
        dayNumber: 1,
        mealIndex: 1,
        foodItems: [],
        nutrition: {},
        veganType: null,
        wasMeatReplaced: false,
        luckyColorMatched: true,
        xpEarned: 0,
        gemsEarned: 0,
      });
      const [, body] = mockedDrust.insert.mock.calls[0];
      expect(body.was_meat_replaced).toBe(0);
      expect(body.lucky_color_matched).toBe(1);
      expect(body.vegan_type).toBeNull();
    });
  });

  describe('listCheckIns', () => {
    it('routes through check_ins_for_user RPC when no day given', async () => {
      mockListRpc([
        { id: 1, user_id: 5, day_number: 1 },
        { id: 2, user_id: 5, day_number: 2 },
      ]);
      const out = await listCheckIns(5);
      expect(mockedDrust.rpc).toHaveBeenCalledWith('check_ins_for_user', {
        user_id: 5,
      });
      expect(out.map((c) => c.id)).toEqual([1, 2]);
    });

    it('routes through check_ins_for_user_day RPC when a day is given', async () => {
      mockListRpc([
        { id: 2, user_id: 5, day_number: 3 },
        { id: 3, user_id: 5, day_number: 3 },
      ]);
      const out = await listCheckIns(5, 3);
      expect(mockedDrust.rpc).toHaveBeenCalledWith('check_ins_for_user_day', {
        user_id: 5,
        day_number: 3,
      });
      expect(out.map((c) => c.id)).toEqual([2, 3]);
    });
  });
});
