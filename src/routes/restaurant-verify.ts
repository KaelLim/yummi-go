/**
 * Restaurant verification route — `/map/restaurant/:id/verify`.
 *
 * Visually identical to `/map/restaurant/:id/review` (same `.review-screen`
 * shell, same `.review-form` sections, same fields, same success card)
 * so the two paths read as one consistent surface. The user pivot was
 * explicit: "這兩個頁面會是一樣的".
 *
 * Differences from the review form:
 *   1. Header title is 認證餐廳 (the back button + sub-meta still match).
 *   2. Submit also PATCHes the restaurant row — flips `pin_color` to
 *      'green' and writes the user-picked vegan_type — so the gray pin
 *      becomes verified after the form clears.
 *   3. Submit awards an extra +20 XP for the verification on top of the
 *      review's +20 and the optional +30 from "as-checkin".
 *
 * Photo upload remains a stub (data URL only). Drust file pipeline lands
 * in Phase 13.
 */
import { navigate } from '@/router';
import { $user } from '@/store/user';
import { $today, $challenge, markMissionDone } from '@/store/today';
import { inferMealIndex } from '@/store/checkin';
import { createReview } from '@/api/reviews';
import { createCheckIn } from '@/api/check-ins';
import { drust } from '@/api/drust';
import { awardXp } from '@/store/pet';
import { mealXp } from '@/lib/xp-calc';
import { matchesLucky, normalizeLuckyColor } from '@/lib/lucky-color';
import { mockScan, type MockFood } from '@/lib/mock-ai';
import { openItemsEditor } from '@/lib/items-editor';

const VEGAN_TYPES = ['全素', '蛋奶素', '五辛素', '鍋邊素'] as const;

const VERIFY_XP = 20;
const REVIEW_XP = 20;

