import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/router', () => ({ navigate: vi.fn() }));

import success from '../success';
import { $checkin, resetCheckin, setLastResult, setMeatReplaced } from '@/store/checkin';
import * as router from '@/router';

const mockedRouter = router as unknown as { navigate: ReturnType<typeof vi.fn> };

describe('check-in/success route', () => {
  beforeEach(() => {
    resetCheckin();
    vi.clearAllMocks();
  });

  it('shows fallback when lastResult is empty', () => {
    const el = success();
    expect(el.querySelector('.checkin-fallback')).not.toBeNull();
  });

  it('renders xp + fog + lucky bubble when lastResult is set', () => {
    setLastResult({ xpEarned: 35, luckyColorMatched: true, fogReductionPct: 1 });
    const el = success();
    expect(el.querySelector('.success-title')?.textContent).toContain('打卡成功');
    expect(el.textContent).toContain('35 XP');
    expect(el.textContent).toContain('1%');
    expect(el.querySelector('.xp-bubble.xp-2')).not.toBeNull(); // lucky bubble
  });

  it('shows replaced bubble when wasMeatReplaced', () => {
    setLastResult({ xpEarned: 20, luckyColorMatched: false, fogReductionPct: 1 });
    setMeatReplaced(true);
    const el = success();
    expect(el.querySelector('.xp-bubble.xp-3')).not.toBeNull();
  });

  it('continue button resets store and navigates home', () => {
    setLastResult({ xpEarned: 20, luckyColorMatched: false, fogReductionPct: 1 });
    const el = success();
    el.querySelector<HTMLButtonElement>('#next')?.click();
    expect(mockedRouter.navigate).toHaveBeenCalledWith('/home');
    expect($checkin.get().lastResult).toBeNull();
  });
});
