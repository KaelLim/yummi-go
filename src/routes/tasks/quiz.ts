/**
 * Daily quiz — single random question, 3 options, immediate feedback.
 *
 * Picks via random_quiz RPC. The user gets +15 XP only on a correct
 * answer; a wrong answer locks the day with 0 XP. Once `'quiz'` is in
 * today's missions_done, re-entering the route bounces back to /tasks.
 */
import { navigate } from '@/router';
import { $user } from '@/store/user';
import { randomQuiz, recordQuizAttempt, type QuizQuestion } from '@/api/content';
import { markMissionDone, $today } from '@/store/today';
import { awardXp } from '@/store/pet';

const QUIZ_XP = 15;

export default function quiz(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'quiz-screen';

  // Hard guard: today's quiz is one-shot. If it's already been answered,
  // bounce back to /tasks instead of letting the user grab another XP-able
  // question. The bubble and tasks page both already disable the CTA, but
  // a directly-typed URL would otherwise sneak past them.
  if ($today.get().missionsDone.includes('quiz')) {
    queueMicrotask(() => navigate('/tasks'));
    return wrap;
  }

  wrap.innerHTML = `
    <header class="checkin-header">
      <button class="checkin-back" id="back-btn" aria-label="返回">
        <span class="ms">arrow_back</span>
      </button>
      <span class="checkin-title">每日小測驗</span>
      <span class="checkin-meal">答對 +${QUIZ_XP} XP</span>
    </header>
    <div class="quiz-body" id="body">
      <div class="quiz-loading">
        <span class="ms">hourglass_top</span>
        <span>抽題中…</span>
      </div>
    </div>
  `;

  const body = wrap.querySelector<HTMLElement>('#body')!;

  wrap.querySelector('#back-btn')?.addEventListener('click', () => navigate('/tasks'));

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

  const xpEarned = correct ? QUIZ_XP : 0;

  resultEl.hidden = false;
  resultEl.innerHTML = `
    <div class="quiz-verdict ${correct ? 'right' : 'wrong'}">
      <span class="ms">${correct ? 'verified' : 'info'}</span>
      <strong>${correct ? '答對了！' : '答錯了，正解是 ' + escapeHtml(q.correct_answer)}</strong>
      <span class="quiz-xp">${correct ? '+' + QUIZ_XP + ' XP' : '0 XP · 明天再挑戰'}</span>
    </div>
    ${q.explanation ? `<p class="quiz-explanation">${escapeHtml(q.explanation)}</p>` : ''}
    <div class="quiz-actions">
      <button class="btn text-btn-m btn-primary btn-l text-btn-l" id="back">回任務</button>
    </div>
  `;

  resultEl.querySelector('#back')?.addEventListener('click', () => navigate('/tasks'));

  // Mark mission immediately — answered means the daily slot is consumed,
  // even on a wrong pick. Wrong answer carries 0 XP so totalXpToday stays put.
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
    if (correct) {
      try {
        await awardXp(u.id, QUIZ_XP, 'quiz', q.id);
      } catch (err) {
        console.warn('[quiz] awardXp failed:', err);
      }
    }
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;',
  );
}
