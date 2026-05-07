import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/api/auth', () => ({
  currentUserId: vi.fn(),
  logout: vi.fn(),
}));

vi.mock('@/api/profile', () => ({
  getUserFull: vi.fn(),
}));

import * as authApi from '@/api/auth';
import * as profileApi from '@/api/profile';
import {
  $user,
  $profile,
  $isLoggedIn,
  bootstrapFromStorage,
  setLoggedInUser,
  clearUser,
} from '../user';

const mockedAuth = authApi as unknown as {
  currentUserId: ReturnType<typeof vi.fn>;
  logout: ReturnType<typeof vi.fn>;
};
const mockedProfile = profileApi as unknown as {
  getUserFull: ReturnType<typeof vi.fn>;
};

describe('user store', () => {
  beforeEach(() => {
    clearUser();
    vi.clearAllMocks();
  });

  it('starts with $user null and $isLoggedIn false', () => {
    expect($user.get()).toBeNull();
    expect($profile.get()).toBeNull();
    expect($isLoggedIn.get()).toBe(false);
  });

  it('setLoggedInUser updates $user and computes $isLoggedIn true', () => {
    setLoggedInUser({ id: 7, username: 'alice', displayName: 'Alice' });
    expect($user.get()).toEqual({ id: 7, username: 'alice', displayName: 'Alice' });
    expect($isLoggedIn.get()).toBe(true);
  });

  it('clearUser resets both atoms', () => {
    setLoggedInUser({ id: 1, username: 'a', displayName: 'A' });
    $profile.set({ id: 1 } as unknown as profileApi.UserFull);
    clearUser();
    expect($user.get()).toBeNull();
    expect($profile.get()).toBeNull();
  });

  describe('bootstrapFromStorage', () => {
    it('returns false when no userId in storage', async () => {
      mockedAuth.currentUserId.mockReturnValueOnce(null);
      const ok = await bootstrapFromStorage();
      expect(ok).toBe(false);
      expect($user.get()).toBeNull();
    });

    it('hydrates $user and $profile when getUserFull returns data', async () => {
      mockedAuth.currentUserId.mockReturnValueOnce(42);
      const full = {
        id: 42,
        username: 'bob',
        display_name: 'Bob',
        oath_signed_at: null,
        diet_type: null,
        challenge_level: null,
        eat_times: null,
        known_from: null,
        baseline: null,
        level: 1,
        current_xp: 0,
        accumulated_xp: 0,
        stage: 'egg',
        mood: 'normal',
        gems: 0,
        total_earned: 0,
        card_count: 0,
        fragment_count: 0,
      };
      mockedProfile.getUserFull.mockResolvedValueOnce(full);

      const ok = await bootstrapFromStorage();
      expect(ok).toBe(true);
      expect($user.get()).toEqual({ id: 42, username: 'bob', displayName: 'Bob' });
      expect($profile.get()).toEqual(full);
    });

    it('falls back to username when display_name is null', async () => {
      mockedAuth.currentUserId.mockReturnValueOnce(5);
      mockedProfile.getUserFull.mockResolvedValueOnce({
        id: 5,
        username: 'noname',
        display_name: null,
      });
      await bootstrapFromStorage();
      expect($user.get()?.displayName).toBe('noname');
    });

    it('logs out and returns false when getUserFull returns null', async () => {
      mockedAuth.currentUserId.mockReturnValueOnce(99);
      mockedProfile.getUserFull.mockResolvedValueOnce(null);
      const ok = await bootstrapFromStorage();
      expect(ok).toBe(false);
      expect(mockedAuth.logout).toHaveBeenCalled();
    });

    it('logs out and returns false on getUserFull error', async () => {
      mockedAuth.currentUserId.mockReturnValueOnce(11);
      mockedProfile.getUserFull.mockRejectedValueOnce(new Error('network'));
      const ok = await bootstrapFromStorage();
      expect(ok).toBe(false);
      expect(mockedAuth.logout).toHaveBeenCalled();
    });
  });
});
