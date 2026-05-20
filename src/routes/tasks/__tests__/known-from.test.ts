import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/router', () => ({ navigate: vi.fn() }));
vi.mock('@/api/profile', () => ({
  updateProfile: vi.fn().mockResolvedValue(undefined),
  getUserFull: vi.fn().mockResolvedValue(null),
}));
vi.mock('@/store/pet', () => ({
  awardXp: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/store/today', () => ({
  markMissionDone: vi.fn(),
}));

import knownFromTask from '../known-from';
import * as router from '@/router';
import * as profileApi from '@/api/profile';
import * as petStore from '@/store/pet';
import * as todayStore from '@/store/today';
import { $user } from '@/store/user';

const mockedRouter = router as unknown as { navigate: ReturnType<typeof vi.fn> };
const mockedProfile = profileApi as unknown as {
  updateProfile: ReturnType<typeof vi.fn>;
  getUserFull: ReturnType<typeof vi.fn>;
};
const mockedPet = petStore as unknown as { awardXp: ReturnType<typeof vi.fn> };
const mockedToday = todayStore as unknown as { markMissionDone: ReturnType<typeof vi.fn> };

describe('tasks/known-from', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    $user.set({ id: 7, username: 'k', displayName: 'k' });
  });

  it('renders 4 source options + Skip', () => {
    const el = knownFromTask();
    expect(el.querySelectorAll('.choice').length).toBe(4);
    expect(el.querySelector('#skip-btn')).not.toBeNull();
  });

  it('does NOT render onboarding progress dots', () => {
    const el = knownFromTask();
    expect(el.querySelectorAll('.onb-progress-dot').length).toBe(0);
  });

  it('clicking a source writes profile, credits 15 XP, marks mission, bounces to /tasks', async () => {
    const el = knownFromTask();
    el.querySelector<HTMLButtonElement>('.choice[data-value="instagram"]')?.click();
    await new Promise((r) => setTimeout(r, 0));
    expect(mockedProfile.updateProfile).toHaveBeenCalledWith(7, { known_from: 'instagram' });
    expect(mockedPet.awardXp).toHaveBeenCalledWith(7, 15, 'mission', null);
    expect(mockedToday.markMissionDone).toHaveBeenCalledWith('known_from', 15);
    expect(mockedRouter.navigate).toHaveBeenCalledWith('/home');
  });

  it('Skip leaves profile alone and bounces to /home (no XP)', () => {
    const el = knownFromTask();
    el.querySelector<HTMLButtonElement>('#skip-btn')?.click();
    expect(mockedProfile.updateProfile).not.toHaveBeenCalled();
    expect(mockedPet.awardXp).not.toHaveBeenCalled();
    expect(mockedRouter.navigate).toHaveBeenCalledWith('/home');
  });

  it('Back arrow bounces to /home', () => {
    const el = knownFromTask();
    (el.querySelector('#back-btn') as HTMLElement).click();
    expect(mockedRouter.navigate).toHaveBeenCalledWith('/home');
  });
});
