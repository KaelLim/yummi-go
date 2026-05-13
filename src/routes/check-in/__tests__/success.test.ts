import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/router', () => ({ navigate: vi.fn() }));

import success from '../success';
import * as router from '@/router';
import { setLastResult, setMealIndex } from '@/store/checkin';
import { $today } from '@/store/today';
import { $profile, $user } from '@/store/user';
import type { UserFull } from '@/api/profile';

const mockedRouter = router as unknown as { navigate: ReturnType<typeof vi.fn> };

function profileWith(level: number | null): UserFull {
  return {
    id: 1, username: 'k', display_name: 'k', is_guest: 0,
    oath_signed_at: null, challenge_started_at: null,
    diet_type: 'omnivore', challenge_level: level,
    eat_times: null, known_from: null, baseline: null, purpose: 'body',
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
      xpEarned: 20,
      luckyColorMatched: false,
      fogReductionPct: 3,
      xpFedToPet: 20,
      gemsFromXp: 0,
      nutrition: { cal: 320, protein: 12, carb: 40, fat: 8, fiber: 4 },
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

  it('Continue navigates to /home when challenge_level is already picked', () => {
    const el = success();
    el.querySelector<HTMLButtonElement>('#next')?.click();
    expect(mockedRouter.navigate).toHaveBeenCalledWith('/home');
  });

  it('Continue routes through challenge-level picker when challenge_level is null (first check-in)', () => {
    $profile.set(profileWith(null));
    const el = success();
    el.querySelector<HTMLButtonElement>('#next')?.click();
    expect(mockedRouter.navigate).toHaveBeenCalledWith('/onboarding/challenge-level');
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
