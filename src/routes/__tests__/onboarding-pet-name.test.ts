import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/router', () => ({ navigate: vi.fn() }));

import petName from '../onboarding/pet-name';
import * as router from '@/router';
import { $user } from '@/store/user';
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

describe('onboarding/pet-name', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    $user.set(null);
    $onboardingDraft.set(emptyDraft());
  });

  it('renders 9/9 progress, input with default name, and continue button', () => {
    const el = petName();
    expect(el.querySelectorAll('.onb-progress-dot').length).toBe(9);
    expect(el.querySelectorAll('.onb-progress-dot.done').length).toBe(9);
    const input = el.querySelector('#pet-name-input') as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.value).toBe('小綠');
    expect(el.querySelector('#continue-btn')).not.toBeNull();
  });

  it('seeds the input with the draft pet_name when one is already set', () => {
    $onboardingDraft.set({ ...emptyDraft(), pet_name: '皮蛋' });
    const el = petName();
    const input = el.querySelector('#pet-name-input') as HTMLInputElement;
    expect(input.value).toBe('皮蛋');
  });

  it('on continue, stamps the draft and navigates to /register', () => {
    const el = petName();
    const input = el.querySelector('#pet-name-input') as HTMLInputElement;
    input.value = '阿綠';
    (el.querySelector('#continue-btn') as HTMLButtonElement).click();
    expect($onboardingDraft.get().pet_name).toBe('阿綠');
    expect(mockedRouter.navigate).toHaveBeenCalledWith('/register');
  });

  it('shows an error and does not navigate when the name is blank', () => {
    const el = petName();
    const input = el.querySelector('#pet-name-input') as HTMLInputElement;
    input.value = '   ';
    (el.querySelector('#continue-btn') as HTMLButtonElement).click();
    const err = el.querySelector('#pet-name-error') as HTMLElement;
    expect(err.hidden).toBe(false);
    expect(mockedRouter.navigate).not.toHaveBeenCalled();
  });

  it('sends a logged-in user straight to /home (they already have a display_name)', () => {
    $user.set({ id: 1, username: 'k', displayName: 'Kai' });
    const el = petName();
    (el.querySelector('#continue-btn') as HTMLButtonElement).click();
    expect(mockedRouter.navigate).toHaveBeenCalledWith('/home');
  });

  it('back button returns to /onboarding/day1-hook', () => {
    const el = petName();
    (el.querySelector('#back-btn') as HTMLElement).click();
    expect(mockedRouter.navigate).toHaveBeenCalledWith('/onboarding/day1-hook');
  });
});
