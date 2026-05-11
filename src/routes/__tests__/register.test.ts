import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/api/auth', () => ({
  register: vi.fn(),
}));

vi.mock('@/store/user', () => ({
  setLoggedInUser: vi.fn(),
}));

vi.mock('@/store/onboarding-draft', async () => {
  const { atom } = await import('nanostores');
  return {
    $onboardingDraft: atom({
      diet_type: null,
      baseline: null,
      purpose: null,
      challenge_level: null,
      eat_times: null,
      known_from: null,
      pet_name: null,
    }),
    flushDraftToDrust: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock('@/router', () => ({
  navigate: vi.fn(),
}));

import register from '../register';
import * as authApi from '@/api/auth';
import * as userStore from '@/store/user';
import * as draftStore from '@/store/onboarding-draft';
import * as router from '@/router';
import { atom } from 'nanostores';

const mockedAuth = authApi as unknown as { register: ReturnType<typeof vi.fn> };
const mockedUser = userStore as unknown as {
  setLoggedInUser: ReturnType<typeof vi.fn>;
};
const mockedDraft = draftStore as unknown as {
  $onboardingDraft: ReturnType<typeof atom<{
    diet_type: string | null;
    baseline: string | null;
    purpose: string | null;
    challenge_level: number | null;
    eat_times: string | null;
    known_from: string | null;
    pet_name: string | null;
  }>>;
  flushDraftToDrust: ReturnType<typeof vi.fn>;
};
const mockedRouter = router as unknown as { navigate: ReturnType<typeof vi.fn> };

function flush() {
  return new Promise((r) => setTimeout(r, 0));
}

function resetDraft() {
  mockedDraft.$onboardingDraft.set({
    diet_type: null,
    baseline: null,
    purpose: null,
    challenge_level: null,
    eat_times: null,
    known_from: null,
    pet_name: null,
  });
}

describe('register route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetDraft();
  });

  it('renders an HTMLElement with class auth-screen and required inputs', () => {
    const el = register();
    expect(el).toBeInstanceOf(HTMLElement);
    expect(el.classList.contains('auth-screen')).toBe(true);
    expect(el.querySelector('input[name="username"]')).not.toBeNull();
    expect(el.querySelector('input[name="password"]')).not.toBeNull();
    // display_name is no longer collected here; it comes from the pet-name step.
    expect(el.querySelector('input[name="display_name"]')).toBeNull();
  });

  it('shows the pet name from the draft in the subtitle when present', () => {
    mockedDraft.$onboardingDraft.set({
      ...mockedDraft.$onboardingDraft.get(),
      pet_name: '小綠',
    });
    const el = register();
    const sub = el.querySelector('.auth-sub') as HTMLElement;
    expect(sub.textContent).toContain('小綠');
  });

  it('back button navigates to /onboarding/pet-name', () => {
    const el = register();
    (el.querySelector('#back-btn') as HTMLElement).click();
    expect(mockedRouter.navigate).toHaveBeenCalledWith('/onboarding/pet-name');
  });

  it('blocks submit when fields are empty', async () => {
    const el = register();
    document.body.appendChild(el);
    const form = el.querySelector('#reg-form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    await flush();
    expect(mockedAuth.register).not.toHaveBeenCalled();
    document.body.removeChild(el);
  });

  it('on success, registers with pet name from draft, flushes draft, and navigates to /check-in', async () => {
    mockedDraft.$onboardingDraft.set({
      ...mockedDraft.$onboardingDraft.get(),
      pet_name: 'Greenie',
    });
    mockedAuth.register.mockResolvedValueOnce({
      id: 9,
      username: 'newbie',
      displayName: 'Greenie',
    });
    const el = register();
    document.body.appendChild(el);
    (el.querySelector('input[name="username"]') as HTMLInputElement).value = 'newbie';
    (el.querySelector('input[name="password"]') as HTMLInputElement).value = 'sekret1';
    const form = el.querySelector('#reg-form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    await flush();
    await flush();
    expect(mockedAuth.register).toHaveBeenCalledWith('newbie', 'sekret1', 'Greenie');
    expect(mockedUser.setLoggedInUser).toHaveBeenCalled();
    expect(mockedDraft.flushDraftToDrust).toHaveBeenCalledWith(9);
    expect(mockedRouter.navigate).toHaveBeenCalledWith('/check-in');
    document.body.removeChild(el);
  });

  it('falls back to username for display_name when draft pet_name is missing', async () => {
    mockedAuth.register.mockResolvedValueOnce({
      id: 9,
      username: 'newbie',
      displayName: 'newbie',
    });
    const el = register();
    document.body.appendChild(el);
    (el.querySelector('input[name="username"]') as HTMLInputElement).value = 'newbie';
    (el.querySelector('input[name="password"]') as HTMLInputElement).value = 'sekret1';
    (el.querySelector('#reg-form') as HTMLFormElement).dispatchEvent(
      new Event('submit', { cancelable: true, bubbles: true }),
    );
    await flush();
    await flush();
    expect(mockedAuth.register).toHaveBeenCalledWith('newbie', 'sekret1', 'newbie');
    document.body.removeChild(el);
  });

  it('shows username-taken message on UNIQUE constraint failure', async () => {
    mockedAuth.register.mockRejectedValueOnce(
      new Error('UNIQUE constraint failed: users.username'),
    );
    const el = register();
    document.body.appendChild(el);
    (el.querySelector('input[name="username"]') as HTMLInputElement).value = 'taken';
    (el.querySelector('input[name="password"]') as HTMLInputElement).value = 'abcdef';
    const form = el.querySelector('#reg-form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    await flush();
    await flush();
    const err = el.querySelector('#reg-error') as HTMLDivElement;
    expect(err.hidden).toBe(false);
    expect(err.textContent).toContain('使用者名稱已被使用');
    expect(mockedRouter.navigate).not.toHaveBeenCalled();
    document.body.removeChild(el);
  });

  it('shows generic message on non-UNIQUE failure', async () => {
    mockedAuth.register.mockRejectedValueOnce(new Error('network down'));
    const el = register();
    document.body.appendChild(el);
    (el.querySelector('input[name="username"]') as HTMLInputElement).value = 'a';
    (el.querySelector('input[name="password"]') as HTMLInputElement).value = 'cdefgh';
    const form = el.querySelector('#reg-form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    await flush();
    await flush();
    const err = el.querySelector('#reg-error') as HTMLDivElement;
    expect(err.hidden).toBe(false);
    expect(err.textContent).toContain('註冊失敗');
    document.body.removeChild(el);
  });
});
