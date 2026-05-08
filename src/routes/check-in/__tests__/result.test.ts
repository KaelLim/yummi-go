import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/router', () => ({ navigate: vi.fn() }));
vi.mock('@/api/check-ins', () => ({ createCheckIn: vi.fn().mockResolvedValue({}) }));
vi.mock('@/store/pet', () => ({ awardXp: vi.fn().mockResolvedValue(undefined) }));

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

describe('check-in/result route', () => {
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

  it('renders item rows for scanned veg-only output, no meat banner', () => {
    setScan({
      items: [veg('生菜', ['green']), veg('番茄', ['red'])],
      hasMeat: false,
      scanFailed: false,
    });
    const el = result();
    expect(el.querySelectorAll('.result-item').length).toBe(2);
    expect(el.querySelector<HTMLElement>('#meat-banner')?.hidden).toBe(true);
  });

  it('shows meat banner when items contain meat', () => {
    setScan({
      items: [veg('生菜'), meat('牛肉片')],
      hasMeat: true,
      scanFailed: false,
    });
    const el = result();
    const banner = el.querySelector<HTMLElement>('#meat-banner');
    expect(banner?.hidden).toBe(false);
    expect(el.querySelector('#meat-list')?.textContent).toContain('牛肉片');
  });

  it('clicking 否 flips items to veg + sets meat-replaced + hides banner', () => {
    setScan({
      items: [meat('牛肉片')],
      hasMeat: true,
      scanFailed: false,
    });
    const el = result();
    document.body.appendChild(el);
    el.querySelector<HTMLButtonElement>('#meat-no')?.click();
    expect($checkin.get().wasMeatReplaced).toBe(true);
    expect($checkin.get().items.every((i) => i.isVeg)).toBe(true);
    expect(el.querySelector<HTMLElement>('#meat-banner')?.hidden).toBe(true);
    el.remove();
  });

  it('clicking 是 navigates home and resets store', () => {
    setScan({
      items: [meat('牛肉片')],
      hasMeat: true,
      scanFailed: false,
    });
    const el = result();
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    el.querySelector<HTMLButtonElement>('#meat-yes')?.click();
    expect(mockedRouter.navigate).toHaveBeenCalledWith('/home');
    expect($checkin.get().items).toEqual([]);
    alertSpy.mockRestore();
  });

  it('confirm posts createCheckIn with correct XP (lucky-match + meal-2 base)', async () => {
    setScan({
      items: [veg('番茄', ['red'])],
      hasMeat: false,
      scanFailed: false,
    });
    const el = result();
    document.body.appendChild(el);
    el.querySelector<HTMLButtonElement>('#confirm-btn')?.click();
    await vi.waitFor(() => expect(mockedRouter.navigate).toHaveBeenCalledWith('/check-in/success'));
    const args = mockedCreate.mock.calls[0][0];
    expect(args.userId).toBe(7);
    expect(args.dayNumber).toBe(1);
    expect(args.mealIndex).toBe(2);
    expect(args.luckyColorMatched).toBe(true); // 番茄 red matches 紅色
    expect(args.xpEarned).toBe(20 + 15); // meal-2 base + lucky bonus
    el.remove();
  });

  it('confirm without lucky match still credits base XP', async () => {
    setScan({
      items: [veg('生菜', ['green'])],
      hasMeat: false,
      scanFailed: false,
    });
    const el = result();
    document.body.appendChild(el);
    el.querySelector<HTMLButtonElement>('#confirm-btn')?.click();
    await vi.waitFor(() => expect(mockedRouter.navigate).toHaveBeenCalledWith('/check-in/success'));
    const args = mockedCreate.mock.calls[0][0];
    expect(args.luckyColorMatched).toBe(false);
    expect(args.xpEarned).toBe(20);
    el.remove();
  });
});
