/**
 * Home route — main "tamagotchi" view.
 *
 * Five sections (per design.md §6.1):
 *   1. Greeting + day badge (driven by current ChallengeScript.greeting)
 *   2. Hero PetView with fog overlay
 *   3. Level/XP progress bar (from $pet)
 *   4. Today status card with breakfast/lunch/dinner dots (from $today)
 *   5. Lucky-color card → /map, Quiz bubble → /tasks/quiz
 *
 * Day data (currentDay / dayNumber / luckyColor) is kept in sync globally
 * by store/day-sync; this route only reacts to $today / $challenge / $pet.
 */
import { navigate } from '@/router';
import { $pet, type PetStoreShape } from '@/store/pet';
import { $today, $challenge, type TodayStoreShape } from '@/store/today';
import { $profile } from '@/store/user';
import type { ChallengeScript } from '@/api/content';
import { XP_PER_LEVEL } from '@/lib/pet-evolution';
import { normalizeLuckyColor } from '@/lib/lucky-color';
import { bind } from '@/lib/lifecycle';
import { createPetView } from '@/components/PetView';

const MEALS: Array<{ key: string; label: string }> = [
  { key: 'breakfast', label: '早' },
  { key: 'lunch', label: '午' },
  { key: 'dinner', label: '晚' },
];

const LUCKY_LABEL: Record<string, string> = {
  red: '紅色',
  orange: '橙色',
  yellow: '黃色',
  green: '綠色',
  blue: '藍色',
  purple: '紫色',
  black: '黑色',
  white: '白色',
};

