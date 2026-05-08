/**
 * Check-in step 3 — review and confirm scanned ingredients.
 *
 * Three concerns layered onto one screen:
 *   1. Edit list — user can tweak each item's weight, remove an item, or
 *      add a custom one (free-text fallback).
 *   2. Meat-detection branch — if the mock scanner included a meat item,
 *      the top banner asks "這是肉嗎？". 是 routes to a fail message; 否
 *      flips the offending items to plant-based and tags
 *      `wasMeatReplaced=true` (used for the "替代為植物肉" success copy).
 *   3. Submit — picks a meal index, computes XP via xp-calc, lucky-color
 *      match via lucky-color, posts createCheckIn, awards XP, marks the
 *      mission, then routes to /check-in/success.
 *
 * Pure logic for XP/match lives in the libs; this route is glue + UI.
 */
import { navigate } from '@/router';
import {
  $checkin,
  setItems,
  setVeganType,
  setMeatReplaced,
  setLastResult,
  resetCheckin,
  type CheckinDraft,
} from '@/store/checkin';
import { $user } from '@/store/user';
import { $today, $challenge, markMissionDone } from '@/store/today';
import type { MockFood } from '@/lib/mock-ai';
import { mealXp, type MealIndex } from '@/lib/xp-calc';
import { matchesLucky, normalizeLuckyColor } from '@/lib/lucky-color';
import { createCheckIn } from '@/api/check-ins';
import { awardXp } from '@/store/pet';
import { bind } from '@/lib/lifecycle';

const VEGAN_TYPES: Array<NonNullable<CheckinDraft['veganType']>> = [
  '全素',
  '蛋奶素',
  '五辛素',
  '鍋邊素',
];

const MEAL_LABEL: Record<MealIndex, string> = { 1: '早餐', 2: '午餐', 3: '晚餐' };

