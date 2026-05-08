import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/router', () => ({ navigate: vi.fn() }));

import success from '../success';
import * as router from '@/router';
import { setLastResult, setMealIndex } from '@/store/checkin';
import { $today } from '@/store/today';

const mockedRouter = router as unknown as { navigate: ReturnType<typeof vi.fn> };

describe('check-in/success', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    $today.set({ dayNumber: 5, totalXpToday: 20, missionsDone: ['meal:lunch'], luckyColor: '' });
    setMealIndex(2);
    setLastResult({ xpEarned: 20, luckyColorMatched: false, fogReductionPct: 3 });
  });

  it('renders xp burst, progress, and pet/title acts', () => {
    const el = success();
    expect(el.querySelector('.xp-burst')).not.toBeNull();
    expect(el.querySelector('.success-progress')).not.toBeNull();
    expect(el.querySelector('.success-pet')).not.toBeNull();
  });

  it('progresses through act-1 → act-2 → act-3 → settled classes', () => {
    const el = success();
    expect(el.classList.contains('act-1')).toBe(true);
    vi.advanceTimersByTime(1100);
    expect(el.classList.contains('act-2')).toBe(true);
    vi.advanceTimersByTime(1000);
    expect(el.classList.contains('act-3')).toBe(true);
    vi.advanceTimersByTime(1000);
    expect(el.classList.contains('settled')).toBe(true);
  });

  it('clicking the body before settled jumps to settled', () => {
    const el = success();
    el.querySelector<HTMLElement>('.success-body')?.click();
    expect(el.classList.contains('settled')).toBe(true);
  });

  it('renders Share + Continue', () => {
    const el = success();
    expect(el.querySelector('#share')).not.toBeNull();
    expect(el.querySelector('#next')).not.toBeNull();
  });

  it('Share button copies summary on click (clipboard fallback)', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    const el = success();
    el.querySelector<HTMLButtonElement>('#share')?.click();
    await vi.waitFor(() => expect(writeText).toHaveBeenCalled());
  });

  it('Continue resets and navigates to /home', () => {
    const el = success();
    el.querySelector<HTMLButtonElement>('#next')?.click();
    expect(mockedRouter.navigate).toHaveBeenCalledWith('/home');
  });
});
