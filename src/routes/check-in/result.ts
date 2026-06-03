/**
 * Check-in step 3 — prototype "AI meat detection" prompt.
 *
 * Two outcomes, no nutrition card on this page:
 *   - No meat in scan → auto-submit + navigate to /check-in/success
 *   - Meat in scan    → centered prompt: "我們偵測到 <items>，這是肉嗎？"
 *       · 這是肉           → /check-in/fail (existing meat-keeps-meat branch)
 *       · 不，這是植物肉    → flip items to plant-based, submit, navigate
 *                            to success
 *
 * The full review (items list, vegan chips, summary, edit mode) is gone —
 * this is the prototype-friendly path. Nutrition lives on the success page
 * behind a "read more" reveal so the user can still inspect it after the
 * fact.
 */
import { navigate } from '@/router';
import {
  $checkin,
  setItems,
  setMeatReplaced,
  setLastResult,
} from '@/store/checkin';
import { $user, setLoggedInUser } from '@/store/user';
import { registerGuest } from '@/api/auth';
import { $today, $challenge, markMissionDone } from '@/store/today';
import { MEAL_COMPLETE_BONUS_KEY, MEAL_COMPLETE_BONUS_XP } from '@/lib/xp-calc';
import type { MockFood } from '@/lib/mock-ai';
import { mealXp, type MealIndex } from '@/lib/xp-calc';
import { matchesLucky, normalizeLuckyColor } from '@/lib/lucky-color';
import { createCheckIn, listCheckIns } from '@/api/check-ins';
import { awardXp } from '@/store/pet';
import { t } from '@/lib/i18n';

const MEAL_LABEL_KEY: Record<MealIndex, string> = { 1: 'checkin.meal1', 2: 'checkin.meal2', 3: 'checkin.meal3' };
function mealLabel(idx: MealIndex): string {
  return t(MEAL_LABEL_KEY[idx]);
}

export default function result(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'checkin-screen checkin-result';

  const draft = $checkin.get();
  if (!draft.scan) {
    wrap.innerHTML = `
      <div class="checkin-body checkin-fallback">
        <p>${t('checkin.fallbackNoScan')}</p>
        <button class="btn text-btn-m btn-primary btn-l text-btn-l" id="back">${t('checkin.fallbackBack')}</button>
      </div>
    `;
    wrap.querySelector('#back')?.addEventListener('click', () => navigate('/check-in'));
    return wrap;
  }

  const meatNames = draft.items.filter((i) => !i.isVeg).map((m) => m.name);
  const hasMeat = meatNames.length > 0;

  if (!hasMeat) {
    // No meat — straight to success, no choices to make.
    wrap.innerHTML = `
      <header class="checkin-header">
        <span class="checkin-title">${t('checkin.resultTitle')}</span>
        <span class="checkin-meal">${mealLabel(draft.mealIndex)}</span>
      </header>
      <div class="checkin-body checkin-veg-pass">
        <span class="ms checkin-veg-icon">eco</span>
        <h2 class="checkin-veg-title">${t('checkin.noMeatTitle')}</h2>
        <p class="checkin-veg-text">${t('checkin.noMeatText')}</p>
      </div>
    `;
    void submitCheckin(wrap);
    return wrap;
  }

  wrap.innerHTML = `
    <header class="checkin-header">
      <button class="checkin-back" id="back-btn" aria-label="${t('common.back')}">
        <span class="ms">arrow_back</span>
      </button>
      <span class="checkin-title">${t('checkin.resultTitle')}</span>
      <span class="checkin-meal">${mealLabel(draft.mealIndex)}</span>
    </header>
    <div class="checkin-body">
      <div class="checkin-meat-prompt" id="meat-banner">
        <h2 class="meat-prompt-title">${t('checkin.detected').replace('{items}', `<strong id="meat-list">${escapeHtml(meatNames.join('、'))}</strong>`)}</h2>
        <p class="meat-prompt-question">${t('checkin.isMeatQ')}</p>
        <div class="meat-prompt-actions">
          <button class="btn text-btn-m btn-secondary btn-l text-btn-l" id="meat-yes">${t('checkin.isMeatYes')}</button>
          <button class="btn text-btn-m btn-primary btn-l text-btn-l" id="meat-no">${t('checkin.isMeatNo')}</button>
        </div>
      </div>
    </div>
  `;

  wrap.querySelector('#back-btn')?.addEventListener('click', () => navigate('/check-in'));

  wrap.querySelector('#meat-yes')?.addEventListener('click', () => {
    navigate('/check-in/fail');
  });

  wrap.querySelector('#meat-no')?.addEventListener('click', () => {
    // Replace meat items with their plant-based counterparts, then submit
    // without showing any extra review UI on this page.
    const replaced = $checkin.get().items.map((it) => (it.isVeg ? it : { ...it, isVeg: true }));
    setItems(replaced);
    setMeatReplaced(true);
    void submitCheckin(wrap);
  });

  return wrap;
}

