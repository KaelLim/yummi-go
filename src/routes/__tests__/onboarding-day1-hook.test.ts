import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/router', () => ({
  navigate: vi.fn(),
}));

vi.mock('@/api/profile', () => ({
  setChallengeStartedAt: vi.fn().mockResolvedValue(undefined),
}));

import day1Hook from '../onboarding/day1-hook';
import * as router from '@/router';
import * as profileApi from '@/api/profile';
import { $user } from '@/store/user';

const mockedRouter = router as unknown as { navigate: ReturnType<typeof vi.fn> };
const mockedProfile = profileApi as unknown as {
  setChallengeStartedAt: ReturnType<typeof vi.fn>;
};

describe('onboarding/day1-hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    $user.set({ id: 7, username: 'k', displayName: 'k' });
  });

  it('renders the fog overlay, egg, and CTA', () => {
    const el = day1Hook();
    expect(el.classList.contains('day1')).toBe(true);
    expect(el.querySelector('.fog-overlay')).not.toBeNull();
    expect(el.querySelector('.day1-egg')).not.toBeNull();
    expect(el.querySelector('#enter-btn')).not.toBeNull();
    expect(el.querySelectorAll('.onb-progress-dot.done').length).toBe(8);
  });

  it('CTA stamps challenge_started_at via drust then navigates to /check-in', async () => {
    const el = day1Hook();
    (el.querySelector('#enter-btn') as HTMLButtonElement).click();
    expect(mockedRouter.navigate).toHaveBeenCalledWith('/check-in');
    // drust write fires-and-forgets — wait a microtask for promise chain
    await Promise.resolve();
    expect(mockedProfile.setChallengeStartedAt).toHaveBeenCalledWith(
      7,
      expect.any(String),
    );
    const [, iso] = mockedProfile.setChallengeStartedAt.mock.calls[0];
    expect(Number.isFinite(Date.parse(iso))).toBe(true);
  });

  it('CTA still navigates when no user is logged in (no-op drust write)', () => {
    $user.set(null);
    const el = day1Hook();
    (el.querySelector('#enter-btn') as HTMLButtonElement).click();
    expect(mockedRouter.navigate).toHaveBeenCalledWith('/check-in');
    expect(mockedProfile.setChallengeStartedAt).not.toHaveBeenCalled();
  });
});