export default function home(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'home-screen';

  const pet = createPetView();

  wrap.innerHTML = `
    <header class="home-greeting">
      <div class="home-greeting-text" data-bind="greeting">早安，喚醒者</div>
      <div class="home-greeting-day">
        D<span data-bind="day">1</span><span class="home-day-of">/30</span>
        <span class="tolerance-pill" id="tolerance-pill" hidden></span>
      </div>
    </header>
    <section class="home-hero" data-slot="pet"></section>
    <section class="home-bubble pet-bubble" data-bind="pet-bubble">守護者氣息微弱…</section>
    <section class="level-bar">
      <div class="level-bar-label">
        <span class="level-bar-lv">LV.<span data-bind="level">1</span></span>
        <span class="level-bar-xp"><span data-bind="cur-xp">0</span>/<span data-bind="next-xp">30</span> XP</span>
      </div>
      <div class="level-bar-track">
        <div class="level-bar-fill" data-bind="level-fill" style="width:0%"></div>
      </div>
    </section>
    <section class="today-card">
      <div class="today-card-row">
        <span class="today-card-label">今日進度</span>
        <span class="today-card-value">+<span data-bind="today-xp">0</span> XP</span>
      </div>
      <div class="meal-dots">
        ${MEALS.map(
          (m) => `
            <div class="meal-dot" data-meal="${m.key}">
              <span class="meal-dot-tick">·</span>
              <span class="meal-dot-label">${m.label}</span>
            </div>`,
        ).join('')}
      </div>
    </section>
    <section class="lucky-card" id="lucky-card" role="button" tabindex="0">
      <div class="lucky-card-emoji" data-bind="lucky-emoji">🎨</div>
      <div class="lucky-card-body">
        <div class="lucky-card-title">今日幸運色</div>
        <div class="lucky-card-color" data-bind="lucky-label">未設定</div>
        <div class="lucky-card-status" data-bind="lucky-status"></div>
      </div>
      <span class="ms lucky-card-arrow">arrow_forward</span>
    </section>
    <section class="quiz-bubble" id="quiz-bubble" role="button" tabindex="0">
      <span class="ms" data-bind="quiz-icon">school</span>
      <span class="quiz-bubble-text" data-bind="quiz-text">每日小測驗</span>
      <span class="quiz-bubble-xp" data-bind="quiz-xp">+15 XP</span>
    </section>
  `;

  wrap.querySelector('[data-slot="pet"]')?.appendChild(pet.el);

  const $$ = (sel: string) => wrap.querySelector<HTMLElement>(sel);

  function renderPet(p: PetStoreShape | null) {
    const level = p?.level ?? 1;
    const cur = p?.currentXp ?? 0;
    const need = XP_PER_LEVEL[level] ?? 30;
    const pct = Math.max(0, Math.min(100, Math.round((cur / need) * 100)));
    const lvEl = $$('[data-bind="level"]');
    if (lvEl) lvEl.textContent = String(level);
    const curEl = $$('[data-bind="cur-xp"]');
    if (curEl) curEl.textContent = String(cur);
    const needEl = $$('[data-bind="next-xp"]');
    if (needEl) needEl.textContent = String(need);
    const fill = $$('[data-bind="level-fill"]');
    if (fill) fill.style.width = pct + '%';
  }

  function renderToday(t: TodayStoreShape) {
    const dayEl = $$('[data-bind="day"]');
    if (dayEl) dayEl.textContent = String(t.dayNumber);
    const xpEl = $$('[data-bind="today-xp"]');
    if (xpEl) xpEl.textContent = String(t.totalXpToday);
    const lucky = t.luckyColor;
    const palette = normalizeLuckyColor(lucky);
    const labelEl = $$('[data-bind="lucky-label"]');
    if (labelEl) {
      labelEl.textContent =
        lucky || (palette ? LUCKY_LABEL[palette] : '未設定') || '未設定';
    }
    const emojiEl = $$('[data-bind="lucky-emoji"]');
    if (emojiEl) {
      if (palette) {
        emojiEl.style.background = colorPreview(palette);
        emojiEl.textContent = '';
      } else {
        emojiEl.style.background = '';
        emojiEl.textContent = '🎨';
      }
    }
    for (const m of MEALS) {
      const dot = wrap.querySelector<HTMLElement>(`.meal-dot[data-meal="${m.key}"]`);
      if (!dot) continue;
      const done = t.missionsDone.some((k) => k === `meal:${m.key}` || k === m.key);
      dot.classList.toggle('done', done);
      const tick = dot.querySelector('.meal-dot-tick');
      if (tick) tick.textContent = done ? '✓' : '·';
    }

    const luckyHit = t.missionsDone.includes('lucky:hit');
    const luckyCard = $$('#lucky-card');
    if (luckyCard) luckyCard.classList.toggle('hit', luckyHit);
    const luckyStatusEl = $$('[data-bind="lucky-status"]');
    if (luckyStatusEl) luckyStatusEl.textContent = luckyHit ? '✓ 已命中 +15 XP' : '';

    const quizDone = t.missionsDone.includes('quiz');
    const quizBubble = $$('#quiz-bubble');
    if (quizBubble) {
      quizBubble.classList.toggle('done', quizDone);
      quizBubble.setAttribute('aria-disabled', quizDone ? 'true' : 'false');
      const icon = quizBubble.querySelector('[data-bind="quiz-icon"]');
      if (icon) icon.textContent = quizDone ? 'task_alt' : 'school';
      const text = quizBubble.querySelector('[data-bind="quiz-text"]');
      if (text) text.textContent = quizDone ? '今日小測驗已完成' : '每日小測驗';
      // Don't claim "+15 XP ✓" because a wrong answer locks the slot at 0 XP.
      // Only the unanswered state advertises the reward.
      const xp = quizBubble.querySelector('[data-bind="quiz-xp"]');
      if (xp) xp.textContent = quizDone ? '✓ 已作答' : '答對 +15 XP';
    }
  }

  function renderChallenge(c: { currentDay: ChallengeScript | null }) {
    const greeting = c.currentDay?.greeting ?? '早安，喚醒者';
    const greetEl = $$('[data-bind="greeting"]');
    if (greetEl) greetEl.textContent = greeting;
    const bubble = $$('[data-bind="pet-bubble"]');
    if (bubble) {
      bubble.textContent = c.currentDay?.task_description ?? '今日任務即將解鎖…';
    }
  }

  function renderTolerancePill(level: number | null) {
    const pill = $$('#tolerance-pill');
    if (!pill) return;
    if (!level || level === 1) {
      pill.hidden = true;
      return;
    }
    pill.hidden = false;
    // Home shows "等級 N" only — Profile is the place for the actual fail count.
    pill.textContent = `等級 ${level}`;
  }

  bind(wrap, $pet, renderPet);
  bind(wrap, $today, renderToday);
  bind(wrap, $challenge, renderChallenge);
  bind(wrap, $profile, (p) => renderTolerancePill(p?.challenge_level ?? null));

  $$('#lucky-card')?.addEventListener('click', () => navigate('/check-in'));
  $$('#quiz-bubble')?.addEventListener('click', () => {
    if ($today.get().missionsDone.includes('quiz')) return; // 今日已完成，不再 navigate
    navigate('/tasks/quiz');
  });

  return wrap;
}

function colorPreview(name: string): string {
  const map: Record<string, string> = {
    red: 'linear-gradient(135deg,#ff6b6b,#ff3b3b)',
    orange: 'linear-gradient(135deg,#ffb86b,#ff8a3b)',
    yellow: 'linear-gradient(135deg,#ffe26b,#ffc83b)',
    green: 'linear-gradient(135deg,#7bdc8a,#3bb84b)',
    blue: 'linear-gradient(135deg,#7ec8ff,#3b8eff)',
    purple: 'linear-gradient(135deg,#c898ff,#8a3bff)',
    black: 'linear-gradient(135deg,#555,#111)',
    white: 'linear-gradient(135deg,#fff,#ddd)',
  };
  return map[name] ?? '#ddd';
}
