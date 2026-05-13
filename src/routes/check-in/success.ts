/**
 * Check-in step 4 — celebration + auto-distribution summary.
 *
 * Sequenced acts (CSS-driven):
 *   ACT 1 (0–1000ms): +XP burst floats up from the pet
 *   ACT 2 (1000–2000ms): 30-day progress fills up to today
 *   ACT 3 (2000–3000ms): distribution summary slides in
 *
 * Tap anywhere on the body before ACT 3 settles → jump to settled state.
 *
 * XP distribution happens automatically in /check-in/result before we
 * land here:
 *   - up to PET_DAILY_XP_CAP per local day flows into pet_states
 *   - any overflow converts to gems at 1 XP = 1 Gem
 * This screen just displays the breakdown (xpFedToPet / gemsFromXp on the
 * stored lastResult) and offers Share / Continue.
 */
import { navigate } from '@/router';
import { $checkin, resetCheckin } from '@/store/checkin';
import { $today } from '@/store/today';
import { $profile } from '@/store/user';

const MEAL_LABEL: Record<number, string> = { 1: '早餐', 2: '午餐', 3: '晚餐' };

export default function success(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'checkin-screen checkin-success act-1';
  const r = $checkin.get().lastResult;
  if (!r) {
    wrap.innerHTML = `
      <div class="checkin-body checkin-fallback">
        <p>沒有可顯示的打卡結果。</p>
        <button class="btn text-btn-m btn-primary btn-l text-btn-l" id="back">回首頁</button>
      </div>
    `;
    wrap.querySelector('#back')?.addEventListener('click', () => navigate('/home'));
    return wrap;
  }

  const replaced = $checkin.get().wasMeatReplaced;
  const today = $today.get().dayNumber;
  const segments = Array.from({ length: 30 }, (_, i) => i + 1)
    .map((d) => `<span class="seg ${d <= today ? 'fill' : ''} ${d === today ? 'now' : ''}"></span>`)
    .join('');
  const n = r.nutrition;
  const nutritionGrid = n
    ? `
      <div class="nutrition-grid">
        <div class="nutrition-cell"><span class="nutrition-cell-label">熱量</span><strong>${Math.round(n.cal)} kcal</strong></div>
        <div class="nutrition-cell"><span class="nutrition-cell-label">蛋白質</span><strong>${n.protein} g</strong></div>
        <div class="nutrition-cell"><span class="nutrition-cell-label">碳水</span><strong>${n.carb} g</strong></div>
        <div class="nutrition-cell"><span class="nutrition-cell-label">脂肪</span><strong>${n.fat} g</strong></div>
        <div class="nutrition-cell"><span class="nutrition-cell-label">膳食纖維</span><strong>${n.fiber} g</strong></div>
      </div>`
    : '<p class="nutrition-empty">本餐沒有營養素資料</p>';

  const fedRow = r.xpFedToPet > 0
    ? `<div class="dist-row dist-feed">
         <span class="ms dist-icon">pets</span>
         <span class="dist-text">餵給小綠 <strong>+${r.xpFedToPet} XP</strong></span>
       </div>`
    : '';
  const gemRow = r.gemsFromXp > 0
    ? `<div class="dist-row dist-gems">
         <span class="ms dist-icon">diamond</span>
         <span class="dist-text">今日小綠已吃飽，多的 XP 換成 <strong>+${r.gemsFromXp} 寶石</strong></span>
       </div>`
    : '';
  const emptyRow = r.xpFedToPet === 0 && r.gemsFromXp === 0
    ? `<div class="dist-row dist-empty">
         <span class="dist-text">XP 已記入今日進度</span>
       </div>`
    : '';

  wrap.innerHTML = `
    <div class="success-body">
      <div class="xp-burst" aria-hidden="true">
        <span class="xp-bubble xp-1">+${r.xpEarned} XP</span>
        ${r.luckyColorMatched ? '<span class="xp-bubble xp-2">幸運色 +15 XP</span>' : ''}
        ${replaced ? '<span class="xp-bubble xp-3">替代為植物肉</span>' : ''}
      </div>
      <div class="success-progress" aria-label="30-day progress">${segments}</div>
      <div class="success-pet">🐸</div>
      <h1 class="success-title">打卡成功！</h1>
      <p class="success-text">灰霧消散 <strong>${r.fogReductionPct}%</strong>。</p>
      <div class="success-distribution" id="success-distribution">
        ${fedRow}${gemRow}${emptyRow}
      </div>
      <div class="nutrition-details" id="nutrition-details">
        <button type="button" class="nutrition-toggle" id="nutrition-toggle" aria-expanded="false">
          <span class="ms">restaurant_menu</span>
          <span>查看營養成分</span>
          <span class="ms nutrition-chevron">expand_more</span>
        </button>
        <div class="nutrition-content" id="nutrition-content">
          ${nutritionGrid}
          <p class="nutrition-card-hint">由 AI 依本餐食材自動估算</p>
        </div>
      </div>
      <div class="success-actions">
        <button class="btn text-btn-m btn-secondary btn-l text-btn-l" id="share">
          <span class="ms">share</span>分享成果
        </button>
        <button class="btn text-btn-m btn-primary btn-l text-btn-l" id="next">繼續守護</button>
      </div>
    </div>
  `;

  const acts = [
    { ms: 1000, cls: 'act-2' },
    { ms: 2000, cls: 'act-3' },
    { ms: 3000, cls: 'settled' },
  ];
  const timers: number[] = [];
  for (const { ms, cls } of acts) {
    timers.push(window.setTimeout(() => {
      wrap.classList.remove('act-1', 'act-2', 'act-3');
      wrap.classList.add(cls);
    }, ms));
  }

  function settle() {
    timers.forEach(window.clearTimeout);
    wrap.classList.remove('act-1', 'act-2', 'act-3');
    wrap.classList.add('settled');
  }
  wrap.querySelector('.success-body')?.addEventListener('click', settle, { once: true });

  wrap.querySelector('#next')?.addEventListener('click', () => {
    timers.forEach(window.clearTimeout);
    resetCheckin();
    // First-time picker: if the user hasn't set their challenge level yet,
    // route through it once before landing on /home.
    const level = $profile.get()?.challenge_level;
    navigate(level == null ? '/onboarding/challenge-level' : '/home');
  });

  wrap.querySelector('#share')?.addEventListener('click', () => {
    void shareSummary(today, r.xpEarned, r.luckyColorMatched);
  });

  const toggle = wrap.querySelector<HTMLButtonElement>('#nutrition-toggle');
  const details = wrap.querySelector<HTMLElement>('#nutrition-details');
  toggle?.addEventListener('click', () => {
    const open = !details?.classList.contains('is-open');
    details?.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  });

  return wrap;
}

async function shareSummary(day: number, xp: number, lucky: boolean): Promise<void> {
  const meal = MEAL_LABEL[$checkin.get().mealIndex] ?? '一餐';
  const text = `我在 Yummi Go 完成第 D${day} 天 ${meal} +${xp} XP${lucky ? ' 🍀' : ''}`;
  try {
    if (navigator.share) {
      await navigator.share({ title: 'Yummi Go', text });
      return;
    }
  } catch {
    /* user cancel — fall through */
  }
  if (navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text);
      window.alert('已複製到剪貼簿');
      return;
    } catch {
      /* fall through */
    }
  }
  window.alert(text);
}
