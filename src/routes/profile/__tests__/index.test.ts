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

  it('renders header card + 4 stat cards + 30-day calendar grid', () => {
    const el = profile();
    expect(el.classList.contains('profile-screen')).toBe(true);
    expect(el.querySelector('.profile-name')?.textContent).toBe('阿凱');
    expect(el.querySelectorAll('.stat-card').length).toBe(4);
    expect(el.querySelectorAll('.cal-cell').length).toBe(30);
  });

  it('marks the current day with .today and future days as .future', () => {
    $today.set({ dayNumber: 5, totalXpToday: 0, missionsDone: [], luckyColor: '' });
    const el = profile();
    document.body.appendChild(el);
    const cells = Array.from(el.querySelectorAll<HTMLElement>('.cal-cell'));
    const today = cells[4];
    const future = cells[10];
    expect(today.classList.contains('today')).toBe(true);
    expect(future.classList.contains('future')).toBe(true);
    el.remove();
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
