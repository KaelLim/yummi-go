import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/router', () => ({ navigate: vi.fn() }));
vi.mock('@/api/drust', () => ({
  drust: { update: vi.fn().mockResolvedValue({ record: {} }) },
}));
vi.mock('@/api/profile', () => ({
  updateProfile: vi.fn().mockResolvedValue(undefined),
  getUserFull: vi.fn().mockResolvedValue(null),
}));

import settings from '../settings';
import { $user, $profile } from '@/store/user';
import * as router from '@/router';
import * as profileApi from '@/api/profile';
import { drust } from '@/api/drust';

const mockedRouter = router as unknown as { navigate: ReturnType<typeof vi.fn> };
const mockedDrust = drust as unknown as { update: ReturnType<typeof vi.fn> };
const mockedUpdateProfile = profileApi.updateProfile as unknown as ReturnType<typeof vi.fn>;

describe('settings route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    $user.set({ id: 7, username: 'kael', displayName: '阿凱' });
    $profile.set(null);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('hydrates display name from $user', () => {
    const el = settings();
    expect((el.querySelector('#display-name') as HTMLInputElement).value).toBe('阿凱');
  });

  it('saves display_name change + eat_times', async () => {
    const el = settings();
    document.body.appendChild(el);
    (el.querySelector('#display-name') as HTMLInputElement).value = '新名字';
    el.querySelector<HTMLButtonElement>('#save')?.click();
    await vi.waitFor(() => expect(mockedDrust.update).toHaveBeenCalled());
    expect(mockedDrust.update).toHaveBeenCalledWith('users', 7, { display_name: '新名字' });
    expect(mockedUpdateProfile).toHaveBeenCalled();
    const patch = mockedUpdateProfile.mock.calls[0][1];
    expect(patch.eat_times).toBeDefined();
    el.remove();
  });

  it('logout clears session and navigates to splash', () => {
    const el = settings();
    el.querySelector<HTMLButtonElement>('#logout')?.click();
    expect(mockedRouter.navigate).toHaveBeenCalledWith('/');
  });

  it('blocks empty name on save', () => {
    const el = settings();
    (el.querySelector('#display-name') as HTMLInputElement).value = '   ';
    el.querySelector<HTMLButtonElement>('#save')?.click();
    expect(el.querySelector<HTMLElement>('#err')?.hidden).toBe(false);
    expect(mockedDrust.update).not.toHaveBeenCalled();
  });
});
