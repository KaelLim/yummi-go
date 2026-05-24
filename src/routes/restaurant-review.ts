/**
 * Review form route — `/map/restaurant/:id/review`.
 *
 * Star rating (1-5), text body, required vegan-type chip, and the spec's
 * "評論即打卡" toggle: when checked, the same submit also creates today's
 * meal check-in for double XP (+20 review, +30 check-in).
 *
 * After submit, the form is replaced in-place by a success card that
 * shows the rating, XP earned, and — if the user checked "use as
 * check-in" — a nutrition breakdown from a mockScan over the uploaded
 * photo. From there the user taps 回到店家 to land back on
 * `/map/restaurant/:id`, where the freshly-submitted review is already
 * listed by the detail route's refetch on mount.
 *
 * Photo upload is deliberately a stub here — file is read into a data URL
 * to demonstrate the flow but we don't actually push it to drust's file
 * bucket (no MCP upload tool from the browser; spec calls this Phase 13
 * polish work). The mockScan() output stands in for what a real AI scan
 * would produce against the uploaded image.
 */
import { navigate } from '@/router';
import { $user } from '@/store/user';
import { $today, $challenge, markMissionDone } from '@/store/today';
import { inferMealIndex } from '@/store/checkin';
import { createReview, hasReviewedRestaurant, REVIEW_XP_FIRST, REVIEW_XP_REPEAT } from '@/api/reviews';
import { createCheckIn } from '@/api/check-ins';
import { awardXp } from '@/store/pet';
import { mealXp } from '@/lib/xp-calc';
import { matchesLucky, normalizeLuckyColor } from '@/lib/lucky-color';
import { mockScan, type MockFood } from '@/lib/mock-ai';
import { openItemsEditor } from '@/lib/items-editor';
import { VEGAN_TIERS, openVeganTierInfo } from '@/lib/vegan-tiers';

const VEGAN_TYPES = VEGAN_TIERS.map((t) => t.value);