export default function result(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'checkin-screen checkin-result';

  if (!$checkin.get().scan) {
    wrap.innerHTML = `
      <div class="checkin-body checkin-fallback">
        <p>沒有可確認的辨識結果。</p>
        <button class="btn btn-primary btn-l" id="back">回到拍照</button>
      </div>
    `;
    wrap.querySelector('#back')?.addEventListener('click', () => navigate('/check-in'));
    return wrap;
  }

  wrap.innerHTML = `
    <header class="checkin-header">
      <button class="checkin-back" id="back-btn" aria-label="返回">
        <span class="ms">arrow_back</span>
      </button>
      <span class="checkin-title">辨識結果</span>
      <span class="checkin-meal" id="meal-tag"></span>
    </header>
    <div class="checkin-body">
      <div class="meat-banner" id="meat-banner" hidden>
        <span class="ms">help</span>
        <div class="meat-banner-body">
          <strong>偵測到肉類食材</strong>
          <p id="meat-list"></p>
        </div>
        <div class="meat-banner-actions">
          <button class="btn btn-sm btn-secondary" id="meat-yes">是</button>
          <button class="btn btn-sm btn-primary" id="meat-no">否，替代為植物肉</button>
        </div>
      </div>

      <ul class="result-list" id="items-list"></ul>

      <button class="result-add" id="add-food">
        <span class="ms">add</span>新增食物
      </button>

      <div class="result-section">
        <span class="result-section-label">素別</span>
        <div class="vegan-chips" id="vegan-chips">
          ${VEGAN_TYPES.map(
            (v) => `<button class="vegan-chip" data-value="${v}">${v}</button>`,
          ).join('')}
        </div>
      </div>

      <div class="result-summary" id="summary"></div>
    </div>
    <div class="checkin-footer">
      <button class="btn btn-primary btn-l" id="confirm-btn">確認打卡</button>
    </div>
  `;

  function renderItems(items: MockFood[]) {
    const ul = wrap.querySelector<HTMLUListElement>('#items-list')!;
    ul.innerHTML = items
      .map(
        (it, i) => `
        <li class="result-item" data-i="${i}">
          <div class="result-item-head">
            <span class="result-item-name">${escapeHtml(it.name)}${it.isVeg ? '' : '<span class="result-meat-tag">肉</span>'}</span>
            <button class="result-item-remove" data-remove="${i}" aria-label="移除">
              <span class="ms">close</span>
            </button>
          </div>
          <div class="result-item-body">
            <label class="result-item-weight">
              <span>克</span>
              <input type="number" min="0" step="1" value="${it.weightG}" data-weight="${i}" />
            </label>
            <span class="result-item-cal">${Math.round(estimateCal(it))} kcal</span>
          </div>
        </li>`,
      )
      .join('');

    ul.querySelectorAll<HTMLInputElement>('input[data-weight]').forEach((inp) => {
      inp.addEventListener('input', () => {
        const idx = Number(inp.dataset.weight);
        const cur = $checkin.get().items.slice();
        const food = cur[idx];
        if (!food) return;
        const next = Math.max(0, Number(inp.value) || 0);
        cur[idx] = { ...food, weightG: next };
        setItems(cur);
      });
    });
    ul.querySelectorAll<HTMLButtonElement>('[data-remove]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.remove);
        const cur = $checkin.get().items.slice();
        cur.splice(idx, 1);
        setItems(cur);
      });
    });
  }

  function renderMeatBanner(items: MockFood[], replaced: boolean) {
    const banner = wrap.querySelector<HTMLElement>('#meat-banner')!;
    const listEl = wrap.querySelector<HTMLElement>('#meat-list')!;
    const meats = items.filter((i) => !i.isVeg);
    if (meats.length === 0 || replaced) {
      banner.hidden = true;
    } else {
      banner.hidden = false;
      listEl.textContent = meats.map((m) => m.name).join('、');
    }
  }

  function renderChips(selected: CheckinDraft['veganType']) {
    wrap.querySelectorAll<HTMLButtonElement>('.vegan-chip').forEach((c) => {
      c.classList.toggle('selected', c.dataset.value === selected);
    });
  }

  function renderSummary(d: CheckinDraft) {
    const total = d.items.reduce((sum, it) => sum + estimateCal(it), 0);
    const day = $today.get().dayNumber;
    const cur = $challenge.get().currentDay;
    const lucky = normalizeLuckyColor(cur?.lucky_color ?? '');
    const palette = d.items.flatMap((it) => it.colors);
    const luckyMatch = lucky ? matchesLucky(palette, lucky) : false;
    const meal = $checkin.get().mealIndex;
    const baseXp = mealXp(meal, 3);
    const xp = baseXp + (luckyMatch ? 15 : 0);
    wrap.querySelector('#meal-tag')!.textContent = MEAL_LABEL[meal];
    const summary = wrap.querySelector<HTMLElement>('#summary')!;
    summary.innerHTML = `
      <div class="summary-row"><span>總熱量</span><strong>${Math.round(total)} kcal</strong></div>
      <div class="summary-row"><span>今日 D${day}</span><strong>${MEAL_LABEL[meal]} +${baseXp} XP</strong></div>
      ${luckyMatch ? '<div class="summary-row lucky-hit"><span>幸運色命中</span><strong>+15 XP</strong></div>' : ''}
      <div class="summary-row total"><span>本餐合計</span><strong>${xp} XP</strong></div>
    `;
  }

  function rerender() {
    const d = $checkin.get();
    renderItems(d.items);
    renderMeatBanner(d.items, d.wasMeatReplaced);
    renderChips(d.veganType);
    renderSummary(d);
  }

  bind(wrap, $checkin, rerender);

  wrap.querySelector('#back-btn')?.addEventListener('click', () => navigate('/check-in'));

  wrap.querySelector('#meat-yes')?.addEventListener('click', () => {
    resetCheckin();
    alert('今天的挑戰失敗了，明天再加油！');
    navigate('/home');
  });

  wrap.querySelector('#meat-no')?.addEventListener('click', () => {
    const cur = $checkin.get().items.map((it) => (it.isVeg ? it : { ...it, isVeg: true }));
    setItems(cur);
    setMeatReplaced(true);
  });

  wrap.querySelectorAll<HTMLButtonElement>('.vegan-chip').forEach((c) => {
    c.addEventListener('click', () => {
      const v = c.dataset.value as CheckinDraft['veganType'];
      setVeganType(v);
    });
  });

  wrap.querySelector('#add-food')?.addEventListener('click', () => {
    const name = prompt('請輸入食物名稱');
    if (!name) return;
    const weightStr = prompt('重量 (g)?', '50');
    const weight = Math.max(0, Number(weightStr) || 50);
    const food: MockFood = {
      name,
      cal: 0,
      protein: 0,
      carb: 0,
      fat: 0,
      fiber: 0,
      isVeg: true,
      colors: [],
      weightG: weight,
    };
    setItems([...$checkin.get().items, food]);
  });

  wrap.querySelector('#confirm-btn')?.addEventListener('click', () => {
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
    alert('請至少保留一項食材');
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

  const btn = wrap.querySelector<HTMLButtonElement>('#confirm-btn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = '送出中…';
  }

  try {
    await createCheckIn({
      userId: u.id,
      dayNumber: day,
      mealIndex: d.mealIndex,
      foodItems: d.items,
      nutrition: aggregateNutrition(d.items),
      veganType,
      wasMeatReplaced: d.wasMeatReplaced,
      luckyColorMatched: luckyMatch,
      xpEarned: xp,
      gemsEarned: 0,
    });
    markMissionDone(`meal:${d.mealIndex === 1 ? 'breakfast' : d.mealIndex === 2 ? 'lunch' : 'dinner'}`, xp);
    try { await awardXp(u.id, xp); } catch { /* server XP soft fail */ }
    setLastResult({ xpEarned: xp, luckyColorMatched: luckyMatch, fogReductionPct });
    navigate('/check-in/success');
  } catch (err) {
    console.error('[check-in] submit failed:', err);
    if (btn) {
      btn.disabled = false;
      btn.textContent = '確認打卡';
    }
    alert('打卡失敗，請稍後再試');
  }
}

function estimateCal(it: MockFood): number {
  // FOOD_BANK base cal is per 100g; weightG carries actual portion.
  return (it.cal * it.weightG) / 100;
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