export default function verify(params: Record<string, string>): HTMLElement {
  const restaurantId = Number(params.id);
  const wrap = document.createElement('div');
  wrap.className = 'review-screen verify-screen';
  wrap.innerHTML = `
    <header class="detail-header">
      <button class="checkin-back" id="back-btn" aria-label="返回">
        <span class="ms">arrow_back</span>
      </button>
      <span class="checkin-title">認證餐廳</span>
      <span class="checkin-meal" id="rest-name">+${VERIFY_XP + REVIEW_XP} XP</span>
    </header>
    <form class="review-form" id="form">
      <div class="review-section">
        <span class="review-section-label">評分</span>
        <div class="star-rating" id="stars" role="radiogroup" aria-label="評分">
          ${[1, 2, 3, 4, 5]
            .map(
              (n) =>
                `<button type="button" class="star" data-value="${n}" role="radio" aria-checked="false">★</button>`,
            )
            .join('')}
        </div>
      </div>

      <div class="review-section">
        <span class="review-section-label">想說些什麼？</span>
        <textarea name="text" id="text" rows="4" maxlength="500" placeholder="你的素食體驗、餐點推薦…"></textarea>
      </div>

      <div class="review-section">
        <span class="review-section-label">素別（可複選）</span>
        <div class="vegan-chips" id="vegan-chips">
          ${VEGAN_TYPES.map(
            (v) => `<button type="button" class="vegan-chip" data-value="${v}">${v}</button>`,
          ).join('')}
        </div>
      </div>

      <div class="review-section">
        <span class="review-section-label">餐點照片 (選填)</span>
        <input type="file" accept="image/*" id="photo" />
        <img class="review-photo-preview" id="photo-preview" hidden alt="照片預覽" />
      </div>

      <label class="review-checkin">
        <input type="checkbox" id="as-checkin" />
        <span>同時當作今日打卡照（+30 XP 打卡）</span>
      </label>

      <div class="review-error" id="error" hidden></div>
      <button class="btn text-btn-m btn-primary btn-l text-btn-l" type="submit" id="submit">送出認證 (+${VERIFY_XP + REVIEW_XP} XP)</button>
    </form>
  `;

  let rating = 0;
  const veganSet = new Set<string>();
  let photoDataUrl: string | null = null;

  const setRating = (n: number) => {
    rating = n;
    wrap.querySelectorAll<HTMLButtonElement>('.star').forEach((s) => {
      const v = Number(s.dataset.value);
      const on = v <= n;
      s.classList.toggle('on', on);
      s.setAttribute('aria-checked', String(v === n));
    });
  };

  wrap.querySelectorAll<HTMLButtonElement>('.star').forEach((s) => {
    s.addEventListener('click', () => setRating(Number(s.dataset.value)));
  });

  // 素別 is multi-select — matches the review form for visual consistency
  // and reflects the multi-tier restaurant model (one venue can support
  // 全素 + 蛋奶素 + 五辛素 simultaneously).
  wrap.querySelectorAll<HTMLButtonElement>('.vegan-chip').forEach((c) => {
    c.addEventListener('click', () => {
      const v = c.dataset.value!;
      if (veganSet.has(v)) {
        veganSet.delete(v);
        c.classList.remove('selected');
      } else {
        veganSet.add(v);
        c.classList.add('selected');
      }
    });
  });

  wrap.querySelector('#back-btn')?.addEventListener('click', () =>
    navigate(`/map/restaurant/${restaurantId}`),
  );

  const photoInput = wrap.querySelector<HTMLInputElement>('#photo')!;
  const photoPreview = wrap.querySelector<HTMLImageElement>('#photo-preview')!;
  photoInput.addEventListener('change', () => {
    const f = photoInput.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      photoDataUrl = String(reader.result ?? '');
      photoPreview.src = photoDataUrl;
      photoPreview.hidden = false;
    };
    reader.readAsDataURL(f);
  });

  const errorEl = wrap.querySelector<HTMLElement>('#error')!;
  const submitBtn = wrap.querySelector<HTMLButtonElement>('#submit')!;
  const form = wrap.querySelector<HTMLFormElement>('#form')!;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    void submit();
  });

  async function submit() {
    errorEl.hidden = true;
    const u = $user.get();
    if (!u) {
      navigate('/login');
      return;
    }
    if (rating === 0) {
      errorEl.hidden = false;
      errorEl.textContent = '請先選擇評分';
      return;
    }
    if (veganSet.size === 0) {
      errorEl.hidden = false;
      errorEl.textContent = '請至少選擇一個素別';
      return;
    }
    const veganType = Array.from(veganSet).join(',');
    const text = String((wrap.querySelector<HTMLTextAreaElement>('#text')!).value || '').trim();
    const asCheckin = (wrap.querySelector<HTMLInputElement>('#as-checkin')!).checked;
    // photo is stubbed — no upload pipeline yet. Kept available for future
    // wiring.
    void photoDataUrl;

    submitBtn.disabled = true;
    submitBtn.textContent = '送出中…';

    try {
      // Flip the restaurant to verified + write the user-picked tier.
      // Stored as the single selected value to match the review form's
      // semantics (per-act vegan_type). If multi-tier verification is
      // needed later, we can promote this to a comma-joined list.
      await drust.update('restaurants', restaurantId, {
        pin_color: 'green',
        vegan_type: veganType,
      });

      // The verification act also stands as a review of the place.
      await createReview({
        userId: u.id,
        restaurantId,
        rating,
        text: text || null,
        photoId: null,
        veganType,
      });

      let totalXp = VERIFY_XP + REVIEW_XP;
      let scanItems: MockFood[] = [];
      let nutrition: { cal: number; protein: number; carb: number; fat: number; fiber: number } | null = null;

      if (asCheckin) {
        const scan = mockScan();
        scanItems = scan.items;
        nutrition = aggregateNutrition(scan.items);

        const day = $today.get().dayNumber;
        const cur = $challenge.get().currentDay;
        const luckyEn = normalizeLuckyColor(cur?.lucky_color ?? '');
        const palette = scan.items.flatMap((it) => it.colors);
        const luckyMatch = luckyEn ? matchesLucky(palette, luckyEn) : false;
        const mealIndex = inferMealIndex();
        const baseXp = mealXp(mealIndex, 3);
        const xpForCheckin = baseXp + (luckyMatch ? 15 : 0);
        await createCheckIn({
          userId: u.id,
          dayNumber: day,
          mealIndex,
          foodItems: scan.items,
          nutrition,
          veganType,
          wasMeatReplaced: false,
          luckyColorMatched: luckyMatch,
          xpEarned: xpForCheckin,
          gemsEarned: 0,
        });
        markMissionDone(
          `meal:${mealIndex === 1 ? 'breakfast' : mealIndex === 2 ? 'lunch' : 'dinner'}`,
          xpForCheckin,
        );
        totalXp += xpForCheckin;
      }

      try {
        await awardXp(u.id, totalXp, 'mission', restaurantId);
      } catch { /* server XP soft fail */ }
      markMissionDone(`map_verify:${restaurantId}`, VERIFY_XP);
      markMissionDone(`review:${restaurantId}`, REVIEW_XP);

      renderSuccess({ rating, totalXp, asCheckin, nutrition, items: scanItems });
    } catch (err) {
      console.error('[verify] submit failed:', err);
      errorEl.hidden = false;
      errorEl.textContent = '送出失敗，請稍後再試';
      submitBtn.disabled = false;
      submitBtn.textContent = `送出認證 (+${VERIFY_XP + REVIEW_XP} XP)`;
    }
  }

  function renderSuccess(args: {
    rating: number;
    totalXp: number;
    asCheckin: boolean;
    nutrition: { cal: number; protein: number; carb: number; fat: number; fiber: number } | null;
    items: MockFood[];
  }): void {
    const stars = '★'.repeat(args.rating) + '☆'.repeat(5 - args.rating);
    form.innerHTML = `
      <section class="review-success">
        <div class="review-success-icon" aria-hidden="true">🎉</div>
        <h2 class="review-success-title">認證成功！</h2>
        <div class="review-success-stars">${stars}</div>
        <div class="review-success-xp">+${args.totalXp} XP</div>
        ${args.asCheckin ? '<div class="review-success-checkin-badge"><span class="ms">verified</span>完成打卡</div>' : ''}
        ${args.asCheckin && args.nutrition ? renderNutritionCard(args.nutrition) : ''}
        ${args.asCheckin && args.nutrition ? '<button class="btn text-btn-m btn-secondary btn-l text-btn-l" id="edit-items" type="button"><span class="ms">edit</span>修改內容</button>' : ''}
        <button class="btn text-btn-m btn-primary btn-l text-btn-l" id="back-to-map" type="button">
          回到地圖
        </button>
      </section>
    `;
    form.querySelector('#back-to-map')?.addEventListener('click', () => {
      navigate('/map');
    });
    if (args.asCheckin && args.nutrition) {
      let liveItems = args.items.slice();
      let liveNutrition = args.nutrition;
      form.querySelector('#edit-items')?.addEventListener('click', () => {
        openItemsEditor({
          host: wrap,
          initial: liveItems,
          onSave: (next, nextN) => {
            liveItems = next;
            liveNutrition = nextN;
            const card = form.querySelector('.nutrition-card');
            if (card) card.outerHTML = renderNutritionCard(liveNutrition);
          },
        });
      });
    }
  }

  /** Same nutrition card markup as `/check-in/success` — see review form for
   *  why this is duplicated rather than imported. */
  function renderNutritionCard(n: {
    cal: number; protein: number; carb: number; fat: number; fiber: number;
  }): string {
    return `
      <section class="nutrition-card is-revealed">
        <div class="nutrition-card-head">
          <span class="ms">restaurant_menu</span>
          <strong>本餐營養成分</strong>
        </div>
        <div class="nutrition-grid">
          <div class="nutrition-cell"><span class="nutrition-cell-label">熱量</span><strong>${Math.round(n.cal)} kcal</strong></div>
          <div class="nutrition-cell"><span class="nutrition-cell-label">蛋白質</span><strong>${n.protein} g</strong></div>
          <div class="nutrition-cell"><span class="nutrition-cell-label">碳水</span><strong>${n.carb} g</strong></div>
          <div class="nutrition-cell"><span class="nutrition-cell-label">脂肪</span><strong>${n.fat} g</strong></div>
          <div class="nutrition-cell"><span class="nutrition-cell-label">膳食纖維</span><strong>${n.fiber} g</strong></div>
        </div>
        <p class="nutrition-card-hint">由 AI 依本餐食材自動估算</p>
      </section>
    `;
  }

  return wrap;
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
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;',
  );
}
