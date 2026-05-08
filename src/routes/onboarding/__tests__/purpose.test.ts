import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/router', () => ({ navigate: vi.fn() }));
vi.mock('@/api/profile', () => ({
  updateProfile: vi.fn().mockResolvedValue(undefined),
}));

import purpose from '../purpose';
import * as router from '@/router';
import * as profileApi from '@/api/profile';
import { $user } from '@/store/user';

const mockedRouter = router as unknown as { navigate: ReturnType<typeof vi.fn> };
const mockedProfile = profileApi as unknown as {
  updateProfile: ReturnType<typeof vi.fn>;
};

describe('onboarding/purpose', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    $user.set({ id: 7, username: 'k', displayName: 'k' });
  });

  it('renders 3 purpose options + Skip', () => {
    const el = purpose();
    expect(el.querySelectorAll('.choice').length).toBe(3);
    expect(el.querySelector('#skip-btn')).not.toBeNull();
  });

  it('shows progress 4/8', () => {
    const el = purpose();
    expect(el.querySelectorAll('.onb-progress-dot').length).toBe(8);
    expect(el.querySelectorAll('.onb-progress-dot.done').length).toBe(4);
  });

  it('clicking a purpose updates profile and advances to /onboarding/challenge-level', async () => {
    const el = purpose();
    const btn = el.querySelector<HTMLButtonElement>('.choice[data-value="environment"]');
    btn?.click();
    await Promise.resolve();
    expect(mockedProfile.updateProfile).toHaveBeenCalledWith(7, { purpose: 'environment' });
    await Promise.resolve();
    expect(mockedRouter.navigate).toHaveBeenCalledWith('/onboarding/challenge-level');
  });

  it('Skip advances without writing profile', () => {
    const el = purpose();
    el.querySelector<HTMLButtonElement>('#skip-btn')?.click();
    expect(mockedProfile.updateProfile).not.toHaveBeenCalled();
    expect(mockedRouter.navigate).toHaveBeenCalledWith('/onboarding/challenge-level');
  });
});