async function submitCheckin(wrap: HTMLElement): Promise<void> {
  // Session may be missing if drust pruned the previous guest row or
  // localStorage was cleared. Provision a fresh guest inline so the
  // user's check-in just goes through without being bounced to /login.
  // Falls back to /login only if guest registration itself fails (drust
  // unreachable, anon-cap denial, etc.).
  let u = $user.get();
  if (!u) {
    try {
      const guest = await registerGuest();
      setLoggedInUser(guest);
      u = { id: guest.id, username: guest.username, displayName: guest.displayName };
    } catch (err) {
      console.error('[checkin/result] auto guest registration failed:', err);
      navigate('/login');
      return;
    }
  }
  const d = $checkin.get();
  if (d.items.length === 0) {
    navigate('/check-in');
    return;
  }

  const day = $today.get().dayNumber;
  const cur = $challenge.get().currentDay;
  const luckyEn = normalizeLuckyColor(cur?.lucky_color ?? '');
  const palette = d.items.flatMap((it) => it.colors);
  const luckyMatch = luckyEn ? matchesLucky(palette, luckyEn) : false;
  const baseXp = mealXp(d.mealIndex, 3);
  const xp = baseXp + (luckyMatch ? 15 : 0);
  const fogReductionPct = cur?.fog_reduction_pct ?? 1;
  const veganType = d.veganType ?? '全素';
  const nutrition = aggregateNutrition(d.items);

  try {
    // Pre-flight: is this the user's very first check-in? Used by /success
    // for "🎉 第一次打卡" framing. listCheckIns is cheap (typically returns
    // [] for a brand-new user), and we run it before createCheckIn so we
    // see pre-insert state.
    let isFirstCheckIn = false;
    try {
      const prior = await listCheckIns(u.id);
      isFirstCheckIn = prior.length === 0;
      console.log('[phase1] result.ts: listCheckIns count=', prior.length, 'isFirstCheckIn=', isFirstCheckIn);
    } catch (err) {
      console.warn('[phase1] result.ts: listCheckIns failed', err);
      /* soft fail — fall back to non-first treatment */
    }

    const checkInRow = await createCheckIn({
      userId: u.id,
      dayNumber: day,
      mealIndex: d.mealIndex,
      foodItems: d.items,
      nutrition,
      veganType,
      wasMeatReplaced: d.wasMeatReplaced,
      luckyColorMatched: luckyMatch,
      xpEarned: xp,
      gemsEarned: 0,
    });
    markMissionDone(
      `meal:${d.mealIndex === 1 ? 'breakfast' : d.mealIndex === 2 ? 'lunch' : 'dinner'}`,
      xp,
    );
    if (luckyMatch) markMissionDone('lucky:hit', 0);

    // XP auto-distribution lives inside awardXp: it credits the wallet,
    // feeds the pet up to PET_DAILY_XP_CAP for the day, and converts any
    // leftover to gems at 1:1. We just surface the breakdown for the
    // success page; no manual feed/convert buttons anymore.
    let xpFedToPet = 0;
    let gemsFromXp = 0;
    try {
      // awardXp does the full credit → feed → convert chain and syncs
      // $pet + $gems locally, so no reloadWallet/reloadPet needed here.
      const award = await awardXp(u.id, xp, 'check_in', checkInRow.id);
      xpFedToPet = award.xpFedToPet;
      gemsFromXp = award.gemsFromXp;
    } catch {
      /* server XP soft fail — UI still shows xpEarned via the burst */
    }

    // Meal-complete bonus (UX_UPDATE_SPEC v0.3 §3): when this submit
    // brings all three meal slots to done for the day, fire a separate
    // +10 XP transaction so it appears as its own line on the success
    // page. The check-in's own markMissionDone above is already in
    // $today, so this is the moment to ask "are we now 3/3?".
    let mealCompleteBonusXp = 0;
    const tNow = $today.get();
    const allThree = ['breakfast', 'lunch', 'dinner'].every(
      (k) => tNow.missionsDone.includes(`meal:${k}`) || tNow.missionsDone.includes(k),
    );
    if (allThree && !tNow.missionsDone.includes(MEAL_COMPLETE_BONUS_KEY)) {
      try {
        await awardXp(u.id, MEAL_COMPLETE_BONUS_XP, 'mission', null);
        markMissionDone(MEAL_COMPLETE_BONUS_KEY, MEAL_COMPLETE_BONUS_XP);
        mealCompleteBonusXp = MEAL_COMPLETE_BONUS_XP;
      } catch {
        /* soft fail — XP bar will just not include the +10 */
      }
    }

    setLastResult({
      checkInId: checkInRow.id,
      xpEarned: xp,
      luckyColorMatched: luckyMatch,
      fogReductionPct,
      xpFedToPet,
      gemsFromXp,
      items: d.items,
      nutrition,
      isFirstCheckIn,
      mealCompleteBonusXp,
    });
    // Arm the phase-1 commitment modal as soon as we know it's the
    // user's first check-in. success.ts also sets this as a safety net,
    // but setting it here means it survives even if the user
    // backs out of /check-in/success before that render completes.
    if (isFirstCheckIn) {
      try {
        localStorage.setItem('yummi:phase1_modal_pending', '1');
        console.log('[phase1] result.ts: flag set, current value=', localStorage.getItem('yummi:phase1_modal_pending'));
      } catch (err) {
        console.warn('[phase1] result.ts: flag set failed', err);
      }
    }
    navigate('/check-in/success');
  } catch (err) {
    console.error('[check-in] submit failed:', err);
    const body = wrap.querySelector<HTMLElement>('.checkin-body');
    if (body) {
      body.innerHTML = `
        <div class="checkin-fallback">
          <p>打卡失敗，請稍後再試。</p>
          <button class="btn text-btn-m btn-primary btn-l text-btn-l" id="retry">回到拍照</button>
        </div>
      `;
      body.querySelector('#retry')?.addEventListener('click', () => navigate('/check-in'));
    }
  }
}

function aggregateNutrition(items: MockFood[]): {
  cal: number;
  protein: number;
  carb: number;
  fat: number;
  fiber: number;
} {
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

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === '&'
      ? '&amp;'
      : c === '<'
        ? '&lt;'
        : c === '>'
          ? '&gt;'
          : c === '"'
            ? '&quot;'
            : '&#39;',
  );
}
