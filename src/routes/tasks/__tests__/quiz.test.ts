import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/router', () => ({ navigate: vi.fn() }));
vi.mock('@/api/content', () => ({
  randomQuiz: vi.fn(),
  recordQuizAttempt: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/store/pet', () => ({ awardXp: vi.fn().mockResolvedValue(undefined) }));

import quiz from '../quiz';
import { $user } from '@/store/user';
import { $today, markMissionDone } from '@/store/today';
import * as content from '@/api/content';

const mockedContent = content as unknown as {
  randomQuiz: ReturnType<typeof vi.fn>;
  recordQuizAttempt: ReturnType<typeof vi.fn>;
};

const fakeQ = {
  id: 11,
  source: 'spec',
  category: 'foo',
  question: '哪個是蔬菜？',
  option_a: '蘋果',
  option_b: '萵苣',
  option_c: '雞肉',
  // drust stores correct_answer as the matching option text (not the letter),
  // so the route resolves the letter via option_a/_b/_c label match.
  correct_answer: '萵苣',
  explanation: '萵苣是葉菜類。',
};

describe('quiz route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    $user.set({ id: 7, username: 'u', displayName: 'u' });
    $today.set({ dayNumber: 1, totalXpToday: 0, missionsDone: [], luckyColor: '' });
  });

  it('shows loading then question once randomQuiz resolves', async () => {
    mockedContent.randomQuiz.mockResolvedValueOnce(fakeQ);
    const el = quiz();
    expect(el.querySelector('.quiz-loading')).not.toBeNull();
    await vi.waitFor(() => {
      expect(el.querySelector('.quiz-question')?.textContent).toBe('哪個是蔬菜？');
    });
    expect(el.querySelectorAll('.quiz-opt').length).toBe(3);
  });

  it('marks correct + records + awards XP when right option picked', async () => {
    mockedContent.randomQuiz.mockResolvedValueOnce(fakeQ);
    const el = quiz();
    document.body.appendChild(el);
    await vi.waitFor(() => expect(el.querySelectorAll('.quiz-opt').length).toBe(3));
    // option_b text matches correct_answer, so clicking B is correct.
    el.querySelector<HTMLButtonElement>('.quiz-opt[data-value="B"]')?.click();
    await vi.waitFor(() =>
      expect(mockedContent.recordQuizAttempt).toHaveBeenCalledWith(7, 11, 'B', true),
    );
    expect(el.querySelector('.quiz-verdict.right')).not.toBeNull();
    expect(el.querySelector('.quiz-opt[data-value="B"]')?.classList.contains('correct')).toBe(true);
    expect($today.get().missionsDone).toContain('quiz');
    el.remove();
  });

  it('marks wrong option and exposes the correct answer', async () => {
    mockedContent.randomQuiz.mockResolvedValueOnce(fakeQ);
    const el = quiz();
    document.body.appendChild(el);
    await vi.waitFor(() => expect(el.querySelectorAll('.quiz-opt').length).toBe(3));
    el.querySelector<HTMLButtonElement>('.quiz-opt[data-value="A"]')?.click();
    await vi.waitFor(() =>
      expect(el.querySelector('.quiz-verdict.wrong')).not.toBeNull(),
    );
    expect(el.querySelector('.quiz-opt[data-value="B"]')?.classList.contains('correct')).toBe(true);
    expect(el.querySelector('.quiz-opt[data-value="A"]')?.classList.contains('wrong')).toBe(true);
    el.remove();
  });

  it('falls back to a retry CTA when randomQuiz returns null', async () => {
    mockedContent.randomQuiz.mockResolvedValueOnce(null);
    const el = quiz();
    await vi.waitFor(() => expect(el.querySelector('.checkin-fallback')).not.toBeNull());
    expect(el.textContent).toContain('暫時拿不到題目');
  });

  it('does not double-mark mission if already done before clicking', async () => {
    markMissionDone('quiz', 15);
    mockedContent.randomQuiz.mockResolvedValueOnce(fakeQ);
    const el = quiz();
    document.body.appendChild(el);
    await vi.waitFor(() => expect(el.querySelectorAll('.quiz-opt').length).toBe(3));
    el.querySelector<HTMLButtonElement>('.quiz-opt[data-value="B"]')?.click();
    await vi.waitFor(() => expect(mockedContent.recordQuizAttempt).toHaveBeenCalled());
    // markMissionDone is idempotent; missionsDone still includes 'quiz' once.
    expect($today.get().missionsDone.filter((k) => k === 'quiz').length).toBe(1);
    el.remove();
  });
});
