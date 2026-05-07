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
    it('lists challenge_scripts and sorts by day_number', async () => {
      mockedDrust.list.mockResolvedValueOnce({
        records: [
          { id: 3, day_number: 3 },
          { id: 1, day_number: 1 },
          { id: 2, day_number: 2 },
        ],
      });
      const out = await listChallengeScripts();
      expect(mockedDrust.list).toHaveBeenCalledWith('challenge_scripts', {
        limit: '50',
      });
      expect(out.map((s) => s.day_number)).toEqual([1, 2, 3]);
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

    it('returns null when empty', async () => {
      mockedDrust.rpc.mockResolvedValueOnce({
        column_names: [],
        rows: [],
        row_count: 0,
        truncated: false,
      });
      mockedDrust.rpcRows.mockReturnValueOnce([]);
      expect(await randomQuiz()).toBeNull();
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
    it('lists restaurants filtered by id', async () => {
      mockedDrust.list.mockResolvedValueOnce({
        records: [{ id: 7, name: 'Thai Place' }],
      });
      const out = await getRestaurant(7);
      expect(mockedDrust.list).toHaveBeenCalledWith('restaurants', {
        id: 'eq.7',
      });
      expect(out?.name).toBe('Thai Place');
    });

    it('returns null when missing', async () => {
      mockedDrust.list.mockResolvedValueOnce({ records: [] });
      expect(await getRestaurant(999)).toBeNull();
    });
  });
});
