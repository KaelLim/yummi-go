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

import dietSurvey from '../onboarding/diet-survey';
import * as profileApi from '@/api/profile';
import * as userStore from '@/store/user';
import * as router from '@/router';

const mockedProfile = profileApi as unknown as { updateProfile: ReturnType<typeof vi.fn> };
const mockedUser = userStore as unknown as { $user: { get: ReturnType<typeof vi.fn> } };
const mockedRouter = router as unknown as { navigate: ReturnType<typeof vi.fn> };

function flush() {
  return new Promise((r) => setTimeout(r, 0));
}

describe('onboarding/diet-survey', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUser.$user.get.mockReturnValue({ id: 9, username: 'a', displayName: 'A' });
  });

  it('renders 4 diet choices', () => {
    const el = dietSurvey();
    expect(el.classList.contains('onb-screen')).toBe(true);
    expect(el.querySelectorAll('.choice').length).toBe(4);
  });

  it('back button navigates to oath', () => {
    const el = dietSurvey();
    (el.querySelector('#back-btn') as HTMLElement).click();
    expect(mockedRouter.navigate).toHaveBeenCalledWith('/onboarding/oath');
  });

  it('skip button navigates to baseline without writing profile', () => {
    const el = dietSurvey();
    (el.querySelector('#skip-btn') as HTMLElement).click();
    expect(mockedRouter.navigate).toHaveBeenCalledWith('/onboarding/baseline');
    expect(mockedProfile.updateProfile).not.toHaveBeenCalled();
  });

  it('clicking a choice writes diet_type and advances', async () => {
    mockedProfile.updateProfile.mockResolvedValueOnce(undefined);
    const el = dietSurvey();
    const choice = el.querySelector('.choice[data-value="vegan"]') as HTMLButtonElement;
    choice.click();
    await flush();
    expect(mockedProfile.updateProfile).toHaveBeenCalledWith(9, { diet_type: 'vegan' });
    expect(mockedRouter.navigate).toHaveBeenCalledWith('/onboarding/baseline');
  });

  it('soft-fails on update error and still advances', async () => {
    mockedProfile.updateProfile.mockRejectedValueOnce(new Error('net'));
    const el = dietSurvey();
    const choice = el.querySelector('.choice[data-value="omnivore"]') as HTMLButtonElement;
    choice.click();
    await flush();
    await flush();
    expect(mockedRouter.navigate).toHaveBeenCalledWith('/onboarding/baseline');
  });
});
