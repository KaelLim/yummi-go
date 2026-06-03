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
import { t } from '@/lib/i18n';

const MEAL_LABEL: Record<number, string> = { 1: '第一餐', 2: '第二餐', 3: '第三餐' };

export default function success(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'checkin-screen checkin-success act-1';
  const r = $checkin.get().lastResult;
  if (!r) {
    wrap.innerHTML = `
      <div class="checkin-body checkin-fallback">
        <p>${t('success.fallbackNone')}</p>
        <button class="btn text-btn-m btn-primary btn-l text-btn-l" id="back">${t('success.fallbackHome')}</button>
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
        <div class="nutrition-cell"><span class="nutrition-cell-label">${t('nutrition.calorie')}</span><strong>${Math.round(n.cal)} kcal</strong></div>
        <div class="nutrition-cell"><span class="nutrition-cell-label">${t('nutrition.protein')}</span><strong>${n.protein} g</strong></div>
        <div class="nutrition-cell"><span class="nutrition-cell-label">${t('nutrition.carb')}</span><strong>${n.carb} g</strong></div>
        <div class="nutrition-cell"><span class="nutrition-cell-label">${t('nutrition.fat')}</span><strong>${n.fat} g</strong></div>
        <div class="nutrition-cell"><span class="nutrition-cell-label">${t('nutrition.fiber')}</span><strong>${n.fiber} g</strong></div>
      </div>`
    : '<p class="nutrition-empty">—</p>';

  const fedRow = r.xpFedToPet > 0
    ? `<div class="dist-row dist-feed">
         <span class="ms dist-icon">pets</span>
         <span class="dist-text">${t('success.distFeed').replace('{xp}', String(r.xpFedToPet))}</span>
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
         <span class="dist-text">${t('success.distGems').replace('{n}', String(r.gemsFromXp))}</span>
         <span class="gem-sparkle" aria-hidden="true"><span></span><span></span><span></span></span>
       </div>`
    : '';
  const emptyRow = r.xpFedToPet === 0 && r.gemsFromXp === 0
    ? `<div class="dist-row dist-empty">
         <span class="dist-text">${t('success.distEmpty')}</span>
       </div>`
    : '';
  // Meal-complete bonus (UX_UPDATE_SPEC v0.3 §3): only set on the 3rd
  // meal of the day. Renders below the regular +XP / +gem row as a
  // second visible reward.
  const bonusRow = r.mealCompleteBonusXp > 0
    ? `<div class="dist-row dist-feed">
         <span class="ms dist-icon">workspace_premium</span>
         <span class="dist-text">${t('success.distBonus').replace('{xp}', String(r.mealCompleteBonusXp))}</span>
       </div>`
    : '';

  // First-time AHA: when this is the user's first ever check-in, lead
  // with a celebratory banner + swap the title + extra burst bubble.
  // Everything else (distribution, nutrition, actions) stays identical.
  const firstBanner = r.isFirstCheckIn
    ? `<div class="first-banner" id="first-banner">
         <span class="first-banner-emoji" aria-hidden="true">🎉</span>
         <div class="first-banner-body">
           <strong class="first-banner-title">${t('success.firstBannerTitle')}</strong>
           <span class="first-banner-sub">${t('success.firstBannerSub')}</span>
         </div>
       </div>`
    : '';
  const title = r.isFirstCheckIn ? t('success.welcome') : t('success.titleDone');
  const firstBubble = r.isFirstCheckIn
    ? `<span class="xp-bubble xp-first">${t('success.firstBubbleUnlock')}</span>`
    : '';

  wrap.innerHTML = `
    <div class="success-body">
      ${firstBanner}
      <div class="xp-burst" aria-hidden="true">
        <span class="xp-bubble xp-1">+${r.xpEarned} XP</span>
        ${firstBubble}
        ${r.luckyColorMatched ? `<span class="xp-bubble xp-2">${t('success.luckyBubble')}</span>` : ''}
        ${replaced ? `<span class="xp-bubble xp-3">${t('success.replacedBubble')}</span>` : ''}
        ${r.gemsFromXp > 0 ? `<span class="xp-bubble gem-bubble"><span class="ms">diamond</span>+${r.gemsFromXp}</span>` : ''}
      </div>
      <div class="success-progress" aria-label="30-day progress">${segments}</div>
      <div class="success-pet">🐸</div>
      <h1 class="success-title">${title}</h1>
      <div class="success-distribution" id="success-distribution">
        ${fedRow}${gemRow}${emptyRow}${bonusRow}
      </div>
      <div class="nutrition-details" id="nutrition-details">
        <button type="button" class="nutrition-toggle" id="nutrition-toggle" aria-expanded="false">
          <span class="ms">restaurant_menu</span>
          <span>${t('success.viewNutrition')}</span>
          <span class="ms nutrition-chevron">expand_more</span>
        </button>
        <div class="nutrition-content" id="nutrition-content">
          ${nutritionGrid}
          <button class="btn text-btn-m btn-secondary btn-sm text-mini ai-edit-btn" id="edit-items" type="button">
            <span class="ms">edit</span>${t('success.editItems')}
          </button>
          <p class="nutrition-card-hint">${t('nutrition.aiHint')}</p>
        </div>
      </div>
      <div class="success-secondary">
        <button class="btn text-btn-m btn-secondary btn-l text-btn-l" id="review">
          <span class="ms">rate_review</span>${t('success.review')}
        </button>
        <button class="btn text-btn-m btn-secondary btn-l text-btn-l" id="share">
          <span class="ms">share</span>${t('success.share')}
        </button>
      </div>
      <p class="success-edit-hint">${t('success.editHint')}</p>
      <div class="success-actions">
        <button class="btn text-btn-m btn-primary btn-l text-btn-l" id="next">${t('success.next')}</button>
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

  // Optional "leave a review for the restaurant you just ate at" path.
  // Sends the user to /map to pick the restaurant — we don't know which
  // place the meal came from since the check-in flow doesn't carry a
  // restaurant_id today, so the map's filter + search is the friction-
  // less landing spot.
  wrap.querySelector('#review')?.addEventListener('click', () => {
    navigate('/map');
  });

  const toggle = wrap.querySelector<HTMLButtonElement>('#nutrition-toggle');
  const details = wrap.querySelector<HTMLElement>('#nutrition-details');
  toggle?.addEventListener('click', () => {
    const open = !details?.classList.contains('is-open');
    details?.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  });

  // 修改內容 sits inside the nutrition section; tapping it sends the
  // user to 蔬食旅程 where the per-meal editor (with the spec's
  // "no later meal logged" lock) lives. Keeps a single editor surface
  // instead of duplicating logic across two screens.
  wrap.querySelector<HTMLButtonElement>('#edit-items')?.addEventListener('click', () => {
    navigate('/profile/calendar');
  });

  return wrap;
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
