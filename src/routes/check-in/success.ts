/**
 * Check-in step 4 — celebration.
 *
 * Three sequenced acts:
 *   ACT 1 (0–1000ms): +XP burst floats up from the pet
 *   ACT 2 (1000–2000ms): 30-day progress fills up to today
 *   ACT 3 (2000–3000ms): pet absorbs the energy, fog clears by fog_pct
 *
 * Tap anywhere on the body before ACT 3 settles → jump to settled state.
 * Continue + Share remain available throughout (CSS handles the visual
 * gating); Share uses navigator.share with clipboard fallback.
 */
import { navigate } from '@/router';
import { $checkin, resetCheckin } from '@/store/checkin';
import { $today } from '@/store/today';

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
      <p class="success-text">
        守護者吸收了 <strong>${r.xpEarned} XP</strong> 的真實能量。<br/>
        灰霧消散 <strong>${r.fogReductionPct}%</strong>。
      </p>
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
    navigate('/home');
  });

  wrap.querySelector('#share')?.addEventListener('click', () => {
    void shareSummary(today, r.xpEarned, r.luckyColorMatched);
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
