import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/router', () => ({ navigate: vi.fn() }));
vi.mock('@/api/check-ins', () => ({ listCheckIns: vi.fn().mockResolvedValue([]) }));

import profile from '../index';
import { $user, $profile } from '@/store/user';
import { $today } from '@/store/today';
import * as router from '@/router';

const mockedRouter = router as unknown as { navigate: ReturnType<typeof vi.fn> };

describe('profile hub', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    $user.set({ id: 7, username: 'kael', displayName: '阿凱' });
    $profile.set(null);
    $today.set({ dayNumber: 1, totalXpToday: 0, missionsDone: [], luckyColor: '' });
  });

  it('renders header card + 4 stat cards (inline calendar removed)', () => {
    const el = profile();
    expect(el.classList.contains('profile-screen')).toBe(true);
    expect(el.querySelector('.profile-name')?.textContent).toBe('阿凱');
    expect(el.querySelectorAll('.stat-card').length).toBe(4);
    // Inline mini-calendar removed in the 2026-05-19 pivot — full view now
    // lives at /profile/calendar.
    expect(el.querySelectorAll('.cal-cell').length).toBe(0);
    expect(el.querySelector('#calendar')).toBeNull();
  });

  it('exposes a 月曆 / 補簽 link that routes to /profile/calendar', () => {
    const el = profile();
    const link = Array.from(el.querySelectorAll<HTMLButtonElement>('.profile-link')).find(
      (b) => b.textContent?.includes('月曆'),
    );
    link?.click();
    expect(mockedRouter.navigate).toHaveBeenCalledWith('/profile/calendar');
  });

  it('clicking a profile-link navigates', () => {
    const el = profile();
    const settings = Array.from(el.querySelectorAll<HTMLButtonElement>('.profile-link')).find(
      (b) => b.textContent?.includes('設定'),
    );
    settings?.click();
    expect(mockedRouter.navigate).toHaveBeenCalledWith('/profile/settings');
  });
});
