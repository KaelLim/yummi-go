import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/router', () => ({ navigate: vi.fn() }));
vi.mock('@/api/check-ins', () => ({ listCheckIns: vi.fn() }));

import day30 from '../day-30';
import { $user, $profile } from '@/store/user';
import * as checkIns from '@/api/check-ins';
import * as router from '@/router';

const mockedListCheckIns = checkIns.listCheckIns as unknown as ReturnType<typeof vi.fn>;
const mockedRouter = router as unknown as { navigate: ReturnType<typeof vi.fn> };

const baseProfile = {
  id: 7, username: 'k', display_name: 'k',
  oath_signed_at: null, diet_type: null, challenge_level: null,
  eat_times: null, known_from: null,
  baseline: '{"beef":0.2,"pork":0.3,"lamb":0,"chicken":0.5}',
  level: 12, current_xp: 0, accumulated_xp: 500,
  stage: 'baby', mood: 'happy',
  gems: 0, total_earned: 0, card_count: 0, fragment_count: 0,
};

const checkin = (day: number, lucky = 0) =>
  ({
    id: day,
    user_id: 7,
    day_number: day,
    meal_index: 1 as const,
    timestamp: '2026-05-08T08:00:00Z',
    food_items: '[]',
    nutrition: '{}',
    vegan_type: null,
    was_meat_replaced: 0,
    lucky_color_matched: lucky,
    xp_earned: 20,
    gems_earned: 0,
  });

describe('day-30 finale', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    $user.set({ id: 7, username: 'k', displayName: 'k' });
    $profile.set(baseProfile);
  });

  it('renders header + chest body + restart CTA', () => {
    mockedListCheckIns.mockResolvedValueOnce([]);
    const el = day30();
    expect(el.classList.contains('day30-screen')).toBe(true);
    expect(el.querySelector('.day30-title')?.textContent).toContain('守護者');
    expect(el.querySelector('#restart')).not.toBeNull();
  });

  it('aggregates totals from check-ins (3 days, 2 lucky hits, longest streak 2)', async () => {
    mockedListCheckIns.mockResolvedValueOnce([
      checkin(1, 1),
      checkin(2, 1),
      checkin(5, 0),
    ]);
    const el = day30();
    document.body.appendChild(el);
    await vi.waitFor(() => expect(el.querySelector('.impact-grid')).not.toBeNull());

    const cells = Array.from(el.querySelectorAll('.impact-cell'));
    const dayCell = cells.find((c) => c.textContent?.includes('完成天數'))!;
    const luckyCell = cells.find((c) => c.textContent?.includes('幸運色命中'))!;
    const streakCell = cells.find((c) => c.textContent?.includes('最長連擊'))!;

    expect(dayCell.querySelector('.impact-value')?.textContent).toBe('3');
    expect(luckyCell.querySelector('.impact-value')?.textContent).toBe('2');
    expect(streakCell.querySelector('.impact-value')?.textContent).toBe('2');
    el.remove();
  });

  it('restart navigates home', () => {
    mockedListCheckIns.mockResolvedValueOnce([]);
    const el = day30();
    el.querySelector<HTMLButtonElement>('#restart')?.click();
    expect(mockedRouter.navigate).toHaveBeenCalledWith('/home');
  });

  it('shows badge for 30-day completion', async () => {
    mockedListCheckIns.mockResolvedValueOnce(
      Array.from({ length: 30 }, (_, i) => checkin(i + 1, i < 5 ? 1 : 0)),
    );
    const el = day30();
    document.body.appendChild(el);
    await vi.waitFor(() => {
      const badges = Array.from(el.querySelectorAll('.badge')).map((b) => b.textContent);
      expect(badges.some((b) => b?.includes('30 天滿勤'))).toBe(true);
    });
    el.remove();
  });
});
