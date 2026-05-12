/**
 * Check-in step 3 — review and confirm scanned ingredients.
 *
 * Three stages keyed off whether the scan contains meat:
 *   1. `veg`            — no meat detected. Original flow: items list,
 *                         vegan chips, summary, confirm button all shown.
 *   2. `meat-pending`   — meat detected, user hasn't answered yet. Only the
 *                         banner with 是 / 否 is visible; the rest of the UI
 *                         is hidden to keep the choice in focus.
 *   3. `meat-replaced`  — user picked 否. Banner hides. An auto-derived
 *                         nutrition card slides in (animation), the pet
 *                         pops a speech bubble ("想調整餐點？" + button),
 *                         and the confirm button surfaces. Tapping 修改餐點
 *                         reveals the editable list / vegan chips / summary
 *                         for fine-tuning before submit. The 是 branch still
 *                         routes straight to /check-in/fail.
 *
 * The "nutrition card" is read-only because it represents what the AI
 * computed; users only edit it indirectly via 修改餐點 (which lets them
 * tweak quantities or add items, then recomputes the card on the fly).
 *
 * Pure logic for XP / lucky-match lives in the libs; this route is glue.
 */
import { navigate } from '@/router';
import {
  $checkin,
  setItems,
  setVeganType,
  setMeatReplaced,
  setLastResult,
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

type Stage = 'veg' | 'meat-pending' | 'meat-replaced';

export default function result(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'checkin-screen checkin-result';

  if (!$checkin.get().scan) {
    wrap.innerHTML = `
      <div class="checkin-body checkin-fallback">
        <p>沒有可確認的辨識結果。</p>
        <button class="btn text-btn-m btn-primary btn-l text-btn-l" id="back">回到拍照</button>
      </div>
    `;
    wrap.querySelector('#back')?.addEventListener('click', () => navigate('/check-in'));
    return wrap;
  }

  // Edit mode opens when the user clicks 修改餐點 inside the meat-replaced
  // stage. It's screen-local UI state — never persisted, never on $checkin.
  let editOpen = false;

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
          <button class="btn text-btn-m btn-sm text-mini btn-secondary" id="meat-yes">是</button>
          <button class="btn text-btn-m btn-sm text-mini btn-primary" id="meat-no">否</button>
        </div>
      </div>

      <div class="nutrition-card" id="nutrition-card" hidden>
        <div class="nutrition-card-head">
          <span class="ms">auto_awesome</span>
          <strong>AI 自動分析</strong>
        </div>
        <div class="nutrition-card-body" id="nutrition-body"></div>
        <p class="nutrition-card-hint">由 AI 依替換後的食材自動估算，不需手動編輯</p>
      </div>

      <div class="pet-bubble" id="pet-bubble" hidden>
        <span class="pet-bubble-pet">🐣</span>
        <div class="pet-bubble-body">
          <p>看起來很棒！想再調整餐點嗎？</p>
          <button class="btn-skip" id="open-edit" type="button">修改餐點</button>
        </div>
      </div>

      <ul class="result-list" id="items-list" hidden></ul>

      <button class="result-add" id="add-food" hidden>
        <span class="ms">add</span>新增食物
      </button>

      <div class="result-section" id="vegan-section" hidden>
        <span class="result-section-label">素別</span>
        <div class="vegan-chips" id="vegan-chips">
          ${VEGAN_TYPES.map(
            (v) => `<button class="vegan-chip" data-value="${v}">${v}</button>`,
          ).join('')}
        </div>
      </div>

      <div class="result-summary" id="summary" hidden></div>
    </div>
    <div class="checkin-footer">
      <button class="btn text-btn-m btn-primary btn-l text-btn-l" id="confirm-btn" hidden>確認打卡</button>
    </div>
  `;

  function computeStage(d: CheckinDraft): Stage {
    const hasMeat = d.items.some((i) => !i.isVeg);
    if (d.wasMeatReplaced) return 'meat-replaced';
    if (hasMeat) return 'meat-pending';
    return 'veg';
  }

  function show(el: HTMLElement | null, visible: boolean): void {
    if (el) el.hidden = !visible;
  }

  function setVisibility(stage: Stage): void {
    const banner = wrap.querySelector<HTMLElement>('#meat-banner');
    const nutrition = wrap.querySelector<HTMLElement>('#nutrition-card');
    const petBubble = wrap.querySelector<HTMLElement>('#pet-bubble');
    const list = wrap.querySelector<HTMLElement>('#items-list');
    const add = wrap.querySelector<HTMLElement>('#add-food');
    const veganSection = wrap.querySelector<HTMLElement>('#vegan-section');
    const summary = wrap.querySelector<HTMLElement>('#summary');
    const confirm = wrap.querySelector<HTMLElement>('#confirm-btn');

    if (stage === 'veg') {
      show(banner, false);
      show(nutrition, false);
      show(petBubble, false);
      show(list, true);
      show(add, true);
      show(veganSection, true);
      show(summary, true);
      show(confirm, true);
    } else if (stage === 'meat-pending') {
      show(banner, true);
      show(nutrition, false);
      show(petBubble, false);
      show(list, false);
      show(add, false);
      show(veganSection, false);
      show(summary, false);
      show(confirm, false);
    } else {
      // meat-replaced: card + pet always shown; the edit UI only when opened
      show(banner, false);
      show(nutrition, true);
      show(petBubble, true);
      show(list, editOpen);
      show(add, editOpen);
      show(veganSection, editOpen);
      show(summary, editOpen);
      show(confirm, true);
      // Trigger the slide-in animation once per transition into this stage.
      if (nutrition && !nutrition.classList.contains('is-revealed')) {
        nutrition.classList.add('is-revealed');
      }
    }
  }

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

  function renderMeatList(items: MockFood[]) {
    const listEl = wrap.querySelector<HTMLElement>('#meat-list')!;
    const meats = items.filter((i) => !i.isVeg);
    if (meats.length > 0) {
      listEl.textContent = meats.map((m) => m.name).join('、');
    }
  }

  function renderNutritionCard(items: MockFood[]) {
    const body = wrap.querySelector<HTMLElement>('#nutrition-body');
    if (!body) return;
    const n = aggregateNutrition(items);
    body.innerHTML = `
      <div class="nutrition-grid">
        <div class="nutrition-cell"><span class="nutrition-cell-label">熱量</span><strong>${Math.round(n.cal)} kcal</strong></div>
        <div class="nutrition-cell"><span class="nutrition-cell-label">蛋白質</span><strong>${n.protein} g</strong></div>
        <div class="nutrition-cell"><span class="nutrition-cell-label">碳水</span><strong>${n.carb} g</strong></div>
        <div class="nutrition-cell"><span class="nutrition-cell-label">脂肪</span><strong>${n.fat} g</strong></div>
        <div class="nutrition-cell"><span class="nutrition-cell-label">膳食纖維</span><strong>${n.fiber} g</strong></div>
      </div>
    `;
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
    const stage = computeStage(d);
    renderItems(d.items);
    renderMeatList(d.items);
    renderNutritionCard(d.items);
    renderChips(d.veganType);
    renderSummary(d);
    setVisibility(stage);
  }

  bind(wrap, $checkin, rerender);

  wrap.querySelector('#back-btn')?.addEventListener('click', () => navigate('/check-in'));

  wrap.querySelector('#meat-yes')?.addEventListener('click', () => {
    navigate('/check-in/fail');
  });

  wrap.querySelector('#meat-no')?.addEventListener('click', () => {
    // Pressing 否 used to auto-submit; the new flow flips the meat items
    // to plant-based, exposes the auto-derived nutrition card, and waits
    // for the user to confirm so they can review and optionally tweak.
    const cur = $checkin.get().items.map((it) => (it.isVeg ? it : { ...it, isVeg: true }));
    setItems(cur);
    setMeatReplaced(true);
  });

  wrap.querySelector('#open-edit')?.addEventListener('click', () => {
    editOpen = true;
    const d = $checkin.get();
    setVisibility(computeStage(d));
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
    const checkInRow = await createCheckIn({
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
    if (luckyMatch) {
      markMissionDone('lucky:hit', 0);
    }
    try { await awardXp(u.id, xp, 'check_in', checkInRow.id); } catch { /* server XP soft fail */ }
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
