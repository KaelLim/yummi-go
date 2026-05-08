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

import baseline from '../onboarding/baseline';
import * as profileApi from '@/api/profile';
import * as userStore from '@/store/user';
import * as router from '@/router';

const mockedProfile = profileApi as unknown as { updateProfile: ReturnType<typeof vi.fn> };
const mockedUser = userStore as unknown as { $user: { get: ReturnType<typeof vi.fn> } };
const mockedRouter = router as unknown as { navigate: ReturnType<typeof vi.fn> };

function flush() {
  return new Promise((r) => setTimeout(r, 0));
}

describe('onboarding/baseline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUser.$user.get.mockReturnValue({ id: 5, username: 'a', displayName: 'A' });
  });

  it('renders 4 sliders with default values', () => {
    const el = baseline();
    expect(el.querySelectorAll('.baseline-slider').length).toBe(4);
    expect(el.querySelectorAll('.baseline-row').length).toBe(4);
  });

  it('updating slider updates the displayed % and total', () => {
    const el = baseline();
    document.body.appendChild(el);
    const beefSlider = el.querySelector('.baseline-slider[data-key="beef"]') as HTMLInputElement;
    beefSlider.value = '40';
    beefSlider.dispatchEvent(new Event('input'));
    const beefRow = el.querySelector('.baseline-row[data-key="beef"]')!;
    expect(beefRow.querySelector('.baseline-value')!.textContent).toBe('40%');
    document.body.removeChild(el);
  });

  it('continue button writes baseline JSON and advances', async () => {
    mockedProfile.updateProfile.mockResolvedValueOnce(undefined);
    const el = baseline();
    (el.querySelector('#continue-btn') as HTMLButtonElement).click();
    await flush();
    expect(mockedProfile.updateProfile).toHaveBeenCalledTimes(1);
    const [userId, patch] = mockedProfile.updateProfile.mock.calls[0];
    expect(userId).toBe(5);
    expect(typeof patch.baseline).toBe('string');
    const parsed = JSON.parse(patch.baseline);
    expect(parsed).toHaveProperty('beef');
    expect(parsed).toHaveProperty('chicken');
    expect(mockedRouter.navigate).toHaveBeenCalledWith('/onboarding/purpose');
  });

  it('back button navigates to diet-survey', () => {
    const el = baseline();
    (el.querySelector('#back-btn') as HTMLElement).click();
    expect(mockedRouter.navigate).toHaveBeenCalledWith('/onboarding/diet-survey');
  });
});
