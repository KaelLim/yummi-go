import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/router', () => ({ navigate: vi.fn() }));
vi.mock('@/api/check-ins', () => ({
  createCheckIn: vi.fn().mockResolvedValue({ id: 99 }),
  listCheckIns: vi.fn().mockResolvedValue([]),
}));
vi.mock('@/store/pet', () => ({
  awardXp: vi.fn().mockResolvedValue({ credited: 0, xpFedToPet: 0, gemsFromXp: 0 }),
  reloadWallet: vi.fn().mockResolvedValue(undefined),
}));

import result from '../result';
import {
  $checkin,
  resetCheckin,
  setCapture,
  setScan,
  setMealIndex,
} from '@/store/checkin';
import { $user } from '@/store/user';
import { setDay } from '@/store/today';
import * as router from '@/router';
import * as checkIns from '@/api/check-ins';
import type { ScanResult } from '@/lib/mock-ai';

const mockedRouter = router as unknown as { navigate: ReturnType<typeof vi.fn> };
const mockedCreate = checkIns.createCheckIn as unknown as ReturnType<typeof vi.fn>;

const veg = (name: string, colors: string[] = []): ScanResult['items'][number] => ({
  name,
  cal: 50,
  protein: 1,
  carb: 5,
  fat: 1,
  fiber: 1,
  isVeg: true,
  colors,
  weightG: 100,
});
const meat = (name: string): ScanResult['items'][number] => ({
  ...veg(name, ['red']),
  isVeg: false,
});

function seedDay1Red() {
  const script = {
    id: 1,
    day_number: 1,
    lucky_color: '紅色',
    greeting: 'g',
    action_type: 'a',
    task_description: 't',
    bonus_challenge: 'b',
    fog_reduction_pct: 1,
  };
  setDay([script], 1);
}

describe('check-in/result (prototype meat-detection prompt)', () => {
  beforeEach(() => {
    resetCheckin();
    vi.clearAllMocks();
    $user.set({ id: 7, username: 'u', displayName: 'u' });
    setCapture('data:x');
    setMealIndex(2);
    seedDay1Red();
  });

  it('shows fallback when no scan in store', () => {
    resetCheckin();
    const el = result();
    expect(el.querySelector('.checkin-fallback')).not.toBeNull();
  });

  it('no-meat scan: auto-submits and navigates to /check-in/success without showing a banner', async () => {
    setScan({
      items: [veg('生菜', ['green']), veg('番茄', ['red'])],
      hasMeat: false,
      scanFailed: false,
    });
    const el = result();
    expect(el.querySelector('.checkin-veg-pass')).not.toBeNull();
    expect(el.querySelector('#meat-banner')).toBeNull();
    await vi.waitFor(() =>
      expect(mockedRouter.navigate).toHaveBeenCalledWith('/check-in/success'),
    );
    expect(mockedCreate).toHaveBeenCalledTimes(1);
  });

  it('meat scan: renders banner with detected names and no nutrition card', () => {
    setScan({
      items: [veg('生菜'), meat('牛肉片'), meat('豬肉絲')],
      hasMeat: true,
      scanFailed: false,
    });
    const el = result();
    const banner = el.querySelector<HTMLElement>('#meat-banner');
    expect(banner).not.toBeNull();
    expect(banner?.hidden).toBeFalsy();
    expect(el.querySelector('#meat-list')?.textContent).toContain('牛肉片');
    expect(el.querySelector('#meat-list')?.textContent).toContain('豬肉絲');
    // Nutrition belongs to the success page now — not here.
    expect(el.querySelector('#nutrition-card')).toBeNull();
    expect(el.querySelector('.nutrition-grid')).toBeNull();
    // No editable list / vegan chips / summary on this prototype page.
    expect(el.querySelector('#items-list')).toBeNull();
    expect(el.querySelector('#vegan-section')).toBeNull();
    expect(el.querySelector('#summary')).toBeNull();
  });

  it('clicking 是 navigates to /check-in/fail', () => {
    setScan({
      items: [meat('牛肉片')],
      hasMeat: true,
      scanFailed: false,
    });
    const el = result();
    el.querySelector<HTMLButtonElement>('#meat-yes')?.click();
    expect(mockedRouter.navigate).toHaveBeenCalledWith('/check-in/fail');
  });

  it('clicking 否 flips items, submits, and navigates to /check-in/success', async () => {
    setScan({
      items: [meat('牛肉片')],
      hasMeat: true,
      scanFailed: false,
    });
    const el = result();
    el.querySelector<HTMLButtonElement>('#meat-no')?.click();
    expect($checkin.get().wasMeatReplaced).toBe(true);
    expect($checkin.get().items.every((i) => i.isVeg)).toBe(true);
    await vi.waitFor(() =>
      expect(mockedRouter.navigate).toHaveBeenCalledWith('/check-in/success'),
    );
    const args = mockedCreate.mock.calls[0][0];
    expect(args.wasMeatReplaced).toBe(true);
  });

  it('submit credits XP with lucky-match bonus and stamps nutrition onto lastResult', async () => {
    setScan({
      items: [veg('番茄', ['red'])],
      hasMeat: false,
      scanFailed: false,
    });
    result();
    await vi.waitFor(() =>
      expect(mockedRouter.navigate).toHaveBeenCalledWith('/check-in/success'),
    );
    const args = mockedCreate.mock.calls[0][0];
    expect(args.mealIndex).toBe(2);
    expect(args.luckyColorMatched).toBe(true);
    expect(args.xpEarned).toBe(20 + 15);
    expect($checkin.get().lastResult?.nutrition).not.toBeNull();
    expect($checkin.get().lastResult?.nutrition?.cal).toBeGreaterThan(0);
  });

  it('submit without lucky match still credits base XP', async () => {
    setScan({
      items: [veg('生菜', ['green'])],
      hasMeat: false,
      scanFailed: false,
    });
    result();
    await vi.waitFor(() =>
      expect(mockedRouter.navigate).toHaveBeenCalledWith('/check-in/success'),
    );
    const args = mockedCreate.mock.calls[0][0];
    expect(args.luckyColorMatched).toBe(false);
    expect(args.xpEarned).toBe(20);
  });
});
