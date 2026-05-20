import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/api/content', () => ({
  getDayScript: vi.fn().mockResolvedValue(null),
}));
vi.mock('@/api/check-ins', () => ({
  listCheckIns: vi.fn().mockResolvedValue([]),
}));
vi.mock('@/router', () => ({
  navigate: vi.fn(),
}));

import home from '../home';
import { $pet } from '@/store/pet';
import { $today, $challenge } from '@/store/today';
import { $user } from '@/store/user';
import * as router from '@/router';
import * as checkIns from '@/api/check-ins';

const mockedRouter = router as unknown as { navigate: ReturnType<typeof vi.fn> };
const mockedCheckIns = checkIns as unknown as {
  listCheckIns: ReturnType<typeof vi.fn>;
};

function flush() {
  return new Promise((r) => setTimeout(r, 0));
}

describe('home route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedCheckIns.listCheckIns.mockResolvedValue([]);
    $pet.set(null);
    $today.set({ dayNumber: 1, totalXpToday: 0, missionsDone: [], luckyColor: '' });
    $challenge.set({ scripts: [], currentDay: null });
    $user.set({ id: 1, username: 'u', displayName: 'U' });
  });

  afterEach(() => {
    // home() routes leak bind() subscribers when their el stays attached;
    // wipe the document to detach so nanostore subscriptions clean up.
    document.body.innerHTML = '';
  });

  it('renders the post-UX-spec layout', () => {
    const el = home();
    expect(el.classList.contains('home-screen')).toBe(true);
    expect(el.querySelector('.home-resources')).not.toBeNull();
    // Top bar is now exactly two chips: Gem + Streak.
    expect(el.querySelectorAll('.resource-chip').length).toBe(2);
    expect(el.querySelector('[data-resource="gem"]')).not.toBeNull();
    expect(el.querySelector('[data-resource="streak"]')).not.toBeNull();
    expect(el.querySelector('.home-hero')).not.toBeNull();
    expect(el.querySelector('.pet-view')).not.toBeNull();
    expect(el.querySelector('.level-bar')).not.toBeNull();
    expect(el.querySelector('.lucky-card')).not.toBeNull();
    // Missions card replaces the standalone quiz-bubble; missions list
    // surfaces up to 2 unfinished missions + see-all sheet.
    expect(el.querySelector('.missions-card')).not.toBeNull();
    expect(el.querySelector('#missions-expand')).not.toBeNull();
    // Removed by UX_UPDATE_SPEC_v0.1 §1 + 2026-05-19 pivot:
    expect(el.querySelector('.today-card')).toBeNull();
    expect(el.querySelector('.today-day-badge')).toBeNull();
    expect(el.querySelector('.tolerance-pill')).toBeNull();
    expect(el.querySelectorAll('.meal-dot').length).toBe(0);
    expect(el.querySelector('.quiz-bubble')).toBeNull();
  });

  it('missions card surfaces at most 2 unfinished missions inline', () => {
    const el = home();
    document.body.appendChild(el);
    const rows = el.querySelectorAll('.missions-list .mission-row');
    expect(rows.length).toBeLessThanOrEqual(2);
    expect(rows.length).toBeGreaterThan(0);
  });

  it('查看全部 expands the missions list in-place with the full mission list', () => {
    const el = home();
    document.body.appendChild(el);
    const initialRows = el.querySelectorAll('.missions-list .mission-row');
    expect(initialRows.length).toBeLessThanOrEqual(2);
    el.querySelector<HTMLElement>('#missions-expand')?.click();
    const expandedRows = el.querySelectorAll('.missions-list .mission-row');
    // 3 meals + quiz + lucky + 5 sustainable = 10 rows.
    expect(expandedRows.length).toBe(10);
    // No popup / modal mounted — same card grew.
    expect(el.querySelector('.missions-sheet')).toBeNull();
    // Toggle button reflects state.
    const btn = el.querySelector<HTMLElement>('#missions-expand');
    expect(btn?.getAttribute('aria-expanded')).toBe('true');
    expect(btn?.querySelector('.missions-expand-label')?.textContent).toBe('收合');
  });

  it('clicking the toggle a second time collapses back to top-2', () => {
    const el = home();
    document.body.appendChild(el);
    const btn = el.querySelector<HTMLElement>('#missions-expand');
    btn?.click(); // expand
    btn?.click(); // collapse
    const rows = el.querySelectorAll('.missions-list .mission-row');
    expect(rows.length).toBeLessThanOrEqual(2);
    expect(btn?.getAttribute('aria-expanded')).toBe('false');
  });

  it('reflects $pet level/xp into the level bar', () => {
    const el = home();
    document.body.appendChild(el);
    $pet.set({ level: 5, currentXp: 12, accumulatedXp: 0, stage: 'egg', mood: 'normal', strikes: 0, poisonedUntil: null });
    expect(el.querySelector('[data-bind="level"]')?.textContent).toBe('5');
    expect(el.querySelector('[data-bind="cur-xp"]')?.textContent).toBe('12');
    el.remove();
  });

  it('pet bubble shows a time-of-day phrase (not an empty fallback)', () => {
    const el = home();
    const bubble = el.querySelector('[data-bind="pet-bubble"]');
    expect(bubble?.textContent?.trim().length ?? 0).toBeGreaterThan(0);
  });

  it('streak chip reflects deriveStreak over listCheckIns rows', async () => {
    mockedCheckIns.listCheckIns.mockResolvedValue([
      { day_number: 1 },
      { day_number: 2 },
      { day_number: 3 },
    ]);
    $today.set({ dayNumber: 3, totalXpToday: 0, missionsDone: [], luckyColor: '' });
    const el = home();
    document.body.appendChild(el);
    await flush();
    expect(el.querySelector('[data-bind="streak"]')?.textContent).toBe('3');
  });

  it('clicking lucky card navigates to /check-in', () => {
    const el = home();
    document.body.appendChild(el);
    el.querySelector<HTMLElement>('#lucky-card')?.click();
    expect(mockedRouter.navigate).toHaveBeenCalledWith('/check-in');
    el.remove();
  });

  it('clicking a quiz mission row navigates to /tasks/quiz', () => {
    const el = home();
    document.body.appendChild(el);
    // Expand the missions list so the quiz row is reliably mounted.
    el.querySelector<HTMLElement>('#missions-expand')?.click();
    const quizRow = el.querySelector<HTMLElement>('.missions-list .mission-row[data-key="quiz"]');
    quizRow?.click();
    expect(mockedRouter.navigate).toHaveBeenCalledWith('/tasks/quiz');
  });

  it('completed missions are marked done and skipped from the inline top-2', () => {
    $today.set({ dayNumber: 1, totalXpToday: 35, missionsDone: ['quiz', 'lucky:hit', 'meal:breakfast'], luckyColor: 'red' });
    const el = home();
    document.body.appendChild(el);
    // The top-2 inline row should not include any already-done mission.
    const inlineKeys = Array.from(el.querySelectorAll('.missions-list .mission-row'))
      .map((r) => (r as HTMLElement).dataset.key);
    expect(inlineKeys).not.toContain('quiz');
    expect(inlineKeys).not.toContain('lucky');
    expect(inlineKeys).not.toContain('meal:breakfast');
  });

  it('lucky-card flips to "已命中" state when missionsDone includes lucky:hit', () => {
    const el = home();
    document.body.appendChild(el);
    $today.set({ dayNumber: 1, totalXpToday: 35, missionsDone: ['lucky:hit'], luckyColor: 'red' });
    const card = el.querySelector<HTMLElement>('#lucky-card')!;
    expect(card.classList.contains('hit')).toBe(true);
    expect(card.querySelector('[data-bind="lucky-status"]')?.textContent).toContain('已命中');
    el.remove();
  });
});
