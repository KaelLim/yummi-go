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
      id: 7, username: 'k', display_name: 'k', is_guest: 0,
      oath_signed_at: null, challenge_started_at: null,
      diet_type: 'vegan', challenge_level: null,
      eat_times: null, known_from: null, baseline: null, purpose: 'environment',
      level: 1, current_xp: 0, accumulated_xp: 0, stage: 'egg', mood: 'normal',
      strikes: 0, poisoned_until: null,
      gems: 0, total_earned: 0, card_count: 0, fragment_count: 0,
    });
  });

  it('renders the fog overlay, egg, and CTA at step 4 of 5', () => {
    const el = day1Hook();
    expect(el.classList.contains('day1')).toBe(true);
    expect(el.querySelector('.fog-overlay')).not.toBeNull();
    expect(el.querySelector('.day1-egg')).not.toBeNull();
    expect(el.querySelector('#enter-btn')).not.toBeNull();
    expect(el.querySelectorAll('.onb-progress-dot').length).toBe(5);
    expect(el.querySelectorAll('.onb-progress-dot.done').length).toBe(4);
  });

  it('CTA navigates to /onboarding/pet-name', () => {
    const el = day1Hook();
    (el.querySelector('#enter-btn') as HTMLButtonElement).click();
    expect(mockedRouter.navigate).toHaveBeenCalledWith('/onboarding/pet-name');
  });

  it('back button navigates to /onboarding/purpose', () => {
    const el = day1Hook();
    (el.querySelector('#back-btn') as HTMLElement).click();
    expect(mockedRouter.navigate).toHaveBeenCalledWith('/onboarding/purpose');
  });

  it('shows diet-typed egg + purpose line from profile (no level rule yet)', () => {
    const el = day1Hook();
    expect(el.querySelector('.day1-egg')?.getAttribute('data-tint')).toBe('vegan');
    expect(el.textContent).toContain('每替代一公斤肉');
    // Challenge level isn't picked yet at this point — no rule line.
    expect(el.textContent).not.toContain('容錯');
    expect(el.textContent).not.toContain('每天 1 餐無肉');
  });

  it('reads diet/purpose from the draft when profile is null (first-time flow)', () => {
    $profile.set(null);
    $onboardingDraft.set({
      ...emptyDraft(),
      diet_type: 'vegan',
      purpose: 'body',
    });
    const el = day1Hook();
    expect(el.querySelector('.day1-egg')?.getAttribute('data-tint')).toBe('vegan');
    expect(el.textContent).toContain('為了照顧自己的身體');
  });

  it('falls back to neutral tint when both profile and draft are empty', () => {
    $profile.set(null);
    const el = day1Hook();
    expect(el.querySelector('.day1-egg')?.getAttribute('data-tint')).toBe('neutral');
  });
});
