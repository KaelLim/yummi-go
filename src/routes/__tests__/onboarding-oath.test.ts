import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/api/profile', () => ({
  signOath: vi.fn(),
}));

vi.mock('@/store/user', () => ({
  $user: { get: vi.fn() },
}));

vi.mock('@/store/onboarding-draft', () => ({
  patchDraft: vi.fn(),
}));

vi.mock('@/router', () => ({
  navigate: vi.fn(),
}));

import oath from '../onboarding/oath';
import * as profileApi from '@/api/profile';
import * as userStore from '@/store/user';
import * as draftStore from '@/store/onboarding-draft';
import * as router from '@/router';

const mockedProfile = profileApi as unknown as { signOath: ReturnType<typeof vi.fn> };
const mockedUser = userStore as unknown as { $user: { get: ReturnType<typeof vi.fn> } };
const mockedDraft = draftStore as unknown as { patchDraft: ReturnType<typeof vi.fn> };
const mockedRouter = router as unknown as { navigate: ReturnType<typeof vi.fn> };

function flush() {
  return new Promise((r) => setTimeout(r, 0));
}

describe('onboarding/oath', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUser.$user.get.mockReturnValue({ id: 7, username: 'a', displayName: 'A' });
  });

  it('renders progress dots, oath card, checkbox, and disabled continue button', () => {
    const el = oath();
    expect(el.classList.contains('onb-screen')).toBe(true);
    expect(el.querySelectorAll('.onb-progress-dot').length).toBe(9);
    expect(el.querySelectorAll('.onb-progress-dot.done').length).toBe(1);
    expect(el.querySelector('#oath-cb')).not.toBeNull();
    const btn = el.querySelector('#continue-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('enables continue when checkbox toggles', () => {
    const el = oath();
    const cb = el.querySelector('#oath-cb') as HTMLInputElement;
    const btn = el.querySelector('#continue-btn') as HTMLButtonElement;
    cb.checked = true;
    cb.dispatchEvent(new Event('change'));
    expect(btn.disabled).toBe(false);
  });

  it('on continue with logged-in user, signs oath in drust and navigates to diet-survey', async () => {
    mockedProfile.signOath.mockResolvedValueOnce(undefined);
    const el = oath();
    const cb = el.querySelector('#oath-cb') as HTMLInputElement;
    const btn = el.querySelector('#continue-btn') as HTMLButtonElement;
    cb.checked = true;
    cb.dispatchEvent(new Event('change'));
    btn.click();
    await flush();
    expect(mockedProfile.signOath).toHaveBeenCalledWith(7);
    expect(mockedDraft.patchDraft).not.toHaveBeenCalled();
    expect(mockedRouter.navigate).toHaveBeenCalledWith('/onboarding/diet-survey');
  });

  it('without a user, stamps the draft and navigates to diet-survey', async () => {
    mockedUser.$user.get.mockReturnValueOnce(null);
    const el = oath();
    const btn = el.querySelector('#continue-btn') as HTMLButtonElement;
    btn.disabled = false; // simulate user-checked precondition
    btn.click();
    await flush();
    expect(mockedDraft.patchDraft).toHaveBeenCalledWith({ oath_signed: true });
    expect(mockedProfile.signOath).not.toHaveBeenCalled();
    expect(mockedRouter.navigate).toHaveBeenCalledWith('/onboarding/diet-survey');
  });

  it('has a link to /login for returning users', () => {
    const el = oath();
    const loginLink = el.querySelector('a[href="#/login"]');
    expect(loginLink).not.toBeNull();
  });
});
