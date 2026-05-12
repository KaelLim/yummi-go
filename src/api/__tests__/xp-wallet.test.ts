import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../drust', () => ({
  drust: {
    list: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('../events', () => ({
  recordXpEvent: vi.fn(),
  recordGemEvent: vi.fn(),
}));

vi.mock('../pet', () => ({
  addXp: vi.fn(),
}));

import {
  PET_DAILY_XP_CAP,
  creditXp,
  feedPet,
  convertXpToGems,
  getXpBalance,
} from '../xp-wallet';
import { drust } from '../drust';
import * as events from '../events';
import * as pet from '../pet';

const mockedDrust = drust as unknown as {
  list: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
};
const mockedEvents = events as unknown as {
  recordXpEvent: ReturnType<typeof vi.fn>;
  recordGemEvent: ReturnType<typeof vi.fn>;
};
const mockedPet = pet as unknown as { addXp: ReturnType<typeof vi.fn> };

function todayKey(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function mockBalance(overrides: Partial<{
  id: number;
  user_id: number;
  balance: number;
  total_earned: number;
  fed_today: number;
  fed_today_date: string | null;
}> = {}) {
  return {
    id: 1,
    user_id: 7,
    balance: 0,
    total_earned: 0,
    fed_today: 0,
    fed_today_date: null,
    ...overrides,
  };
}

describe('api/xp-wallet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedDrust.update.mockResolvedValue({ record: {} });
  });

  describe('getXpBalance', () => {
    it('resets fed_today when the stored date is yesterday', async () => {
      mockedDrust.list.mockResolvedValueOnce({
        records: [mockBalance({ fed_today: 45, fed_today_date: '2026-04-01' })],
      });
      const out = await getXpBalance(7);
      expect(out?.fed_today).toBe(0);
      expect(out?.fed_today_date).toBe(todayKey());
      expect(mockedDrust.update).toHaveBeenCalledWith('xp_balances', 1, {
        fed_today: 0,
        fed_today_date: todayKey(),
      });
    });

    it('leaves the row alone when fed_today_date is already today', async () => {
      const row = mockBalance({ fed_today: 30, fed_today_date: todayKey() });
      mockedDrust.list.mockResolvedValueOnce({ records: [row] });
      await getXpBalance(7);
      expect(mockedDrust.update).not.toHaveBeenCalled();
    });
  });

  describe('creditXp', () => {
    it('adds to balance + total_earned and emits xp_event', async () => {
      const row = mockBalance({ balance: 10, total_earned: 50, fed_today_date: todayKey() });
      mockedDrust.list.mockResolvedValueOnce({ records: [row] });
      await creditXp(7, 25, 'quiz', 42);
      expect(mockedDrust.update).toHaveBeenCalledWith('xp_balances', 1, {
        balance: 35,
        total_earned: 75,
      });
      expect(mockedEvents.recordXpEvent).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 7, deltaXp: 25, reason: 'quiz', refId: 42 }),
      );
    });

    it('no-ops on zero / negative input', async () => {
      const row = mockBalance({ balance: 10, fed_today_date: todayKey() });
      mockedDrust.list.mockResolvedValueOnce({ records: [row] });
      await creditXp(7, 0);
      expect(mockedDrust.update).not.toHaveBeenCalled();
      expect(mockedEvents.recordXpEvent).not.toHaveBeenCalled();
    });
  });

  describe('feedPet', () => {
    it('feeds min(balance, cap - fed_today, requested) and writes pet_states', async () => {
      const row = mockBalance({ balance: 80, fed_today: 30, fed_today_date: todayKey() });
      mockedDrust.list.mockResolvedValueOnce({ records: [row] });
      mockedPet.addXp.mockResolvedValueOnce({ id: 5, level: 1, accumulated_xp: 70 });
      const result = await feedPet(7);
      // cap remaining = 100 - 30 = 70; min(80, 70, Inf) = 70
      expect(result.fed).toBe(70);
      expect(result.remainingBalance).toBe(10);
      expect(result.fedToday).toBe(100);
      expect(result.capReached).toBe(true);
      expect(mockedDrust.update).toHaveBeenCalledWith('xp_balances', 1, {
        balance: 10,
        fed_today: 100,
        fed_today_date: todayKey(),
      });
      expect(mockedPet.addXp).toHaveBeenCalledWith(7, 70, 'feed_pet', null);
    });

    it('returns fed=0 when cap is already reached', async () => {
      const row = mockBalance({
        balance: 25,
        fed_today: PET_DAILY_XP_CAP,
        fed_today_date: todayKey(),
      });
      mockedDrust.list.mockResolvedValueOnce({ records: [row] });
      const result = await feedPet(7);
      expect(result.fed).toBe(0);
      expect(result.remainingBalance).toBe(25);
      expect(result.capReached).toBe(true);
      expect(mockedDrust.update).not.toHaveBeenCalled();
      expect(mockedPet.addXp).not.toHaveBeenCalled();
    });

    it('honours an explicit requestedAmount lower than the cap headroom', async () => {
      const row = mockBalance({ balance: 100, fed_today: 0, fed_today_date: todayKey() });
      mockedDrust.list.mockResolvedValueOnce({ records: [row] });
      mockedPet.addXp.mockResolvedValueOnce({ id: 5, level: 1, accumulated_xp: 20 });
      const result = await feedPet(7, 20);
      expect(result.fed).toBe(20);
      expect(result.remainingBalance).toBe(80);
      expect(result.fedToday).toBe(20);
      expect(result.capReached).toBe(false);
    });
  });

  describe('convertXpToGems', () => {
    it('drains the wallet 1:1 into gem_balances and emits gem_event', async () => {
      mockedDrust.list
        .mockResolvedValueOnce({ records: [mockBalance({ balance: 35, fed_today_date: todayKey() })] }) // xp
        .mockResolvedValueOnce({
          records: [{ id: 9, user_id: 7, balance: 100, total_earned: 100 }],
        }); // gem
      const result = await convertXpToGems(7);
      expect(result.converted).toBe(35);
      expect(result.gemsEarned).toBe(35);
      expect(result.newGemBalance).toBe(135);
      expect(mockedDrust.update).toHaveBeenCalledWith('xp_balances', 1, { balance: 0 });
      expect(mockedDrust.update).toHaveBeenCalledWith('gem_balances', 9, {
        balance: 135,
        total_earned: 135,
      });
      expect(mockedEvents.recordGemEvent).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 7, delta: 35, reason: 'xp_overflow', balanceAfter: 135 }),
      );
    });

    it('no-ops when balance is zero', async () => {
      mockedDrust.list.mockResolvedValueOnce({
        records: [mockBalance({ balance: 0, fed_today_date: todayKey() })],
      });
      const result = await convertXpToGems(7);
      expect(result.converted).toBe(0);
      expect(mockedDrust.update).not.toHaveBeenCalled();
      expect(mockedEvents.recordGemEvent).not.toHaveBeenCalled();
    });
  });
});