export default function review(params: Record<string, string>): HTMLElement {
  const restaurantId = Number(params.id);
  const wrap = document.createElement('div');
  wrap.className = 'review-screen';
  wrap.innerHTML = `
    <header class="detail-header">
      <button class="checkin-back" id="back-btn" aria-label="返回">
        <span class="ms">arrow_back</span>
      </button>
      <span class="checkin-title">寫評論</span>
      <span class="checkin-meal" id="rest-name">…</span>
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
        <div class="review-section-label-row">
          <span class="review-section-label">素別（可複選）</span>
          <button class="vegan-info-btn" id="vegan-info-btn" type="button" aria-label="素別說明">
            <span class="ms">info</span>
          </button>
        </div>
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
      <button class="btn text-btn-m btn-primary btn-l text-btn-l" type="submit" id="submit">送出評論 (+${REVIEW_XP_FIRST} XP)</button>
    </form>
  `;

  let rating = 0;
  const veganSet = new Set<string>();
  let photoDataUrl: string | null = null;

  // On mount, check whether this user has already reviewed this restaurant
  // and update the submit-button label to advertise the correct XP. The
  // submit handler re-checks at click time so the actual award is always
  // accurate even if the user reviewed elsewhere mid-session.
  void (async () => {
    const u = $user.get();
    if (!u) return;
    const reviewed = await hasReviewedRestaurant(u.id, restaurantId);
    const previewXp = reviewed ? REVIEW_XP_REPEAT : REVIEW_XP_FIRST;
    const btn = wrap.querySelector<HTMLButtonElement>('#submit');
    if (btn) btn.textContent = `送出評論 (+${previewXp} XP)`;
  })();

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

  // 素別 is multi-select: one meal can fit multiple tiers (e.g. a 全素 dish
  // also satisfies 蛋奶素 diners). Storage joins the picks with commas.
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
  wrap.querySelector('#vegan-info-btn')?.addEventListener('click', () => openVeganTierInfo(wrap));

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
    // Photo upload is stubbed (data URL only) so an as-checkin without a
    // photo still produces useful nutrition output via mockScan. When the
    // real drust file pipeline lands, gate this on photoDataUrl being set.
    void photoDataUrl;

    submitBtn.disabled = true;
    submitBtn.textContent = '送出中…';

    try {
      await createReview({
        userId: u.id,
        restaurantId,
        rating,
        text: text || null,
        photoId: null, // upload integration deferred; data URL is local-only.
        veganType,
      });
      // v0.3 §4: first review per restaurant earns more.
      const reviewed = await hasReviewedRestaurant(u.id, restaurantId);
      const reviewXp = reviewed ? REVIEW_XP_REPEAT : REVIEW_XP_FIRST;
      let totalXp = reviewXp;
      let scanItems: MockFood[] = [];
      let nutrition: { cal: number; protein: number; carb: number; fat: number; fiber: number } | null = null;

      if (asCheckin) {
        // Run a mock AI scan over the photo placeholder so the success
        // card can show real-looking nutrition numbers (the actual photo
        // bytes aren't sent anywhere yet — that's the same Phase 13
        // upload-pipeline gap noted at the top of this file).
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

      let xpFedToPet = 0;
      let gemsFromXp = 0;
      try {
        const award = await awardXp(u.id, totalXp, 'bonus', restaurantId);
        xpFedToPet = award.xpFedToPet;
        gemsFromXp = award.gemsFromXp;
      } catch { /* server XP soft fail */ }
      // Bump $today.totalXpToday for the review reward (mark a per-restaurant
      // mission so duplicate-clicks don't double-credit if user re-submits).
      markMissionDone(`review:${restaurantId}`, reviewXp);

      renderSuccess({ rating, totalXp, asCheckin, nutrition, items: scanItems, xpFedToPet, gemsFromXp });
    } catch (err) {
      console.error('[review] submit failed:', err);
      errorEl.hidden = false;
      errorEl.textContent = '送出失敗，請稍後再試';
      submitBtn.disabled = false;
      submitBtn.textContent = `送出評論 (+${REVIEW_XP_FIRST} XP)`;
    }
  }

  function renderSuccess(args: {
    rating: number;
    totalXp: number;
    asCheckin: boolean;
    nutrition: { cal: number; protein: number; carb: number; fat: number; fiber: number } | null;
    items: MockFood[];
    xpFedToPet: number;
    gemsFromXp: number;
  }): void {
    const stars = '★'.repeat(args.rating) + '☆'.repeat(5 - args.rating);
    // Three display states:
    //   - Below cap: show only the XP badge.
    //   - Crossing 100 today (fed >0 && gems >0): show only XP — the
    //     global milestone popup tells the gem-conversion story.
    //   - Post-cap (fed === 0 && gems >0): everything converted, so the
    //     XP badge would be redundant. Show only the gem badge.
    const postCap = args.xpFedToPet === 0 && args.gemsFromXp > 0;
    const xpPip = postCap
      ? ''
      : `<div class="review-success-xp">+${args.totalXp} XP</div>`;
    const gemsPip = postCap
      ? `<div class="review-success-gems">+${args.gemsFromXp} 能量石 💎</div>`
      : '';
    form.innerHTML = `
      <section class="review-success">
        <div class="review-success-icon" aria-hidden="true">🎉</div>
        <h2 class="review-success-title">感謝你的評論！</h2>
        <div class="review-success-stars">${stars}</div>
        ${xpPip}
        ${gemsPip}
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
      // Local mutable state so the user can edit the AI-scanned items the
      // same way they can on /check-in/success.
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

  /**
   * Reuses the check-in success page's `.nutrition-card` styling so the
   * 營養成分 block reads identically across the two surfaces (per the user
   * pivot: "感謝你的評論當頁的營養成分長得要與平常打卡一致"). Same 5 cells,
   * same combined "{value} {unit}" format inside `<strong>`, same green
   * gradient card with reveal animation.
   */
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
