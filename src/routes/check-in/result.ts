/**
 * Check-in step 3 — prototype "AI meat detection" prompt.
 *
 * Two outcomes, no nutrition card on this page:
 *   - No meat in scan → auto-submit + navigate to /check-in/success
 *   - Meat in scan    → show "偵測到肉類" banner with detected items + 是 / 否
 *       · 是 → /check-in/fail (existing meat-keeps-meat branch)
 *       · 否 → flip items to plant-based, submit, navigate to success
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
import { $user } from '@/store/user';
import { $today, $challenge, markMissionDone } from '@/store/today';
import type { MockFood } from '@/lib/mock-ai';
import { mealXp, type MealIndex } from '@/lib/xp-calc';
import { matchesLucky, normalizeLuckyColor } from '@/lib/lucky-color';
import { createCheckIn, listCheckIns } from '@/api/check-ins';
import { awardXp, reloadWallet } from '@/store/pet';

const MEAL_LABEL: Record<MealIndex, string> = { 1: '早餐', 2: '午餐', 3: '晚餐' };

export default function result(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'checkin-screen checkin-result';

  const draft = $checkin.get();
  if (!draft.scan) {
    wrap.innerHTML = `
      <div class="checkin-body checkin-fallback">
        <p>沒有可確認的辨識結果。</p>
        <button class="btn text-btn-m btn-primary btn-l text-btn-l" id="back">回到拍照</button>
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
        <span class="checkin-title">辨識結果</span>
        <span class="checkin-meal">${MEAL_LABEL[draft.mealIndex]}</span>
      </header>
      <div class="checkin-body checkin-veg-pass">
        <span class="ms checkin-veg-icon">eco</span>
        <h2 class="checkin-veg-title">無肉檢出</h2>
        <p class="checkin-veg-text">食物精靈正在記錄打卡…</p>
      </div>
    `;
    void submitCheckin(wrap);
    return wrap;
  }

  wrap.innerHTML = `
    <header class="checkin-header">
      <button class="checkin-back" id="back-btn" aria-label="返回">
        <span class="ms">arrow_back</span>
      </button>
      <span class="checkin-title">辨識結果</span>
      <span class="checkin-meal">${MEAL_LABEL[draft.mealIndex]}</span>
    </header>
    <div class="checkin-body">
      <div class="meat-banner" id="meat-banner">
        <span class="ms">help</span>
        <div class="meat-banner-body">
          <strong>偵測到肉類食材</strong>
          <p id="meat-list">${escapeHtml(meatNames.join('、'))}</p>
          <p class="meat-banner-hint">要保留還是用植物肉替換？</p>
        </div>
        <div class="meat-banner-actions">
          <button class="btn text-btn-m btn-sm text-mini btn-secondary" id="meat-yes">是</button>
          <button class="btn text-btn-m btn-sm text-mini btn-primary" id="meat-no">否</button>
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
  const u = $user.get();
  if (!u) {
    navigate('/login');
    return;
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
    } catch {
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
      const award = await awardXp(u.id, xp, 'check_in', checkInRow.id);
      xpFedToPet = award.xpFedToPet;
      gemsFromXp = award.gemsFromXp;
      void reloadWallet(u.id);
    } catch {
      /* server XP soft fail — UI still shows xpEarned via the burst */
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
    });
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
