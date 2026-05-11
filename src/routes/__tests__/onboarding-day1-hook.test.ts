import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/router', () => ({
  navigate: vi.fn(),
}));

import day1Hook from '../onboarding/day1-hook';
import * as router from '@/router';
import { $profile } from '@/store/user';
import { $onboardingDraft } from '@/store/onboarding-draft';

const mockedRouter = router as unknown as { navigate: ReturnType<typeof vi.fn> };

function emptyDraft() {
  return {
    oath_signed: false,
    diet_type: null,
    baseline: null,
    purpose: null,
    challenge_level: null,
    eat_times: null,
    known_from: null,
    pet_name: null,
  };
}

describe('onboarding/day1-hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    $onboardingDraft.set(emptyDraft());
    $profile.set({
      id: 7, username: 'k', display_name: 'k',
      oath_signed_at: null, challenge_started_at: null,
      diet_type: 'vegan', challenge_level: 2,
      eat_times: null, known_from: null, baseline: null, purpose: 'environment',
      level: 1, current_xp: 0, accumulated_xp: 0, stage: 'egg', mood: 'normal',
      strikes: 0, poisoned_until: null,
      gems: 0, total_earned: 0, card_count: 0, fragment_count: 0,
    });
  });

  it('renders the fog overlay, egg, and CTA at step 8 of 9', () => {
    const el = day1Hook();
    expect(el.classList.contains('day1')).toBe(true);
    expect(el.querySelector('.fog-overlay')).not.toBeNull();
    expect(el.querySelector('.day1-egg')).not.toBeNull();
    expect(el.querySelector('#enter-btn')).not.toBeNull();
    expect(el.querySelectorAll('.onb-progress-dot').length).toBe(9);
    expect(el.querySelectorAll('.onb-progress-dot.done').length).toBe(8);
  });

  it('CTA navigates to /onboarding/pet-name', () => {
    const el = day1Hook();
    (el.querySelector('#enter-btn') as HTMLButtonElement).click();
    expect(mockedRouter.navigate).toHaveBeenCalledWith('/onboarding/pet-name');
  });

  it('shows diet-typed egg + level rule + purpose line from profile', () => {
    const el = day1Hook();
    expect(el.querySelector('.day1-egg')?.getAttribute('data-tint')).toBe('vegan');
    expect(el.textContent).toContain('三餐無肉，3 次容錯');
    expect(el.textContent).toContain('每替代一公斤肉');
  });

  it('reads from the draft when profile is null (first-time flow)', () => {
    $profile.set(null);
    $onboardingDraft.set({
      ...emptyDraft(),
      diet_type: 'vegan',
      challenge_level: 1,
      purpose: 'body',
    });
    const el = day1Hook();
    expect(el.querySelector('.day1-egg')?.getAttribute('data-tint')).toBe('vegan');
    expect(el.textContent).toContain('每天 1 餐無肉');
    expect(el.textContent).toContain('為了照顧自己的身體');
  });

  it('falls back to neutral content when both profile and draft are empty', () => {
    $profile.set(null);
    const el = day1Hook();
    expect(el.querySelector('.day1-egg')?.getAttribute('data-tint')).toBe('neutral');
  });
});
