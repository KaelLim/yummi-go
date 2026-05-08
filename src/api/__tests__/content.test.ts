import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/api/drust', () => ({
  drust: {
    insert: vi.fn(),
    rpc: vi.fn(),
    rpcRows: vi.fn(),
    list: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    get: vi.fn(),
  },
}));

import { drust } from '@/api/drust';
import {
  getDayScript,
  listChallengeScripts,
  randomQuiz,
  recordQuizAttempt,
  listRestaurants,
  getRestaurant,
} from '../content';

const mockedDrust = drust as unknown as {
  rpc: ReturnType<typeof vi.fn>;
  rpcRows: ReturnType<typeof vi.fn>;
  list: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
};

describe('content', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getDayScript', () => {
    it('calls get_day_script RPC and returns first row', async () => {
      const fakeScript = {
        id: 1,
        day_number: 5,
        lucky_color: 'red',
        greeting: 'hi',
        action_type: 'quiz',
        task_description: 't',
        bonus_challenge: 'b',
        fog_reduction_pct: 5,
      };
      mockedDrust.rpc.mockResolvedValueOnce({
        column_names: [],
        rows: [],
        row_count: 1,
        truncated: false,
      });
      mockedDrust.rpcRows.mockReturnValueOnce([fakeScript]);

      const out = await getDayScript(5);

      expect(mockedDrust.rpc).toHaveBeenCalledWith('get_day_script', {
        day_number: 5,
      });
      expect(out).toEqual(fakeScript);
    });

    it('returns null when empty', async () => {
      mockedDrust.rpc.mockResolvedValueOnce({
        column_names: [],
        rows: [],
        row_count: 0,
        truncated: false,
      });
      mockedDrust.rpcRows.mockReturnValueOnce([]);
      expect(await getDayScript(99)).toBeNull();
    });
  });

  describe('listChallengeScripts', () => {
    it('merges drust live rows with the fixture so all 30 days are present', async () => {
      mockedDrust.list.mockResolvedValueOnce({
        records: [
          { id: 999, day_number: 1, lucky_color: 'live-red' },
          { id: 998, day_number: 2, lucky_color: 'live-yellow' },
          { id: 997, day_number: 3, lucky_color: 'live-green' },
        ],
      });
      const out = await listChallengeScripts();
      expect(mockedDrust.list).toHaveBeenCalledWith('challenge_scripts', {
        sort: 'day_number',
        limit: '100',
      });
      expect(out).toHaveLength(30);
      // live rows override fixture for matching day_number
      expect(out[0].lucky_color).toBe('live-red');
      expect(out[1].lucky_color).toBe('live-yellow');
      expect(out[2].lucky_color).toBe('live-green');
      // fixture fills the rest
      expect(out[29].day_number).toBe(30);
    });

    it('returns the full 30-day fixture when drust returns nothing', async () => {
      mockedDrust.list.mockResolvedValueOnce({ records: [] });
      const out = await listChallengeScripts();
      expect(out).toHaveLength(30);
      expect(out.map((s) => s.day_number)).toEqual(
        Array.from({ length: 30 }, (_, i) => i + 1),
      );
    });
  });

  describe('randomQuiz', () => {
    it('calls random_quiz RPC and returns first', async () => {
      const fakeQ = {
        id: 1,
        source: 'x',
        category: 'y',
        question: 'q',
        option_a: 'a',
        option_b: 'b',
        option_c: 'c',
        correct_answer: 'a',
        explanation: 'e',
      };
      mockedDrust.rpc.mockResolvedValueOnce({
        column_names: [],
        rows: [],
        row_count: 1,
        truncated: false,
      });
      mockedDrust.rpcRows.mockReturnValueOnce([fakeQ]);

      const out = await randomQuiz();

      expect(mockedDrust.rpc).toHaveBeenCalledWith('random_quiz');
      expect(out).toEqual(fakeQ);
    });

    it('falls back to a fixture question when drust returns empty', async () => {
      mockedDrust.rpc.mockResolvedValueOnce({
        column_names: [],
        rows: [],
        row_count: 0,
        truncated: false,
      });
      mockedDrust.rpcRows.mockReturnValueOnce([]);
      const q = await randomQuiz();
      expect(q).not.toBeNull();
      expect(q?.question).toBeTruthy();
      expect(q?.correct_answer).toBeTruthy();
    });
  });

  describe('recordQuizAttempt', () => {
    it('inserts quiz_attempts with correct=1 when right', async () => {
      mockedDrust.insert.mockResolvedValueOnce({ id: 1, record: {} });
      await recordQuizAttempt(5, 22, 'a', true);
      expect(mockedDrust.insert).toHaveBeenCalledWith('quiz_attempts', {
        user_id: 5,
        question_id: 22,
        answer: 'a',
        correct: 1,
      });
    });

    it('inserts correct=0 when wrong', async () => {
      mockedDrust.insert.mockResolvedValueOnce({ id: 2, record: {} });
      await recordQuizAttempt(5, 22, 'b', false);
      const [, body] = mockedDrust.insert.mock.calls[0];
      expect(body.correct).toBe(0);
    });
  });

  describe('listRestaurants', () => {
    it('lists with limit=100', async () => {
      mockedDrust.list.mockResolvedValueOnce({
        records: [{ id: 1 }, { id: 2 }],
      });
      const out = await listRestaurants();
      expect(mockedDrust.list).toHaveBeenCalledWith('restaurants', {
        limit: '100',
      });
      expect(out).toHaveLength(2);
    });
  });

  describe('getRestaurant', () => {
    it('uses path-based GET (drust.get) instead of list filter', async () => {
      mockedDrust.get.mockResolvedValueOnce({ id: 7, name: 'Thai Place' });
      const out = await getRestaurant(7);
      expect(mockedDrust.get).toHaveBeenCalledWith('restaurants', 7);
      expect(out?.name).toBe('Thai Place');
    });

    it('returns null when missing', async () => {
      mockedDrust.get.mockResolvedValueOnce(null);
      expect(await getRestaurant(999)).toBeNull();
    });
  });
});
