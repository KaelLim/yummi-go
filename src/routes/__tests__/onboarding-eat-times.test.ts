import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/api/profile', () => ({
  updateProfile: vi.fn(),
}));

vi.mock('@/store/user', () => ({
  $user: { get: vi.fn() },
}));

vi.mock('@/router', () => ({
  navigate: vi.fn(),
}));

import eatTimes from '../onboarding/eat-times';
import * as profileApi from '@/api/profile';
import * as userStore from '@/store/user';
import * as router from '@/router';

const mockedProfile = profileApi as unknown as { updateProfile: ReturnType<typeof vi.fn> };
const mockedUser = userStore as unknown as { $user: { get: ReturnType<typeof vi.fn> } };
const mockedRouter = router as unknown as { navigate: ReturnType<typeof vi.fn> };

function flush() {
  return new Promise((r) => setTimeout(r, 0));
}

describe('onboarding/eat-times', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUser.$user.get.mockReturnValue({ id: 3, username: 'a', displayName: 'A' });
  });

  it('renders 3 time inputs with defaults', () => {
    const el = eatTimes();
    const inputs = el.querySelectorAll<HTMLInputElement>('.meal-input');
    expect(inputs.length).toBe(3);
    const keys = Array.from(inputs).map(i => i.dataset.key);
    expect(keys).toEqual(['breakfast', 'lunch', 'dinner']);
    expect(inputs[0].value).toBe('08:00');
  });

  it('continue serializes eat_times JSON and advances', async () => {
    mockedProfile.updateProfile.mockResolvedValueOnce(undefined);
    const el = eatTimes();
    document.body.appendChild(el);
    const lunchInput = el.querySelector('.meal-input[data-key="lunch"]') as HTMLInputElement;
    lunchInput.value = '13:15';
    lunchInput.dispatchEvent(new Event('input'));
    (el.querySelector('#continue-btn') as HTMLButtonElement).click();
    await flush();
    expect(mockedProfile.updateProfile).toHaveBeenCalledTimes(1);
    const [userId, patch] = mockedProfile.updateProfile.mock.calls[0];
    expect(userId).toBe(3);
    const parsed = JSON.parse(patch.eat_times);
    expect(parsed.lunch).toBe('13:15');
    expect(parsed.breakfast).toBe('08:00');
    expect(mockedRouter.navigate).toHaveBeenCalledWith('/home');
    document.body.removeChild(el);
  });

  it('back button navigates to /onboarding/pet-name', () => {
    const el = eatTimes();
    (el.querySelector('#back-btn') as HTMLElement).click();
    expect(mockedRouter.navigate).toHaveBeenCalledWith('/onboarding/pet-name');
  });

  it('guest continue stamps the draft and advances to /register', async () => {
    mockedUser.$user.get.mockReturnValue(null);
    const { $onboardingDraft } = await import('@/store/onboarding-draft');
    $onboardingDraft.set({
      diet_type: null, baseline: null, purpose: null, challenge_level: null,
      eat_times: null, known_from: null, pet_name: null,
    });
    const el = eatTimes();
    document.body.appendChild(el);
    (el.querySelector('#continue-btn') as HTMLButtonElement).click();
    await flush();
    expect(mockedProfile.updateProfile).not.toHaveBeenCalled();
    expect($onboardingDraft.get().eat_times).toContain('breakfast');
    expect(mockedRouter.navigate).toHaveBeenCalledWith('/register');
    document.body.removeChild(el);
  });

  it('clicking ✕ removes a meal row and excludes it from the JSON', async () => {
    mockedProfile.updateProfile.mockResolvedValueOnce(undefined);
    const el = eatTimes();
    document.body.appendChild(el);

    // Remove breakfast
    const breakfastRemove = el.querySelector(
      '.meal-remove[data-key="breakfast"]',
    ) as HTMLButtonElement;
    expect(breakfastRemove).not.toBeNull();
    breakfastRemove.click();

    // Row is now in disabled state — has + button, no time input
    const breakfastRow = el.querySelector('.meal-row[data-key="breakfast"]')!;
    expect(breakfastRow.classList.contains('meal-row-off')).toBe(true);
    expect(breakfastRow.querySelector('.meal-input')).toBeNull();
    expect(
      breakfastRow.querySelector('button[data-action="enable"]'),
    ).not.toBeNull();

    (el.querySelector('#continue-btn') as HTMLButtonElement).click();
    await flush();
    const [, patch] = mockedProfile.updateProfile.mock.calls[0];
    const parsed = JSON.parse(patch.eat_times);
    expect(parsed).not.toHaveProperty('breakfast');
    expect(parsed.lunch).toBe('12:30');
    expect(parsed.dinner).toBe('19:00');
    document.body.removeChild(el);
  });

  it('clicking + restores a removed meal with its previous time', () => {
    const el = eatTimes();
    document.body.appendChild(el);

    // Change breakfast time first, then remove, then re-add — time should be preserved.
    const breakfastInput = el.querySelector(
      '.meal-input[data-key="breakfast"]',
    ) as HTMLInputElement;
    breakfastInput.value = '07:30';
    breakfastInput.dispatchEvent(new Event('input'));

    (
      el.querySelector('.meal-remove[data-key="breakfast"]') as HTMLButtonElement
    ).click();
    (
      el.querySelector(
        'button[data-action="enable"][data-key="breakfast"]',
      ) as HTMLButtonElement
    ).click();

    const restored = el.querySelector(
      '.meal-input[data-key="breakfast"]',
    ) as HTMLInputElement;
    expect(restored).not.toBeNull();
    expect(restored.value).toBe('07:30');
    document.body.removeChild(el);
  });

  it('hides the ✕ on the last remaining active meal so users cannot disable all 3', () => {
    const el = eatTimes();
    document.body.appendChild(el);

    // Remove breakfast then lunch — dinner is now the only active row.
    (
      el.querySelector('.meal-remove[data-key="breakfast"]') as HTMLButtonElement
    ).click();
    (
      el.querySelector('.meal-remove[data-key="lunch"]') as HTMLButtonElement
    ).click();

    expect(
      el.querySelector('.meal-remove[data-key="dinner"]'),
    ).toBeNull();
    // The other two still expose + to bring them back.
    expect(
      el.querySelectorAll('button[data-action="enable"]').length,
    ).toBe(2);
    document.body.removeChild(el);
  });
});
