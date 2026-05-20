/**
 * Daily quiz — single random question, 3 options, immediate feedback.
 *
 * Picks via random_quiz RPC. Per the 2026-05-19 quest-flow update:
 *   - Correct → +15 XP, "答對了！" verdict, pet-happy bubble, explanation.
 *   - Wrong   → +5 XP consolation, "沒關係" verdict, the wrong option goes
 *               red, the correct option goes green, pet gives a gentle
 *               「沒關係，看講解學一下！」 nudge, explanation appears.
 *
 * Either outcome consumes today's daily slot (`'quiz'` mission), so re-
 * entering the route bounces back to /home.
 */
import { navigate } from '@/router';
import { $user } from '@/store/user';
import { randomQuiz, recordQuizAttempt, type QuizQuestion } from '@/api/content';
import { markMissionDone, $today } from '@/store/today';
import { awardXp } from '@/store/pet';

const QUIZ_XP_CORRECT = 15;
const QUIZ_XP_WRONG = 5;

export default function quiz(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'quiz-screen';

  // Hard guard: today's quiz is one-shot. If it's already been answered,
  // bounce back to /home instead of letting the user grab another XP-able
  // question. The home missions card already disables the CTA, but a
  // directly-typed URL would otherwise sneak past it.
  if ($today.get().missionsDone.includes('quiz')) {
    queueMicrotask(() => navigate('/home'));
    return wrap;
  }

  wrap.innerHTML = `
    <header class="checkin-header">
      <button class="checkin-back" id="back-btn" aria-label="返回">
        <span class="ms">arrow_back</span>
      </button>
      <span class="checkin-title">每日小測驗</span>
      <span class="checkin-meal">答對 +${QUIZ_XP_CORRECT} · 答錯 +${QUIZ_XP_WRONG}</span>
    </header>
    <div class="quiz-body" id="body">
      <div class="quiz-loading">
        <span class="ms">hourglass_top</span>
        <span>抽題中…</span>
      </div>
    </div>
  `;

  const body = wrap.querySelector<HTMLElement>('#body')!;

  wrap.querySelector('#back-btn')?.addEventListener('click', () => navigate('/home'));

  void (async () => {
    let q: QuizQuestion | null = null;
    try {
      q = await randomQuiz();
    } catch (err) {
      console.error('[quiz] randomQuiz failed:', err);
    }
    if (!q) {
      body.innerHTML = `
        <div class="checkin-fallback">
          <p>暫時拿不到題目。</p>
          <button class="btn text-btn-m btn-primary btn-l text-btn-l" id="retry">重試</button>
        </div>
      `;
      body.querySelector('#retry')?.addEventListener('click', () => navigate('/tasks/quiz'));
      return;
    }

    renderQuestion(body, q);
  })();

  return wrap;
}

function renderQuestion(body: HTMLElement, q: QuizQuestion): void {
  const options = [
    { value: 'A', label: q.option_a },
    { value: 'B', label: q.option_b },
    { value: 'C', label: q.option_c },
  ];

  // correct_answer is stored as the full option text (not the letter A/B/C),
  // so we resolve which letter that maps to. If the answer text doesn't
  // match any option, treat it as a string answer and let the verdict view
  // display q.correct_answer directly.
  const correctOpt = options.find((o) => o.label === q.correct_answer);
  const correctValue = correctOpt?.value ?? null;

  body.innerHTML = `
    <div class="quiz-card">
      <div class="quiz-source">${escapeHtml(q.source)} · ${escapeHtml(q.category)}</div>
      <p class="quiz-question">${escapeHtml(q.question)}</p>
      <div class="quiz-options">
        ${options
          .map(
            (o) => `
            <button class="quiz-opt" data-value="${o.value}">
              <span class="quiz-opt-letter">${o.value}</span>
              <span class="quiz-opt-text">${escapeHtml(o.label)}</span>
            </button>`,
          )
          .join('')}
      </div>
      <div class="quiz-result" hidden></div>
    </div>
  `;

  const optionsEl = body.querySelector<HTMLElement>('.quiz-options');
  const resultEl = body.querySelector<HTMLElement>('.quiz-result');
  if (!optionsEl || !resultEl) return;

  optionsEl.querySelectorAll<HTMLButtonElement>('.quiz-opt').forEach((btn) => {
    btn.addEventListener('click', () => {
      void onPick(btn, q, correctValue, optionsEl, resultEl);
    });
  });
}

async function onPick(
  picked: HTMLButtonElement,
  q: QuizQuestion,
  correctValue: string | null,
  optionsEl: HTMLElement,
  resultEl: HTMLElement,
): Promise<void> {
  const value = picked.dataset.value!;
  const correct = correctValue !== null && value === correctValue;

  optionsEl.querySelectorAll<HTMLButtonElement>('.quiz-opt').forEach((b) => {
    b.disabled = true;
    const v = b.dataset.value!;
    if (v === correctValue) b.classList.add('correct');
    else if (v === value) b.classList.add('wrong');
  });

  const xpEarned = correct ? QUIZ_XP_CORRECT : QUIZ_XP_WRONG;

  resultEl.hidden = false;
  resultEl.innerHTML = `
    <div class="quiz-verdict ${correct ? 'right' : 'wrong'}">
      <span class="ms">${correct ? 'verified' : 'cancel'}</span>
      <strong>${correct ? '答對了！' : '沒關係'}</strong>
      <span class="quiz-xp">+${xpEarned} XP</span>
    </div>
    ${!correct ? `
      <div class="quiz-pet-bubble">
        <span class="quiz-pet-emoji" aria-hidden="true">🐣</span>
        <span class="quiz-pet-text">沒關係，看講解學一下！</span>
      </div>
    ` : ''}
    ${q.explanation ? `<p class="quiz-explanation">${escapeHtml(q.explanation)}</p>` : ''}
    <div class="quiz-actions">
      <button class="btn text-btn-m btn-primary btn-l text-btn-l" id="back">繼續</button>
    </div>
  `;

  resultEl.querySelector('#back')?.addEventListener('click', () => navigate('/home'));

  // Mark mission immediately — answered means the daily slot is consumed.
  // Both correct (+15) and wrong (+5) carry XP per the 2026-05-19 update.
  markMissionDone('quiz', xpEarned);

  // Best-effort persistence + XP. Failures don't block the user.
  const u = $user.get();
  if (u) {
    const dayNumber = $today.get().dayNumber;
    try {
      await recordQuizAttempt(u.id, q.id, value, correct, dayNumber);
    } catch (err) {
      console.warn('[quiz] recordQuizAttempt failed:', err);
    }
    try {
      await awardXp(u.id, xpEarned, 'quiz', q.id);
    } catch (err) {
      console.warn('[quiz] awardXp failed:', err);
    }
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;',
  );
}
