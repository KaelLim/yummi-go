import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/api/drust', () => ({
  drust: {
    list: vi.fn(),
    update: vi.fn(),
  },
}));

import { drust } from '@/api/drust';
import {
  getGemBalance,
  getMakeupCards,
  swapGemsForCard,
  spendMakeupCard,
  GEMS_PER_CARD,
} from '../wallet';

const mocked = drust as unknown as {
  list: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
};

describe('wallet api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getGemBalance / getMakeupCards', () => {
    it('client-side filters by user_id', async () => {
      mocked.list.mockResolvedValueOnce({
        records: [
          { id: 1, user_id: 1, balance: 50, total_earned: 50, total_spent: 0 },
          { id: 2, user_id: 5, balance: 200, total_earned: 200, total_spent: 0 },
        ],
      });
      const out = await getGemBalance(5);
      expect(out?.balance).toBe(200);
      expect(out?.id).toBe(2);
    });

    it('returns null when no row matches', async () => {
      mocked.list.mockResolvedValueOnce({ records: [] });
      expect(await getMakeupCards(99)).toBeNull();
    });
  });

  describe('swapGemsForCard', () => {
    it('deducts gems, increments cards, returns new totals', async () => {
      mocked.list
        .mockResolvedValueOnce({
          records: [{ id: 9, user_id: 5, balance: 200, total_earned: 200, total_spent: 0 }],
        })
        .mockResolvedValueOnce({
          records: [{ id: 7, user_id: 5, card_count: 1, fragment_count: 2 }],
        });
      mocked.update.mockResolvedValue({ record: {} });

      const out = await swapGemsForCard(5);

      expect(mocked.update).toHaveBeenCalledWith('gem_balances', 9, {
        balance: 200 - GEMS_PER_CARD,
        total_spent: GEMS_PER_CARD,
      });
      expect(mocked.update).toHaveBeenCalledWith('makeup_cards', 7, {
        card_count: 2,
      });
      expect(out).toEqual({ balance: 100, cards: 2 });
    });

    it('throws when balance is insufficient', async () => {
      mocked.list
        .mockResolvedValueOnce({
          records: [{ id: 9, user_id: 5, balance: 50, total_earned: 50, total_spent: 0 }],
        })
        .mockResolvedValueOnce({
          records: [{ id: 7, user_id: 5, card_count: 0, fragment_count: 0 }],
        });
      await expect(swapGemsForCard(5)).rejects.toThrow(/寶石不足/);
      expect(mocked.update).not.toHaveBeenCalled();
    });
  });

  describe('spendMakeupCard', () => {
    it('decrements card_count', async () => {
      mocked.list.mockResolvedValueOnce({
        records: [{ id: 7, user_id: 5, card_count: 2, fragment_count: 0 }],
      });
      mocked.update.mockResolvedValueOnce({ record: {} });
      const out = await spendMakeupCard(5);
      expect(mocked.update).toHaveBeenCalledWith('makeup_cards', 7, {
        card_count: 1,
      });
      expect(out).toEqual({ cards: 1 });
    });

    it('throws when no cards left', async () => {
      mocked.list.mockResolvedValueOnce({
        records: [{ id: 7, user_id: 5, card_count: 0, fragment_count: 0 }],
      });
      await expect(spendMakeupCard(5)).rejects.toThrow(/沒有可用的補簽卡/);
    });
  });
});
