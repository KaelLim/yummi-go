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

import challengeLevel from '../onboarding/challenge-level';
import * as profileApi from '@/api/profile';
import * as userStore from '@/store/user';
import * as router from '@/router';

const mockedProfile = profileApi as unknown as { updateProfile: ReturnType<typeof vi.fn> };
const mockedUser = userStore as unknown as { $user: { get: ReturnType<typeof vi.fn> } };
const mockedRouter = router as unknown as { navigate: ReturnType<typeof vi.fn> };

function flush() {
  return new Promise((r) => setTimeout(r, 0));
}

describe('onboarding/challenge-level', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUser.$user.get.mockReturnValue({ id: 11, username: 'a', displayName: 'A' });
  });

  it('renders 3 level choices', () => {
    const el = challengeLevel();
    expect(el.querySelectorAll('.level-choice').length).toBe(3);
  });

  it('clicking a level writes challenge_level number and advances', async () => {
    mockedProfile.updateProfile.mockResolvedValueOnce(undefined);
    const el = challengeLevel();
    const lvl2 = el.querySelector('.level-choice[data-value="2"]') as HTMLButtonElement;
    lvl2.click();
    await flush();
    expect(mockedProfile.updateProfile).toHaveBeenCalledWith(11, { challenge_level: 2 });
    expect(mockedRouter.navigate).toHaveBeenCalledWith('/onboarding/eat-times');
  });

  it('back button navigates to baseline', () => {
    const el = challengeLevel();
    (el.querySelector('#back-btn') as HTMLElement).click();
    expect(mockedRouter.navigate).toHaveBeenCalledWith('/onboarding/purpose');
  });
});
