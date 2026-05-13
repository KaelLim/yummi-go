/**
 * Review form route — `/map/restaurant/:id/review`.
 *
 * Star rating (1-5), text body, optional vegan-type chip, and the spec's
 * "評論即打卡" toggle: when checked, the same submit also creates today's
 * meal check-in for double XP (+20 review, +30 check-in).
 *
 * Photo upload is deliberately a stub here — file is read into a data URL
 * to demonstrate the flow but we don't actually push it to drust's file
 * bucket (no MCP upload tool from the browser; spec calls this Phase 13
 * polish work).
 */
import { navigate } from '@/router';
import { $user } from '@/store/user';
import { $today, $challenge, markMissionDone } from '@/store/today';
import { $checkin, inferMealIndex, setLastResult } from '@/store/checkin';
import { createReview } from '@/api/reviews';
import { createCheckIn } from '@/api/check-ins';
import { awardXp } from '@/store/pet';
import { getRestaurant } from '@/api/content';
import { mealXp } from '@/lib/xp-calc';
import { matchesLucky, normalizeLuckyColor } from '@/lib/lucky-color';

const VEGAN_TYPES = ['全素', '蛋奶素', '五辛素', '鍋邊素'] as const;

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
        <span class="review-section-label">素別 (選填)</span>
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
      <button class="btn text-btn-m btn-primary btn-l text-btn-l" type="submit" id="submit">送出評論 (+20 XP)</button>
    </form>
  `;

  let rating = 0;
  let veganType: string | null = null;
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

  wrap.querySelectorAll<HTMLButtonElement>('.vegan-chip').forEach((c) => {
    c.addEventListener('click', () => {
      veganType = c.dataset.value ?? null;
      wrap.querySelectorAll<HTMLButtonElement>('.vegan-chip').forEach((x) => {
        x.classList.toggle('selected', x === c);
      });
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
    const text = String((wrap.querySelector<HTMLTextAreaElement>('#text')!).value || '').trim();
    const asCheckin = (wrap.querySelector<HTMLInputElement>('#as-checkin')!).checked;

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
      let totalXp = 20;

      if (asCheckin) {
        const day = $today.get().dayNumber;
        const cur = $challenge.get().currentDay;
        const luckyEn = normalizeLuckyColor(cur?.lucky_color ?? '');
        // No food list (this is a review-as-checkin), so no color match.
        const luckyMatch = luckyEn ? matchesLucky([], luckyEn) : false;
        const mealIndex = inferMealIndex();
        const baseXp = mealXp(mealIndex, 3);
        const xpForCheckin = baseXp + (luckyMatch ? 15 : 0);
        await createCheckIn({
          userId: u.id,
          dayNumber: day,
          mealIndex,
          foodItems: [],
          nutrition: { cal: 0, protein: 0, carb: 0, fat: 0, fiber: 0 },
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
        const fogReductionPct = cur?.fog_reduction_pct ?? 1;
        $checkin.set({
          ...$checkin.get(),
          mealIndex,
        });
        setLastResult({
          xpEarned: xpForCheckin,
          luckyColorMatched: luckyMatch,
          fogReductionPct,
          xpFedToPet: 0,
          gemsFromXp: 0,
          nutrition: null,
        });
      }

      let award = { xpFedToPet: 0, gemsFromXp: 0 };
      try {
        const res = await awardXp(u.id, totalXp, 'bonus', restaurantId);
        award = { xpFedToPet: res.xpFedToPet, gemsFromXp: res.gemsFromXp };
      } catch { /* server XP soft fail */ }
      // For review-as-checkin, surface the auto-feed breakdown on success.
      if (asCheckin) {
        const prev = $checkin.get().lastResult;
        if (prev) {
          setLastResult({ ...prev, xpFedToPet: award.xpFedToPet, gemsFromXp: award.gemsFromXp });
        }
      }

      // Bump $today.totalXpToday for the review reward (mark a per-restaurant
      // mission so duplicate-clicks don't double-credit if user re-submits).
      markMissionDone(`review:${restaurantId}`, 20);

      const r = await getRestaurant(restaurantId);
      const name = r?.name ?? '這家店';
      window.alert(`感謝你的 ${rating} 星評論！${asCheckin ? `\n還打卡了 ${name}，雙重獎勵入袋 +${totalXp} XP！` : `\n+${totalXp} XP`}`);
      // After review-as-checkin, route to success animation; otherwise back to detail.
      navigate(asCheckin ? '/check-in/success' : `/map/restaurant/${restaurantId}`);
    } catch (err) {
      console.error('[review] submit failed:', err);
      errorEl.hidden = false;
      errorEl.textContent = '送出失敗，請稍後再試';
      submitBtn.disabled = false;
      submitBtn.textContent = '送出評論 (+20 XP)';
    }
    void photoDataUrl; // photoDataUrl currently unused server-side; kept for future upload wiring.
  }

  return wrap;
}
