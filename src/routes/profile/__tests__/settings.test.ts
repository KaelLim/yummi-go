import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/router', () => ({ navigate: vi.fn() }));
vi.mock('@/api/profile', () => ({
  updateProfile: vi.fn().mockResolvedValue(undefined),
  getUserFull: vi.fn().mockResolvedValue(null),
}));

import settings from '../settings';
import { $user, $profile } from '@/store/user';
import * as router from '@/router';
import * as profileApi from '@/api/profile';

const mockedRouter = router as unknown as { navigate: ReturnType<typeof vi.fn> };
const mockedUpdateProfile = profileApi.updateProfile as unknown as ReturnType<typeof vi.fn>;

describe('settings route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    $user.set({ id: 7, username: 'kael', displayName: '阿凱' });
    $profile.set(null);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('saves eat_times via the meal-times section', async () => {
    const el = settings();
    document.body.appendChild(el);
    el.querySelector<HTMLButtonElement>('#save')?.click();
    await vi.waitFor(() => expect(mockedUpdateProfile).toHaveBeenCalled());
    const [userId, patch] = mockedUpdateProfile.mock.calls[0];
    expect(userId).toBe(7);
    expect(typeof patch.eat_times).toBe('string');
    el.remove();
  });

  it('logout clears session and navigates to splash', () => {
    const el = settings();
    el.querySelector<HTMLButtonElement>('#logout')?.click();
    expect(mockedRouter.navigate).toHaveBeenCalledWith('/');
  });
});
