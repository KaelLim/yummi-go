import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/router', () => ({ navigate: vi.fn() }));
vi.mock('@/api/check-ins', () => ({ listCheckIns: vi.fn().mockResolvedValue([]) }));

import tasks from '../index';
import { $user } from '@/store/user';
import { $today, $challenge, setDay, markMissionDone } from '@/store/today';

describe('tasks hub route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    $user.set({ id: 7, username: 'u', displayName: 'u' });
    $today.set({ dayNumber: 1, totalXpToday: 0, missionsDone: [], luckyColor: '紅色' });
    $challenge.set({ scripts: [], currentDay: null });
  });

  it('renders header + 3 segments + today body by default', () => {
    const el = tasks();
    expect(el.classList.contains('tasks-screen')).toBe(true);
    expect(el.querySelector('.tasks-title')?.textContent).toBe('任務');
    expect(el.querySelectorAll('.seg').length).toBe(3);
    expect(el.querySelectorAll('.mission').length).toBe(5);
  });

  it('reflects mission completion when mission keys are marked', () => {
    const el = tasks();
    document.body.appendChild(el);
    markMissionDone('quiz', 15);
    const quizMission = Array.from(el.querySelectorAll('.mission')).find((m) =>
      m.textContent?.includes('每日小測驗'),
    );
    expect(quizMission?.classList.contains('done')).toBe(true);
    el.remove();
  });

  it('switches to 5R segment and shows the day script action', () => {
    const script = {
      id: 1,
      day_number: 1,
      lucky_color: '紅色',
      greeting: 'g',
      action_type: 'Refuse 日：拒絕使用一次性用品',
      task_description: 't',
      bonus_challenge: '拒絕兩次',
      fog_reduction_pct: 1,
    };
    setDay([script], 1);
    const el = tasks();
    document.body.appendChild(el);
    el.querySelector<HTMLButtonElement>('.seg[data-seg="5r"]')?.click();
    expect(el.querySelector('.five-r-card')).not.toBeNull();
    expect(el.textContent).toContain('拒絕使用一次性用品');
    expect(el.textContent).toContain('拒絕兩次');
    el.remove();
  });

  it('switches to 補簽 segment and shows fragment + card counts', () => {
    const el = tasks();
    document.body.appendChild(el);
    el.querySelector<HTMLButtonElement>('.seg[data-seg="makeup"]')?.click();
    expect(el.querySelector('.makeup-card')).not.toBeNull();
    el.remove();
  });
});
