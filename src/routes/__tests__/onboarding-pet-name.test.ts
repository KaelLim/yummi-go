import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/router', () => ({ navigate: vi.fn() }));
vi.mock('@/api/content', () => ({
  // Default to a never-resolving fetch so the random pick doesn't race the
  // synchronous assertions. Individual tests can override.
  listPetNameSuggestions: vi.fn(() => new Promise(() => {})),
}));
vi.mock('@/api/profile', () => ({
  updateDisplayName: vi.fn(() => Promise.resolve()),
}));

import petName from '../onboarding/pet-name';
import * as router from '@/router';
import * as content from '@/api/content';
import * as profile from '@/api/profile';
import { $user } from '@/store/user';
import { $onboardingDraft } from '@/store/onboarding-draft';

const mockedRouter = router as unknown as { navigate: ReturnType<typeof vi.fn> };
const mockedContent = content as unknown as {
  listPetNameSuggestions: ReturnType<typeof vi.fn>;
};
const mockedProfile = profile as unknown as {
  updateDisplayName: ReturnType<typeof vi.fn>;
};

function flush() {
  return new Promise((r) => setTimeout(r, 0));
}

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

describe('onboarding/pet-name', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    $user.set(null);
    $onboardingDraft.set(emptyDraft());
    // `clearAllMocks` keeps queued `mockResolvedValueOnce` values from
    // prior tests — call `mockReset` to drop them and re-arm the never-
    // resolving default.
    mockedContent.listPetNameSuggestions.mockReset();
    mockedContent.listPetNameSuggestions.mockReturnValue(new Promise(() => {}));
  });

  it('renders 5/5 progress, input with default name, and continue button', () => {
    const el = petName();
    expect(el.querySelectorAll('.onb-progress-dot').length).toBe(5);
    expect(el.querySelectorAll('.onb-progress-dot.done').length).toBe(5);
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

  it('replaces the placeholder with a random suggestion once the fetch resolves', async () => {
    mockedContent.listPetNameSuggestions.mockResolvedValueOnce([
      { id: 1, name: '阿芽', sort_order: 1, active: 1 },
      { id: 2, name: '蛋蛋', sort_order: 2, active: 1 },
    ]);
    const el = petName();
    await flush();
    const input = el.querySelector('#pet-name-input') as HTMLInputElement;
    expect(['阿芽', '蛋蛋']).toContain(input.value);
  });

  it('does not overwrite the draft value when a returning user revisits the page', async () => {
    $onboardingDraft.set({ ...emptyDraft(), pet_name: '皮蛋' });
    mockedContent.listPetNameSuggestions.mockResolvedValueOnce([
      { id: 1, name: '阿芽', sort_order: 1, active: 1 },
    ]);
    const el = petName();
    await flush();
    const input = el.querySelector('#pet-name-input') as HTMLInputElement;
    expect(input.value).toBe('皮蛋');
    expect(mockedContent.listPetNameSuggestions).not.toHaveBeenCalled();
  });

  it('refresh button rolls a different name from the cached list', async () => {
    mockedContent.listPetNameSuggestions.mockResolvedValueOnce([
      { id: 1, name: '阿芽', sort_order: 1, active: 1 },
      { id: 2, name: '蛋蛋', sort_order: 2, active: 1 },
    ]);
    const el = petName();
    await flush();
    const input = el.querySelector('#pet-name-input') as HTMLInputElement;
    const refresh = el.querySelector('#pet-name-refresh') as HTMLButtonElement;
    const first = input.value;
    refresh.click();
    // With only 2 entries and avoid-current, refresh must flip to the other.
    expect(input.value).not.toBe(first);
    expect(['阿芽', '蛋蛋']).toContain(input.value);
    // Refresh should reuse the cached fetch, not fire another request.
    expect(mockedContent.listPetNameSuggestions).toHaveBeenCalledTimes(1);
  });

  it('refresh button triggers a fetch when the cache is empty', async () => {
    mockedContent.listPetNameSuggestions.mockResolvedValue([
      { id: 1, name: '阿芽', sort_order: 1, active: 1 },
    ]);
    $onboardingDraft.set({ ...emptyDraft(), pet_name: '皮蛋' });
    const el = petName();
    // Draft path didn't trigger a fetch on mount.
    expect(mockedContent.listPetNameSuggestions).not.toHaveBeenCalled();
    const refresh = el.querySelector('#pet-name-refresh') as HTMLButtonElement;
    refresh.click();
    await flush();
    expect(mockedContent.listPetNameSuggestions).toHaveBeenCalledTimes(1);
    const input = el.querySelector('#pet-name-input') as HTMLInputElement;
    expect(input.value).toBe('阿芽');
  });

  it('keeps 小綠 when the suggestions fetch returns an empty list', async () => {
    mockedContent.listPetNameSuggestions.mockResolvedValueOnce([]);
    const el = petName();
    await flush();
    const input = el.querySelector('#pet-name-input') as HTMLInputElement;
    expect(input.value).toBe('小綠');
  });

  it('on continue, guests stamp the draft and advance to /register (no $user)', () => {
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

  it('logged-in users persist the name, refresh $user, and advance to /onboarding/start-checkin', async () => {
    $user.set({ id: 1, username: 'k', displayName: 'Kai' });
    const el = petName();
    const input = el.querySelector('#pet-name-input') as HTMLInputElement;
    input.value = '阿綠';
    (el.querySelector('#continue-btn') as HTMLButtonElement).click();
    // Draft is always patched now (belt-and-suspenders for the defensive
    // /register fallback path).
    expect($onboardingDraft.get().pet_name).toBe('阿綠');
    // Display name is persisted to drust + reflected in the local session
    // immediately so PetView / TabBar pick up the new name.
    await flush();
    expect(mockedProfile.updateDisplayName).toHaveBeenCalledWith(1, '阿綠');
    expect($user.get()?.displayName).toBe('阿綠');
    expect(mockedRouter.navigate).toHaveBeenCalledWith('/onboarding/start-checkin');
  });

  it('back button returns to /onboarding/day1-hook', () => {
    const el = petName();
    (el.querySelector('#back-btn') as HTMLElement).click();
    expect(mockedRouter.navigate).toHaveBeenCalledWith('/onboarding/day1-hook');
  });
});
