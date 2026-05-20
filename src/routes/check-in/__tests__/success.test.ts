import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/router', () => ({ navigate: vi.fn() }));

vi.mock('@/api/check-ins', () => ({
  updateCheckInItems: vi.fn().mockResolvedValue(undefined),
}));

import success from '../success';
import * as router from '@/router';
import * as checkInsApi from '@/api/check-ins';
import { setLastResult, setMealIndex, $checkin } from '@/store/checkin';
import { $today } from '@/store/today';
import { $profile, $user } from '@/store/user';
import type { UserFull } from '@/api/profile';

const mockedRouter = router as unknown as { navigate: ReturnType<typeof vi.fn> };
const mockedCheckIns = checkInsApi as unknown as {
  updateCheckInItems: ReturnType<typeof vi.fn>;
};

function profileWith(level: number | null, eatTimes: string | null = null): UserFull {
  return {
    id: 1, username: 'k', display_name: 'k', is_guest: 0,
    oath_signed_at: null, challenge_started_at: null,
    diet_type: 'omnivore', challenge_level: level,
    eat_times: eatTimes, known_from: null, baseline: null, purpose: 'body',
    level: 1, current_xp: 0, accumulated_xp: 0, stage: 'egg', mood: 'normal',
    strikes: 0, poisoned_until: null,
    gems: 0, total_earned: 0, card_count: 0, fragment_count: 0,
  };
}

describe('check-in/success', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    $today.set({ dayNumber: 5, totalXpToday: 20, missionsDone: ['meal:lunch'], luckyColor: '' });
    setMealIndex(2);
    setLastResult({
      checkInId: 99,
      xpEarned: 20,
      luckyColorMatched: false,
      fogReductionPct: 3,
      xpFedToPet: 20,
      gemsFromXp: 0,
      items: [
        { name: '青菜', cal: 30, protein: 2, carb: 5, fat: 0, fiber: 2, isVeg: true, colors: ['green'], weightG: 80 },
      ],
      nutrition: { cal: 320, protein: 12, carb: 40, fat: 8, fiber: 4 },
      isFirstCheckIn: false,
    });
    $user.set({ id: 1, username: 'k', displayName: 'k' });
    $profile.set(profileWith(2));
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

  it('Continue navigates to /home when eat_times is already set', () => {
    // Post 2026-05-19 pivot: 挑戰難度 picker is gone; the only post-check-in
    // setup left is meal times. With eat_times set, success bypasses /onboarding/eat-times.
    $profile.set(profileWith(null, '{"breakfast":"08:00"}'));
    const el = success();
    el.querySelector<HTMLButtonElement>('#next')?.click();
    expect(mockedRouter.navigate).toHaveBeenCalledWith('/home');
  });

  it('Continue routes through eat-times when eat_times is null (first check-in)', () => {
    $profile.set(profileWith(null, null));
    const el = success();
    el.querySelector<HTMLButtonElement>('#next')?.click();
    expect(mockedRouter.navigate).toHaveBeenCalledWith('/onboarding/eat-times');
  });

  describe('first-check-in AHA', () => {
    it('omits the banner + uses the regular title by default', () => {
      const el = success();
      expect(el.querySelector('#first-banner')).toBeNull();
      expect(el.querySelector('.success-title')?.textContent).toBe('打卡成功！');
      expect(el.querySelector('.xp-bubble.xp-first')).toBeNull();
    });

    it('renders banner + welcome title + first-time bubble when isFirstCheckIn', () => {
      const prev = $checkin.get().lastResult!;
      setLastResult({ ...prev, isFirstCheckIn: true });
      const el = success();
      expect(el.querySelector('#first-banner')).not.toBeNull();
      expect(el.querySelector('.success-title')?.textContent).toBe('歡迎踏出第一步！');
      expect(el.querySelector('.xp-bubble.xp-first')?.textContent).toContain('首次打卡');
    });
  });

  describe('modify-content sheet', () => {
    it('opens when 修改內容 is clicked, populated from lastResult.items', () => {
      const el = success();
      const sheet = el.querySelector<HTMLElement>('#edit-sheet')!;
      expect(sheet.hidden).toBe(true);
      el.querySelector<HTMLButtonElement>('#edit-items')?.click();
      expect(sheet.hidden).toBe(false);
      expect(el.querySelectorAll('.edit-row').length).toBe(1);
      expect(el.querySelector<HTMLInputElement>('.edit-row-name')?.value).toBe('青菜');
    });

    it('+新增食材 appends a blank row to the editor list', () => {
      const el = success();
      el.querySelector<HTMLButtonElement>('#edit-items')?.click();
      el.querySelector<HTMLButtonElement>('#edit-sheet-add')?.click();
      expect(el.querySelectorAll('.edit-row').length).toBe(2);
    });

    it('儲存 calls updateCheckInItems, patches lastResult, and closes the sheet', async () => {
      const el = success();
      el.querySelector<HTMLButtonElement>('#edit-items')?.click();
      const nameInput = el.querySelector<HTMLInputElement>('.edit-row-name')!;
      nameInput.value = '空心菜';
      nameInput.dispatchEvent(new Event('input'));
      vi.useRealTimers();
      el.querySelector<HTMLButtonElement>('#edit-sheet-save')?.click();
      await vi.waitFor(() => expect(mockedCheckIns.updateCheckInItems).toHaveBeenCalled());
      const [id, items] = mockedCheckIns.updateCheckInItems.mock.calls[0];
      expect(id).toBe(99);
      expect(items[0].name).toBe('空心菜');
      expect($checkin.get().lastResult?.items[0].name).toBe('空心菜');
      expect(el.querySelector<HTMLElement>('#edit-sheet')?.hidden).toBe(true);
    });

    it('取消 closes without writing', () => {
      const el = success();
      el.querySelector<HTMLButtonElement>('#edit-items')?.click();
      el.querySelector<HTMLButtonElement>('#edit-sheet-cancel')?.click();
      expect(mockedCheckIns.updateCheckInItems).not.toHaveBeenCalled();
      expect(el.querySelector<HTMLElement>('#edit-sheet')?.hidden).toBe(true);
    });
  });

  it('nutrition details start collapsed and open when toggled', () => {
    const el = success();
    const details = el.querySelector<HTMLElement>('#nutrition-details')!;
    const toggle = el.querySelector<HTMLButtonElement>('#nutrition-toggle')!;
    expect(details.classList.contains('is-open')).toBe(false);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    toggle.click();
    expect(details.classList.contains('is-open')).toBe(true);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    // Nutrition grid is in the DOM either way (CSS animates the reveal).
    expect(el.querySelector('.nutrition-grid')).not.toBeNull();
    expect(el.textContent).toContain('320 kcal');
    expect(el.textContent).toContain('12 g');
  });
});
