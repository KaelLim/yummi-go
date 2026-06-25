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

  // First-time AHA: when this is the user's first ever check-in, lead
  // with a celebratory banner + swap the title.
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

  // Hero replaces the pet sprite — a big XP icon + the amount earned.
  // Floating XP-burst bubbles + the 獲得多少能量 distribution row are
  // intentionally gone: the hero already carries that info and the
  // user wanted a calmer success page (2026-06-18 brief).
  wrap.innerHTML = `
    <div class="success-body">
      ${firstBanner}
      <div class="success-xp-hero" aria-live="polite">
        <img class="success-xp-icon" src="/icons/xp.svg" alt="XP" width="56" height="70" draggable="false" />
        <span class="success-xp-amount">+${r.xpEarned} XP</span>
      </div>
      <h1 class="success-title">${title}</h1>
      <div class="nutrition-details is-open" id="nutrition-details">
        <div class="nutrition-content" id="nutrition-content">
          ${nutritionGrid}
          <p class="nutrition-card-hint">${t('nutrition.aiHint')}</p>
          <p class="nutrition-edit-concern">${t('success.editConcern')}</p>
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
    }, ms));
  }

  function settle() {
    timers.forEach(window.clearTimeout);
    wrap.classList.remove('act-1', 'act-2', 'act-3');
    wrap.classList.add('settled');
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
    void shareSummary($today.get().dayNumber, r.xpEarned, r.luckyColorMatched);
  });

  // Optional "leave a review for the restaurant you just ate at" path.
  // Sends the user to /map to pick the restaurant — we don't know which
  // place the meal came from since the check-in flow doesn't carry a
  // restaurant_id today, so the map's filter + search is the friction-
  // less landing spot.
  wrap.querySelector('#review')?.addEventListener('click', () => {
    navigate('/map');
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
