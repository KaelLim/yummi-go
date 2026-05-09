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
import * as router from '@/router';
import * as pet from '@/store/pet';

const mockedContent = content as unknown as {
  randomQuiz: ReturnType<typeof vi.fn>;
  recordQuizAttempt: ReturnType<typeof vi.fn>;
};
const mockedRouter = router as unknown as { navigate: ReturnType<typeof vi.fn> };
const mockedPet = pet as unknown as { awardXp: ReturnType<typeof vi.fn> };

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
      expect(mockedContent.recordQuizAttempt).toHaveBeenCalledWith(
        7,
        11,
        'B',
        true,
        expect.any(Number),
      ),
    );
    expect(el.querySelector('.quiz-verdict.right')).not.toBeNull();
    expect(el.querySelector('.quiz-opt[data-value="B"]')?.classList.contains('correct')).toBe(true);
    expect($today.get().missionsDone).toContain('quiz');
    expect($today.get().totalXpToday).toBe(15);
    expect(mockedPet.awardXp).toHaveBeenCalledWith(7, 15);
    el.remove();
  });

  it('marks wrong option and exposes the correct answer with 0 XP', async () => {
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
    // Wrong answer still locks today's slot but earns 0 XP.
    expect($today.get().missionsDone).toContain('quiz');
    expect($today.get().totalXpToday).toBe(0);
    expect(mockedPet.awardXp).not.toHaveBeenCalled();
    expect(el.querySelector('.quiz-xp')?.textContent).toContain('0 XP');
    el.remove();
  });

  it('does not offer a re-try button after answering', async () => {
    mockedContent.randomQuiz.mockResolvedValueOnce(fakeQ);
    const el = quiz();
    document.body.appendChild(el);
    await vi.waitFor(() => expect(el.querySelectorAll('.quiz-opt').length).toBe(3));
    el.querySelector<HTMLButtonElement>('.quiz-opt[data-value="B"]')?.click();
    await vi.waitFor(() => expect(el.querySelector('.quiz-verdict')).not.toBeNull());
    expect(el.querySelector('#another')).toBeNull();
    el.remove();
  });

  it('bounces to /tasks if today already answered (route guard)', async () => {
    markMissionDone('quiz', 15);
    // No randomQuiz mock — the guard fires before the route asks for a question.
    quiz();
    await vi.waitFor(() => expect(mockedRouter.navigate).toHaveBeenCalledWith('/tasks'));
    expect(mockedContent.randomQuiz).not.toHaveBeenCalled();
  });

  it('falls back to a retry CTA when randomQuiz returns null', async () => {
    mockedContent.randomQuiz.mockResolvedValueOnce(null);
    const el = quiz();
    await vi.waitFor(() => expect(el.querySelector('.checkin-fallback')).not.toBeNull());
    expect(el.textContent).toContain('暫時拿不到題目');
  });
});
