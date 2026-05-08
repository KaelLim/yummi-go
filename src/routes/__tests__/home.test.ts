import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/api/content', () => ({
  getDayScript: vi.fn().mockResolvedValue(null),
}));
vi.mock('@/router', () => ({
  navigate: vi.fn(),
}));

import home from '../home';
import { $pet } from '@/store/pet';
import { $today, $challenge } from '@/store/today';
import * as router from '@/router';

const mockedRouter = router as unknown as { navigate: ReturnType<typeof vi.fn> };

describe('home route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    $pet.set(null);
    $today.set({ dayNumber: 1, totalXpToday: 0, missionsDone: [], luckyColor: '' });
    $challenge.set({ scripts: [], currentDay: null });
  });

  it('renders all main sections', () => {
    const el = home();
    expect(el.classList.contains('home-screen')).toBe(true);
    expect(el.querySelector('.home-greeting')).not.toBeNull();
    expect(el.querySelector('.home-hero')).not.toBeNull();
    expect(el.querySelector('.pet-view')).not.toBeNull();
    expect(el.querySelector('.level-bar')).not.toBeNull();
    expect(el.querySelector('.today-card')).not.toBeNull();
    expect(el.querySelector('.lucky-card')).not.toBeNull();
    expect(el.querySelector('.quiz-bubble')).not.toBeNull();
    expect(el.querySelectorAll('.meal-dot').length).toBe(3);
  });

  it('reflects $pet level/xp into the level bar', () => {
    const el = home();
    document.body.appendChild(el);
    $pet.set({ level: 5, currentXp: 12, accumulatedXp: 0, stage: 'egg', mood: 'normal', strikes: 0, poisonedUntil: null });
    expect(el.querySelector('[data-bind="level"]')?.textContent).toBe('5');
    expect(el.querySelector('[data-bind="cur-xp"]')?.textContent).toBe('12');
    el.remove();
  });

  it('reflects $today mealsDone into meal-dot.done class', () => {
    const el = home();
    document.body.appendChild(el);
    $today.set({
      dayNumber: 3,
      totalXpToday: 50,
      missionsDone: ['meal:breakfast'],
      luckyColor: 'green',
    });
    const breakfast = el.querySelector('.meal-dot[data-meal="breakfast"]');
    const lunch = el.querySelector('.meal-dot[data-meal="lunch"]');
    expect(breakfast?.classList.contains('done')).toBe(true);
    expect(lunch?.classList.contains('done')).toBe(false);
    el.remove();
  });

  it('clicking lucky card navigates to /check-in', () => {
    const el = home();
    document.body.appendChild(el);
    el.querySelector<HTMLElement>('#lucky-card')?.click();
    expect(mockedRouter.navigate).toHaveBeenCalledWith('/check-in');
    el.remove();
  });

  it('clicking quiz bubble navigates to /tasks/quiz', () => {
    const el = home();
    document.body.appendChild(el);
    el.querySelector<HTMLElement>('#quiz-bubble')?.click();
    expect(mockedRouter.navigate).toHaveBeenCalledWith('/tasks/quiz');
    el.remove();
  });

  it('quiz bubble shows done state once today.missionsDone includes "quiz"', () => {
    const el = home();
    document.body.appendChild(el);
    $today.set({ dayNumber: 1, totalXpToday: 15, missionsDone: ['quiz'], luckyColor: '' });
    const bubble = el.querySelector<HTMLElement>('#quiz-bubble')!;
    expect(bubble.classList.contains('done')).toBe(true);
    expect(bubble.querySelector('[data-bind="quiz-text"]')?.textContent).toContain('已完成');
    el.remove();
  });

  it('clicking quiz bubble does not navigate when today already complete', () => {
    const el = home();
    document.body.appendChild(el);
    $today.set({ dayNumber: 1, totalXpToday: 15, missionsDone: ['quiz'], luckyColor: '' });
    el.querySelector<HTMLElement>('#quiz-bubble')?.click();
    expect(mockedRouter.navigate).not.toHaveBeenCalled();
    el.remove();
  });
});
