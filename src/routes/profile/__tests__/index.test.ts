import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/router', () => ({ navigate: vi.fn() }));
vi.mock('@/api/check-ins', () => ({ listCheckIns: vi.fn().mockResolvedValue([]) }));

import profile from '../index';
import { $user, $profile } from '@/store/user';
import { $today } from '@/store/today';
import { $locale } from '@/lib/i18n';
import * as router from '@/router';

const mockedRouter = router as unknown as { navigate: ReturnType<typeof vi.fn> };

describe('profile hub', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    $user.set({ id: 7, username: 'kael', displayName: '阿凱' });
    $profile.set(null);
    $today.set({ dayNumber: 1, totalXpToday: 0, missionsDone: [], luckyColor: '' });
    // Pin locale so the link-label assertions stay deterministic.
    $locale.set('zh');
  });

  it('renders identity card with anon id + 3 stat cards (pet name moved to pet page; lucky-colour stat removed)', () => {
    const el = profile();
    expect(el.classList.contains('profile-screen')).toBe(true);
    // Profile identity card now surfaces the username (anon id), not the
    // pet name; the pet sprite + LV moved to the pet page.
    expect(el.querySelector('.profile-anon-id')?.textContent).toBe('kael');
    expect(el.querySelector('.profile-avatar img')).toBeNull();
    expect(el.querySelector('.profile-tag-level')).toBeNull();
    expect(el.querySelectorAll('.stat-card').length).toBe(3);
    // Inline mini-calendar removed in the 2026-05-19 pivot — full view now
    // lives at /profile/calendar.
    expect(el.querySelectorAll('.cal-cell').length).toBe(0);
    expect(el.querySelector('#calendar')).toBeNull();
  });

  it('does NOT expose a 蔬食旅程 link (already on the tab bar as the calendar tab)', () => {
    const el = profile();
    const link = Array.from(el.querySelectorAll<HTMLButtonElement>('.profile-link')).find(
      (b) => b.textContent?.includes('蔬食旅程'),
    );
    expect(link).toBeUndefined();
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
