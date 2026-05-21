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
import { $checkin, resetCheckin, setLastResult } from '@/store/checkin';
import { $today } from '@/store/today';
import { $profile } from '@/store/user';
import { updateCheckInItems } from '@/api/check-ins';
import type { MockFood } from '@/lib/mock-ai';

const MEAL_LABEL: Record<number, string> = { 1: '第一餐', 2: '第二餐', 3: '第三餐' };

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
  // Three cases for the gem half of the distribution row:
  //   1. xpFedToPet > 0 && gemsFromXp > 0  → this is the call that
  //      *crossed* 100 XP today. Suppress the row entirely — the
  //      milestone popup on the next home mount handles the storytelling.
  //   2. xpFedToPet === 0 && gemsFromXp > 0 → user is already past the
  //      cap for today; every subsequent earn auto-converts. Show a
  //      compact "+N 💎" indicator (no 小綠 explanation).
  //   3. gemsFromXp === 0 → no row.
  const crossedThisCall = r.xpFedToPet > 0 && r.gemsFromXp > 0;
  const gemRow = !crossedThisCall && r.gemsFromXp > 0
    ? `<div class="dist-row dist-gems">
         <span class="ms dist-icon">diamond</span>
         <span class="dist-text">+<strong data-gem-count="${r.gemsFromXp}">0</strong> 能量石</span>
         <span class="gem-sparkle" aria-hidden="true"><span></span><span></span><span></span></span>
       </div>`
    : '';
  const emptyRow = r.xpFedToPet === 0 && r.gemsFromXp === 0
    ? `<div class="dist-row dist-empty">
         <span class="dist-text">XP 已記入今日進度</span>
       </div>`
    : '';

  // First-time AHA: when this is the user's first ever check-in, lead
  // with a celebratory banner + swap the title + extra burst bubble.
  // Everything else (distribution, nutrition, actions) stays identical.
  const firstBanner = r.isFirstCheckIn
    ? `<div class="first-banner" id="first-banner">
         <span class="first-banner-emoji" aria-hidden="true">🎉</span>
         <div class="first-banner-body">
           <strong class="first-banner-title">第一次打卡完成！</strong>
           <span class="first-banner-sub">小綠剛剛吃到第一口 XP，跟你的 30 天挑戰一起開始 🌱</span>
         </div>
       </div>`
    : '';
  const title = r.isFirstCheckIn ? '歡迎踏出第一步！' : '打卡成功！';
  const firstBubble = r.isFirstCheckIn
    ? '<span class="xp-bubble xp-first">🎉 首次打卡 +XP 解鎖</span>'
    : '';

  wrap.innerHTML = `
    <div class="success-body">
      ${firstBanner}
      <div class="xp-burst" aria-hidden="true">
        <span class="xp-bubble xp-1">+${r.xpEarned} XP</span>
        ${firstBubble}
        ${r.luckyColorMatched ? '<span class="xp-bubble xp-2">幸運色 +15 XP</span>' : ''}
        ${replaced ? '<span class="xp-bubble xp-3">替代為植物肉</span>' : ''}
        ${r.gemsFromXp > 0 ? `<span class="xp-bubble gem-bubble"><span class="ms">diamond</span>+${r.gemsFromXp}</span>` : ''}
      </div>
      <div class="success-progress" aria-label="30-day progress">${segments}</div>
      <div class="success-pet">🐸</div>
      <h1 class="success-title">${title}</h1>
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
      <div class="success-secondary">
        <button class="btn text-btn-m btn-secondary btn-l text-btn-l" id="edit-items">
          <span class="ms">edit</span>修改內容
        </button>
        <button class="btn text-btn-m btn-secondary btn-l text-btn-l" id="share">
          <span class="ms">share</span>分享成果
        </button>
      </div>
      <div class="success-actions">
        <button class="btn text-btn-m btn-primary btn-l text-btn-l" id="next">繼續守護</button>
      </div>
    </div>
    <div class="edit-sheet" id="edit-sheet" hidden role="dialog" aria-modal="true" aria-labelledby="edit-sheet-title">
      <div class="edit-sheet-card">
        <h2 class="edit-sheet-title text-h3" id="edit-sheet-title">修改本餐內容</h2>
        <p class="edit-sheet-sub text-mini">調整 AI 辨識的食材與份量（不會影響已發放的 XP）</p>
        <div class="edit-sheet-list" id="edit-sheet-list"></div>
        <button type="button" class="edit-sheet-add" id="edit-sheet-add">
          <span class="ms">add</span>新增食材
        </button>
        <p class="edit-sheet-error" id="edit-sheet-error" hidden></p>
        <div class="edit-sheet-actions">
          <button type="button" class="btn text-btn-m btn-secondary btn-l text-btn-l" id="edit-sheet-cancel">取消</button>
          <button type="button" class="btn text-btn-m btn-primary btn-l text-btn-l" id="edit-sheet-save">儲存</button>
        </div>
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
      if (cls === 'act-3') startGemCountUp(wrap);
    }, ms));
  }

  function settle() {
    timers.forEach(window.clearTimeout);
    wrap.classList.remove('act-1', 'act-2', 'act-3');
    wrap.classList.add('settled');
    startGemCountUp(wrap);
  }
  wrap.querySelector('.success-body')?.addEventListener('click', settle, { once: true });

  function advance(): void {
    timers.forEach(window.clearTimeout);
    resetCheckin();
    // First-time picker: if the user hasn't set their meal schedule yet,
    // route through /onboarding/eat-times once before landing on /home.
    // The 挑戰難度 picker was removed from onboarding (2026-05-19), so the
    // post-check-in setup chain is just eat-times now.
    const eatTimes = $profile.get()?.eat_times;
    navigate(eatTimes ? '/home' : '/onboarding/eat-times');
  }

  // First check-in: arm the phase-1 modal flag so home shows the 30-day
  // framing on the user's first home visit after onboarding + this
  // check-in. We set it as a side-effect of mounting the success page
  // rather than waiting for the 繼續守護 tap, so the flag survives even
  // if the user navigates around before reaching home.
  if (r.isFirstCheckIn) {
    try { localStorage.setItem('yummi:phase1_modal_pending', '1'); } catch { /* private mode */ }
  }

  wrap.querySelector('#next')?.addEventListener('click', () => {
    advance();
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

  wireEditSheet(wrap);

  return wrap;
}

function wireEditSheet(wrap: HTMLElement): void {
  const openBtn = wrap.querySelector<HTMLButtonElement>('#edit-items');
  const sheet = wrap.querySelector<HTMLElement>('#edit-sheet');
  const list = wrap.querySelector<HTMLElement>('#edit-sheet-list');
  const addBtn = wrap.querySelector<HTMLButtonElement>('#edit-sheet-add');
  const cancelBtn = wrap.querySelector<HTMLButtonElement>('#edit-sheet-cancel');
  const saveBtn = wrap.querySelector<HTMLButtonElement>('#edit-sheet-save');
  const errorEl = wrap.querySelector<HTMLElement>('#edit-sheet-error');
  if (!openBtn || !sheet || !list || !addBtn || !cancelBtn || !saveBtn || !errorEl) return;

  // Working copy — committed back to lastResult only on save.
  let working: MockFood[] = [];

  function renderList(): void {
    if (!list) return;
    list.innerHTML = working
      .map(
        (it, i) => `
        <div class="edit-row" data-index="${i}">
          <input class="input edit-row-name" type="text" maxlength="24" value="${escapeHtml(it.name)}" placeholder="食材名稱" />
          <input class="input edit-row-weight" type="number" min="0" step="10" value="${it.weightG}" inputmode="numeric" />
          <span class="edit-row-unit text-mini">g</span>
          <button type="button" class="edit-row-remove" aria-label="移除"><span class="ms">close</span></button>
        </div>
      `,
      )
      .join('');

    list.querySelectorAll<HTMLInputElement>('.edit-row-name').forEach((el, i) => {
      el.addEventListener('input', () => { working[i] = { ...working[i], name: el.value }; });
    });
    list.querySelectorAll<HTMLInputElement>('.edit-row-weight').forEach((el, i) => {
      el.addEventListener('input', () => {
        const w = Math.max(0, Number(el.value) || 0);
        working[i] = { ...working[i], weightG: w };
      });
    });
    list.querySelectorAll<HTMLButtonElement>('.edit-row-remove').forEach((el, i) => {
      el.addEventListener('click', () => {
        working.splice(i, 1);
        renderList();
      });
    });
  }

  function showError(msg: string): void {
    if (!errorEl) return;
    errorEl.hidden = false;
    errorEl.textContent = msg;
  }

  function close(): void {
    if (sheet) sheet.hidden = true;
    if (errorEl) errorEl.hidden = true;
  }

  openBtn.addEventListener('click', () => {
    const r = $checkin.get().lastResult;
    if (!r) return;
    // Deep-ish copy so we can scratch in the working list without
    // mutating the stored result until the user explicitly saves.
    working = r.items.map((it) => ({ ...it }));
    renderList();
    if (sheet) sheet.hidden = false;
  });

  addBtn.addEventListener('click', () => {
    working.push({
      name: '',
      cal: 50,
      protein: 2,
      carb: 8,
      fat: 1,
      fiber: 1,
      isVeg: true,
      colors: ['green'],
      weightG: 100,
    });
    renderList();
  });

  cancelBtn.addEventListener('click', close);

  saveBtn.addEventListener('click', async () => {
    const cleaned = working
      .map((it) => ({ ...it, name: it.name.trim() }))
      .filter((it) => it.name.length > 0);
    if (cleaned.length === 0) {
      showError('至少保留一項食材');
      return;
    }
    const r = $checkin.get().lastResult;
    if (!r) return;
    const nutrition = aggregateNutrition(cleaned);
    saveBtn.disabled = true;
    saveBtn.textContent = '儲存中…';
    try {
      if (r.checkInId !== null) {
        await updateCheckInItems(r.checkInId, cleaned, nutrition);
      }
      setLastResult({ ...r, items: cleaned, nutrition });
      // Re-render the nutrition grid so the user sees the new totals
      // without leaving the screen.
      refreshNutritionGrid(wrap, nutrition);
      close();
    } catch (err) {
      console.error('[success] save edit failed:', err);
      showError('儲存失敗，請稍後再試');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = '儲存';
    }
  });
}

function aggregateNutrition(items: MockFood[]) {
  const acc = { cal: 0, protein: 0, carb: 0, fat: 0, fiber: 0 };
  for (const it of items) {
    const m = it.weightG / 100;
    acc.cal += it.cal * m;
    acc.protein += it.protein * m;
    acc.carb += it.carb * m;
    acc.fat += it.fat * m;
    acc.fiber += it.fiber * m;
  }
  for (const k of Object.keys(acc) as Array<keyof typeof acc>) {
    acc[k] = Math.round(acc[k] * 10) / 10;
  }
  return acc;
}

function refreshNutritionGrid(
  wrap: HTMLElement,
  n: { cal: number; protein: number; carb: number; fat: number; fiber: number },
): void {
  const grid = wrap.querySelector<HTMLElement>('.nutrition-grid');
  if (!grid) return;
  grid.innerHTML = `
    <div class="nutrition-cell"><span class="nutrition-cell-label">熱量</span><strong>${Math.round(n.cal)} kcal</strong></div>
    <div class="nutrition-cell"><span class="nutrition-cell-label">蛋白質</span><strong>${n.protein} g</strong></div>
    <div class="nutrition-cell"><span class="nutrition-cell-label">碳水</span><strong>${n.carb} g</strong></div>
    <div class="nutrition-cell"><span class="nutrition-cell-label">脂肪</span><strong>${n.fat} g</strong></div>
    <div class="nutrition-cell"><span class="nutrition-cell-label">膳食纖維</span><strong>${n.fiber} g</strong></div>
  `;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;'
      : c === '<' ? '&lt;'
      : c === '>' ? '&gt;'
      : c === '"' ? '&quot;'
      : '&#39;',
  );
}

function startGemCountUp(wrap: HTMLElement): void {
  const el = wrap.querySelector<HTMLElement>('.dist-gems strong[data-gem-count]');
  if (!el || el.dataset.gemAnimated === '1') return;
  const target = Number(el.dataset.gemCount) || 0;
  el.dataset.gemAnimated = '1';
  if (target <= 0) {
    el.textContent = '+0 寶石';
    return;
  }
  const duration = 700;
  const start = performance.now();
  function step(now: number): void {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    const value = Math.round(target * eased);
    el!.textContent = `+${value} 寶石`;
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
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
