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
  getDailyProgress,
  upsertDailyProgress,
  decodeMissions,
  type DailyProgressRow,
} from '../daily-progress';

const mockedDrust = drust as unknown as {
  insert: ReturnType<typeof vi.fn>;
  rpc: ReturnType<typeof vi.fn>;
  rpcRows: ReturnType<typeof vi.fn>;
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

describe('daily-progress', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getDailyProgress', () => {
    it('routes through daily_progress_for_day RPC', async () => {
      mockRpcReturns<DailyProgressRow>([
        {
          id: 1,
          user_id: 5,
          day_number: 7,
          missions_done: '["quiz"]',
          total_xp: 15,
          lucky_color: 'red',
          completed_at: null,
        },
      ]);
      const out = await getDailyProgress(5, 7);
      expect(mockedDrust.rpc).toHaveBeenCalledWith('daily_progress_for_day', {
        user_id: 5,
        day_number: 7,
      });
      expect(out?.total_xp).toBe(15);
    });

    it('returns null when the RPC has no rows', async () => {
      mockRpcReturns<DailyProgressRow>([]);
      expect(await getDailyProgress(5, 99)).toBeNull();
    });
  });

  describe('upsertDailyProgress', () => {
    it('insert path: encodes missions_done as JSON and calls drust.insert', async () => {
      mockRpcReturns<DailyProgressRow>([]); // no existing row
      mockedDrust.insert.mockResolvedValueOnce({
        id: 7,
        record: {
          id: 7,
          user_id: 5,
          day_number: 1,
          missions_done: '["quiz"]',
          total_xp: 15,
          lucky_color: 'red',
          completed_at: null,
        },
      });
      await upsertDailyProgress(5, 1, {
        missions_done: ['quiz'],
        total_xp: 15,
        lucky_color: 'red',
      });
      expect(mockedDrust.insert).toHaveBeenCalledWith('daily_progress', {
        user_id: 5,
        day_number: 1,
        missions_done: '["quiz"]',
        total_xp: 15,
        lucky_color: 'red',
        completed_at: null,
      });
    });

    it('update path: routes patches to drust.update with the existing row id', async () => {
      mockRpcReturns<DailyProgressRow>([
        {
          id: 9,
          user_id: 5,
          day_number: 1,
          missions_done: '["quiz"]',
          total_xp: 15,
          lucky_color: 'red',
          completed_at: null,
        },
      ]);
      mockedDrust.update.mockResolvedValueOnce({
        record: {
          id: 9,
          user_id: 5,
          day_number: 1,
          missions_done: '["quiz","meal:breakfast"]',
          total_xp: 35,
          lucky_color: 'red',
          completed_at: null,
        },
      });
      await upsertDailyProgress(5, 1, {
        missions_done: ['quiz', 'meal:breakfast'],
        total_xp: 35,
      });
      expect(mockedDrust.update).toHaveBeenCalledWith('daily_progress', 9, {
        missions_done: '["quiz","meal:breakfast"]',
        total_xp: 35,
      });
    });

    it('update path is a no-op when patch is empty', async () => {
      mockRpcReturns<DailyProgressRow>([
        {
          id: 9,
          user_id: 5,
          day_number: 1,
          missions_done: '[]',
          total_xp: 0,
          lucky_color: null,
          completed_at: null,
        },
      ]);
      await upsertDailyProgress(5, 1, {});
      expect(mockedDrust.update).not.toHaveBeenCalled();
      expect(mockedDrust.insert).not.toHaveBeenCalled();
    });
  });

  describe('decodeMissions', () => {
    it('parses a JSON string array', () => {
      expect(
        decodeMissions({
          id: 1,
          user_id: 1,
          day_number: 1,
          missions_done: '["quiz","meal:breakfast"]',
          total_xp: 0,
          lucky_color: null,
          completed_at: null,
        }),
      ).toEqual(['quiz', 'meal:breakfast']);
    });

    it('returns [] for null / malformed / non-array', () => {
      expect(decodeMissions(null)).toEqual([]);
      expect(
        decodeMissions({
          id: 1,
          user_id: 1,
          day_number: 1,
          missions_done: 'not-json',
          total_xp: 0,
          lucky_color: null,
          completed_at: null,
        }),
      ).toEqual([]);
      expect(
        decodeMissions({
          id: 1,
          user_id: 1,
          day_number: 1,
          missions_done: '{"a":1}',
          total_xp: 0,
          lucky_color: null,
          completed_at: null,
        }),
      ).toEqual([]);
    });
  });
});
