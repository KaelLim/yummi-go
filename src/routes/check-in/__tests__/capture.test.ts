import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/router', () => ({ navigate: vi.fn() }));

import capture from '../capture';
import { $checkin, resetCheckin } from '@/store/checkin';
import * as router from '@/router';

const mockedRouter = router as unknown as { navigate: ReturnType<typeof vi.fn> };

describe('check-in/capture route', () => {
  beforeEach(() => {
    resetCheckin();
    vi.clearAllMocks();
  });

  it('renders header + placeholder + shutter button', () => {
    const el = capture();
    expect(el.classList.contains('checkin-capture')).toBe(true);
    expect(el.querySelector('.checkin-title')?.textContent).toBe('拍照打卡');
    expect(el.querySelector('.capture-placeholder')).not.toBeNull();
    expect(el.querySelector('#shutter')).not.toBeNull();
  });

  it('infers mealIndex on mount and writes a meal label', () => {
    const el = capture();
    expect($checkin.get().mealIndex).toBeGreaterThanOrEqual(1);
    expect($checkin.get().mealIndex).toBeLessThanOrEqual(3);
    const tag = el.querySelector('.checkin-meal')?.textContent;
    expect(['第一餐', '第二餐', '第三餐']).toContain(tag);
  });

  it('back button navigates home', () => {
    const el = capture();
    el.querySelector<HTMLButtonElement>('#back-btn')?.click();
    expect(mockedRouter.navigate).toHaveBeenCalledWith('/home');
  });

  it('analyze button navigates to scanning route', () => {
    const el = capture();
    el.querySelector<HTMLButtonElement>('#analyze')?.click();
    expect(mockedRouter.navigate).toHaveBeenCalledWith('/check-in/scanning');
  });
});
