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
import { markMissionDone } from '@/store/today';
import { createReview, hasReviewedRestaurant, REVIEW_XP_FIRST, REVIEW_XP_REPEAT } from '@/api/reviews';
import { drust } from '@/api/drust';
import { awardXp } from '@/store/pet';
import { VEGAN_TIERS, openVeganTierInfo } from '@/lib/vegan-tiers';
import { t } from '@/lib/i18n';

const VEGAN_TYPES = VEGAN_TIERS.map((tier) => tier.value);

const VERIFY_XP = 20;

export default function verify(params: Record<string, string>): HTMLElement {
  const restaurantId = Number(params.id);
  const wrap = document.createElement('div');
  wrap.className = 'review-screen verify-screen';
  wrap.innerHTML = `
    <header class="detail-header">
      <button class="checkin-back" id="back-btn" aria-label="${t('common.back')}">
        <span class="ms">arrow_back</span>
      </button>
      <span class="checkin-title">${t('verify.title')}</span>
      <span class="checkin-meal" id="rest-name">+${VERIFY_XP + REVIEW_XP_FIRST} XP</span>
    </header>
    <form class="review-form" id="form">
      <div class="review-section">
        <span class="review-section-label">${t('review.rating')}</span>
        <div class="star-rating" id="stars" role="radiogroup" aria-label="${t('review.rating')}">
          ${[1, 2, 3, 4, 5]
            .map(
              (n) =>
                `<button type="button" class="star" data-value="${n}" role="radio" aria-checked="false">★</button>`,
            )
            .join('')}
        </div>
      </div>

      <div class="review-section">
        <div class="review-section-label-row">
          <span class="review-section-label">${t('review.veganLabel')}</span>
          <button class="vegan-info-btn" id="vegan-info-btn" type="button" aria-label="${t('review.veganInfo')}">
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
        <span class="review-section-label">${t('review.text')}</span>
        <textarea name="text" id="text" rows="4" maxlength="500" placeholder="${t('review.textPh')}"></textarea>
      </div>

      <div class="review-section">
        <span class="review-section-label">${t('review.photo')}</span>
        <input type="file" accept="image/*" id="photo" />
        <img class="review-photo-preview" id="photo-preview" hidden alt="${t('review.photoAlt')}" />
      </div>

      <div class="review-error" id="error" hidden></div>
      <button class="btn text-btn-m btn-primary btn-l text-btn-l" type="submit" id="submit">${t('verify.submit').replace('{xp}', String(VERIFY_XP + REVIEW_XP_FIRST))}</button>
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
      errorEl.textContent = t('review.errRating');
      return;
    }
    if (veganSet.size === 0) {
      errorEl.hidden = false;
      errorEl.textContent = t('review.errVegan');
      return;
    }
    const veganType = Array.from(veganSet).join(',');
    const text = String((wrap.querySelector<HTMLTextAreaElement>('#text')!).value || '').trim();
    // photo is stubbed — no upload pipeline yet. Kept available for future
    // wiring.
    void photoDataUrl;

    submitBtn.disabled = true;
    submitBtn.textContent = t('common.submitting');

    try {
      // Flip the restaurant to verified + write the user-picked tier.
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

      const reviewed = await hasReviewedRestaurant(u.id, restaurantId);
      const reviewXp = reviewed ? REVIEW_XP_REPEAT : REVIEW_XP_FIRST;
      const totalXp = VERIFY_XP + reviewXp;

      let xpFedToPet = 0;
      let gemsFromXp = 0;
      try {
        const award = await awardXp(u.id, totalXp, 'mission', restaurantId);
        xpFedToPet = award.xpFedToPet;
        gemsFromXp = award.gemsFromXp;
      } catch { /* server XP soft fail */ }
      markMissionDone(`map_verify:${restaurantId}`, VERIFY_XP);
      markMissionDone(`review:${restaurantId}`, reviewXp);

      renderSuccess({ rating, totalXp, xpFedToPet, gemsFromXp });
    } catch (err) {
      console.error('[verify] submit failed:', err);
      errorEl.hidden = false;
      // Surface the underlying drust message so a permission denial
      // doesn't look like a flaky network. The most common cause here
      // is the restaurants collection not yet granting 'update' to the
      // anon token — fix via MCP: `set_anon_caps restaurants
      // [select, update]`.
      const detail = (err as Error)?.message ?? '';
      errorEl.textContent = detail
        ? `${t('verify.failPrefix')}${detail}`
        : t('review.failSubmit');
      submitBtn.disabled = false;
      submitBtn.textContent = t('verify.submit').replace('{xp}', String(VERIFY_XP + REVIEW_XP_FIRST));
    }
  }

  function renderSuccess(args: {
    rating: number;
    totalXp: number;
    xpFedToPet: number;
    gemsFromXp: number;
  }): void {
    const stars = '★'.repeat(args.rating) + '☆'.repeat(5 - args.rating);
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
        <h2 class="review-success-title">${t('verify.successTitle')}</h2>
        <div class="review-success-stars">${stars}</div>
        ${xpPip}
        ${gemsPip}
        <button class="btn text-btn-m btn-primary btn-l text-btn-l" id="back-to-map" type="button">
          ${t('review.backToMap')}
        </button>
      </section>
    `;
    form.querySelector('#back-to-map')?.addEventListener('click', () => {
      navigate('/map');
    });
  }

  return wrap;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;',
  );
}
