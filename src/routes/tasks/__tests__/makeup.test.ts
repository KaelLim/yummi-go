import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/router', () => ({ navigate: vi.fn() }));
vi.mock('@/api/wallet', () => ({
  swapGemsForCard: vi.fn().mockResolvedValue({ balance: 0, cards: 1 }),
  GEMS_PER_CARD: 100,
}));
vi.mock('@/api/profile', () => ({
  getUserFull: vi.fn().mockResolvedValue(null),
}));

import makeup from '../makeup';
import { $user, $profile } from '@/store/user';
import * as wallet from '@/api/wallet';
import type { UserFull } from '@/api/profile';

const mockedSwap = wallet.swapGemsForCard as unknown as ReturnType<typeof vi.fn>;

const seedProfile = (gems: number, fragments: number, cards: number): UserFull => ({
  id: 7,
  username: 'u',
  display_name: 'u',
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
  gems,
  total_earned: 0,
  card_count: cards,
  fragment_count: fragments,
});

describe('makeup route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    $user.set({ id: 7, username: 'u', displayName: 'u' });
    $profile.set(null);
  });

  it('renders zeroed wallet when profile is empty', () => {
    const el = makeup();
    expect(el.querySelector('[data-bind="gems"]')?.textContent).toBe('0');
    expect(el.querySelector('[data-bind="cards"]')?.textContent).toBe('0');
    expect(el.querySelector('[data-bind="fragments"]')?.textContent).toBe('0');
  });

  it('reflects $profile values', () => {
    const el = makeup();
    document.body.appendChild(el);
    $profile.set(seedProfile(200, 6, 1));
    expect(el.querySelector('[data-bind="gems"]')?.textContent).toBe('200');
    expect(el.querySelector('[data-bind="cards"]')?.textContent).toBe('1');
    expect(el.querySelector('[data-bind="fragments"]')?.textContent).toBe('6');
    el.remove();
  });

  it('disables swap button when balance < 100', () => {
    const el = makeup();
    document.body.appendChild(el);
    $profile.set(seedProfile(50, 0, 0));
    const btn = el.querySelector<HTMLButtonElement>('#swap-btn')!;
    expect(btn.disabled).toBe(true);
    el.remove();
  });

  it('enables swap button when balance >= 100', () => {
    const el = makeup();
    document.body.appendChild(el);
    $profile.set(seedProfile(100, 0, 0));
    const btn = el.querySelector<HTMLButtonElement>('#swap-btn')!;
    expect(btn.disabled).toBe(false);
    el.remove();
  });

  it('calls swapGemsForCard on click and refreshes profile', async () => {
    const el = makeup();
    document.body.appendChild(el);
    $profile.set(seedProfile(200, 0, 0));
    el.querySelector<HTMLButtonElement>('#swap-btn')?.click();
    await vi.waitFor(() => expect(mockedSwap).toHaveBeenCalledWith(7));
    el.remove();
  });

  it('surfaces server error in the error slot', async () => {
    mockedSwap.mockRejectedValueOnce(new Error('寶石不足'));
    const el = makeup();
    document.body.appendChild(el);
    $profile.set(seedProfile(100, 0, 0));
    el.querySelector<HTMLButtonElement>('#swap-btn')?.click();
    await vi.waitFor(() => {
      const err = el.querySelector<HTMLElement>('#error');
      expect(err?.hidden).toBe(false);
      expect(err?.textContent).toContain('寶石不足');
    });
    el.remove();
  });
});
