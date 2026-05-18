import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/router', () => ({ navigate: vi.fn() }));

import fail from '../fail';
import * as router from '@/router';
import { $today } from '@/store/today';
import { $checkin, setMealIndex } from '@/store/checkin';

const mockedRouter = router as unknown as { navigate: ReturnType<typeof vi.fn> };

describe('check-in/fail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    $today.set({ dayNumber: 5, totalXpToday: 0, missionsDone: [], luckyColor: '' });
    $checkin.set({
      imageDataUrl: null, items: [], scan: null, lastResult: null,
      mealIndex: 2, veganType: null, wasMeatReplaced: false,
    });
  });

  it('renders next-meal encouragement copy + both CTAs', () => {
    const el = fail();
    // mealIndex 2 (lunch) → next meal is 第三餐 (slot-based rename).
    expect(el.textContent).toContain('第三餐一起加油');
    expect(el.textContent).toContain('小綠相信你');
    expect(el.querySelector('#try-again')?.textContent).toContain('換個方式打卡');
    expect(el.querySelector('#go-home')?.textContent).toContain('下次再來');
  });

  it('writes meal_fail mission for the current meal slot on mount', () => {
    fail();
    expect($today.get().missionsDone).toContain('meal_fail:lunch');
  });

  it('Try Again navigates to /check-in', () => {
    const el = fail();
    el.querySelector<HTMLButtonElement>('#try-again')?.click();
    expect(mockedRouter.navigate).toHaveBeenCalledWith('/check-in');
  });

  it('回首頁 navigates to /home', () => {
    const el = fail();
    el.querySelector<HTMLButtonElement>('#go-home')?.click();
    expect(mockedRouter.navigate).toHaveBeenCalledWith('/home');
  });

  it('handles meal_index 1 / 3 too', () => {
    setMealIndex(1);
    fail();
    expect($today.get().missionsDone).toContain('meal_fail:breakfast');
  });
});
