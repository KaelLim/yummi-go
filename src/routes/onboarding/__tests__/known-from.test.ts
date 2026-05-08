import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/router', () => ({ navigate: vi.fn() }));
vi.mock('@/api/profile', () => ({
  updateProfile: vi.fn().mockResolvedValue(undefined),
}));

import knownFrom from '../known-from';
import * as router from '@/router';
import * as profileApi from '@/api/profile';
import { $user } from '@/store/user';

const mockedRouter = router as unknown as { navigate: ReturnType<typeof vi.fn> };
const mockedProfile = profileApi as unknown as {
  updateProfile: ReturnType<typeof vi.fn>;
};

describe('onboarding/known-from', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    $user.set({ id: 7, username: 'k', displayName: 'k' });
  });

  it('renders 4 source options + Skip', () => {
    const el = knownFrom();
    expect(el.querySelectorAll('.choice').length).toBe(4);
    expect(el.querySelector('#skip-btn')).not.toBeNull();
  });

  it('shows progress 7/8', () => {
    const el = knownFrom();
    expect(el.querySelectorAll('.onb-progress-dot.done').length).toBe(7);
  });

  it('clicking a source updates profile and advances to /onboarding/day1-hook', async () => {
    const el = knownFrom();
    el.querySelector<HTMLButtonElement>('.choice[data-value="instagram"]')?.click();
    await Promise.resolve();
    expect(mockedProfile.updateProfile).toHaveBeenCalledWith(7, { known_from: 'instagram' });
    expect(mockedRouter.navigate).toHaveBeenCalledWith('/onboarding/day1-hook');
  });

  it('Skip advances without writing profile', () => {
    const el = knownFrom();
    el.querySelector<HTMLButtonElement>('#skip-btn')?.click();
    expect(mockedProfile.updateProfile).not.toHaveBeenCalled();
    expect(mockedRouter.navigate).toHaveBeenCalledWith('/onboarding/day1-hook');
  });
});
