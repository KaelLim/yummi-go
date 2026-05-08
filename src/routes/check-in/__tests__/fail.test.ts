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

  it('renders fail copy, Try Again, and 回首頁 buttons', () => {
    const el = fail();
    expect(el.textContent).toContain('蔬食餐不能有肉');
    expect(el.querySelector('#try-again')).not.toBeNull();
    expect(el.querySelector('#go-home')).not.toBeNull();
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
