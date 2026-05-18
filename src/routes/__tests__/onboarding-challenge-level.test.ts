import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/api/profile', () => ({
  updateProfile: vi.fn(),
  getUserFull: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/store/user', () => ({
  $user: { get: vi.fn() },
  $profile: { get: vi.fn(), set: vi.fn() },
}));

vi.mock('@/router', () => ({
  navigate: vi.fn(),
}));

import challengeLevel from '../onboarding/challenge-level';
import * as profileApi from '@/api/profile';
import * as userStore from '@/store/user';
import * as router from '@/router';

const mockedProfile = profileApi as unknown as {
  updateProfile: ReturnType<typeof vi.fn>;
  getUserFull: ReturnType<typeof vi.fn>;
};
const mockedUser = userStore as unknown as {
  $user: { get: ReturnType<typeof vi.fn> };
  $profile: { get: ReturnType<typeof vi.fn>; set: ReturnType<typeof vi.fn> };
};
const mockedRouter = router as unknown as { navigate: ReturnType<typeof vi.fn> };

function flush() {
  return new Promise((r) => setTimeout(r, 0));
}

describe('challenge-level (post-first-checkin picker)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUser.$user.get.mockReturnValue({ id: 11, username: 'a', displayName: 'A' });
  });

  it('renders 3 level choices and no onboarding progress dots', () => {
    const el = challengeLevel();
    expect(el.querySelectorAll('.level-choice').length).toBe(3);
    expect(el.querySelectorAll('.onb-progress-dot').length).toBe(0);
  });

  it('clicking a level writes challenge_level and chains to /onboarding/eat-times when eat_times is null', async () => {
    mockedUser.$profile.get.mockReturnValue({ eat_times: null });
    mockedProfile.updateProfile.mockResolvedValueOnce(undefined);
    const el = challengeLevel();
    const lvl2 = el.querySelector('.level-choice[data-value="2"]') as HTMLButtonElement;
    lvl2.click();
    await flush();
    expect(mockedProfile.updateProfile).toHaveBeenCalledWith(11, { challenge_level: 2 });
    expect(mockedRouter.navigate).toHaveBeenCalledWith('/onboarding/eat-times');
  });

  it('skips eat-times and goes straight to /home when eat_times is already set', async () => {
    mockedUser.$profile.get.mockReturnValue({ eat_times: '{"breakfast":"08:00"}' });
    mockedProfile.updateProfile.mockResolvedValueOnce(undefined);
    const el = challengeLevel();
    const lvl1 = el.querySelector('.level-choice[data-value="1"]') as HTMLButtonElement;
    lvl1.click();
    await flush();
    expect(mockedRouter.navigate).toHaveBeenCalledWith('/home');
  });

  it('back button navigates to /home (does not block the user)', () => {
    const el = challengeLevel();
    (el.querySelector('#back-btn') as HTMLElement).click();
    expect(mockedRouter.navigate).toHaveBeenCalledWith('/home');
  });

  it('level 3 routes through the unlock hype interstitial', async () => {
    mockedUser.$profile.get.mockReturnValue({ eat_times: null });
    mockedProfile.updateProfile.mockResolvedValueOnce(undefined);
    const el = challengeLevel();
    const lvl3 = el.querySelector('.level-choice[data-value="3"]') as HTMLButtonElement;
    lvl3.click();
    await flush();
    expect(mockedProfile.updateProfile).toHaveBeenCalledWith(11, { challenge_level: 3 });
    expect(mockedRouter.navigate).toHaveBeenCalledWith('/onboarding/level3-unlock');
  });
});
