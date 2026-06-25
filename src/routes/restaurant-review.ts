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
import { markMissionDone } from '@/store/today';
import {
  createReview,
  updateReview,
  getMyReviewForRestaurant,
  hasReviewedRestaurant,
  REVIEW_XP_FIRST,
  REVIEW_XP_REPEAT,
  type RestaurantReview,
} from '@/api/reviews';
import { awardXp } from '@/store/pet';
import { VEGAN_TIERS, openVeganTierInfo } from '@/lib/vegan-tiers';
import { t } from '@/lib/i18n';
import { maybeShowReviewGuideline } from '@/lib/review-guideline';

const VEGAN_TYPES = VEGAN_TIERS.map((tier) => tier.value);

export default function review(params: Record<string, string>): HTMLElement {
  const restaurantId = Number(params.id);
  const wrap = document.createElement('div');
  wrap.className = 'review-screen';
  wrap.innerHTML = `
    <header class="detail-header">
      <button class="checkin-back" id="back-btn" aria-label="${t('common.back')}">
        <span class="ms">arrow_back</span>
      </button>
      <span class="checkin-title">${t('review.title')}</span>
      <span class="checkin-meal" id="rest-name">…</span>
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
      <button class="btn text-btn-m btn-primary btn-l text-btn-l" type="submit" id="submit">${t('review.submit').replace('{xp}', String(REVIEW_XP_FIRST))}</button>
    </form>
  `;

  // First-time review-guideline popup (spec #18). No-ops after first
  // dismissal — the localStorage flag prevents re-show.
  maybeShowReviewGuideline(wrap);

  let rating = 0;
  const veganSet = new Set<string>();
  let photoDataUrl: string | null = null;
  // When the user already has a review for this restaurant, the route
  // flips into edit mode (§4.6 — 1 user × 1 restaurant = 1 review). The
  // submit handler dispatches to updateReview instead of createReview;
  // the form prefills with existing rating/text/vegan picks.
  let editingReview: RestaurantReview | null = null;

  void (async () => {
    const u = $user.get();
    if (!u) return;
    const existing = await getMyReviewForRestaurant(u.id, restaurantId);
    if (existing) {
      editingReview = existing;
      enterEditMode(existing);
      return;
    }
    // Pure-create path: preview the correct XP on the submit button.
    const reviewed = await hasReviewedRestaurant(u.id, restaurantId);
    const previewXp = reviewed ? REVIEW_XP_REPEAT : REVIEW_XP_FIRST;
    const btn = wrap.querySelector<HTMLButtonElement>('#submit');
    if (btn) btn.textContent = t('review.submit').replace('{xp}', String(previewXp));
  })();

  function enterEditMode(existing: RestaurantReview): void {
    const titleEl = wrap.querySelector<HTMLElement>('.checkin-title');
    if (titleEl) titleEl.textContent = t('review.editTitle');
    // Prepend an explainer banner so the user sees this is a re-entry
    // into the same review, not a duplicate submission.
    const form = wrap.querySelector<HTMLFormElement>('#form')!;
    const banner = document.createElement('div');
    banner.className = 'review-edit-banner';
    banner.innerHTML = `
      <span class="ms">edit_note</span>
      <span>${t('review.editBanner')}</span>
    `;
    form.prepend(banner);
    // Prefill: rating
    if (existing.rating > 0) setRating(existing.rating);
    // Prefill: text
    const ta = wrap.querySelector<HTMLTextAreaElement>('#text');
    if (ta && existing.text) ta.value = existing.text;
    // Prefill: vegan_type chips (comma-separated)
    if (existing.vegan_type) {
      for (const v of existing.vegan_type.split(',').map((s) => s.trim()).filter(Boolean)) {
        veganSet.add(v);
        const chip = wrap.querySelector<HTMLButtonElement>(`.vegan-chip[data-value="${v}"]`);
        chip?.classList.add('selected');
      }
    }
    // Submit-button label reflects update intent (no XP for edits).
    const btn = wrap.querySelector<HTMLButtonElement>('#submit');
    if (btn) btn.textContent = t('review.update');
    // 「同時當作今日打卡」 is a create-only affordance — hide it on edits
    // so the user can't double-credit the same meal via the edit route.
    const checkinLabel = wrap.querySelector<HTMLElement>('.review-checkin');
    if (checkinLabel) checkinLabel.hidden = true;
  }

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
    // Photo upload is stubbed (data URL only) — the real drust file
    // pipeline lands in a later PR. Photo is optional so users can post
    // a text-only review.
    void photoDataUrl;

    submitBtn.disabled = true;
    submitBtn.textContent = editingReview ? t('review.updating') : t('common.submitting');

    try {
      if (editingReview) {
        // Spec §4.6 — 1 edit per 24h. We check just-in-time (the form has
        // been open since mount, so the cooldown might have expired
        // mid-session). On lockout, surface a friendly explanation and
        // bail without touching drust.
        const { reviewEditedAt, REVIEW_EDIT_COOLDOWN_MS } = await import('@/api/reviews');
        const lastEdit = reviewEditedAt(editingReview.id);
        if (lastEdit && Date.now() - lastEdit.getTime() < REVIEW_EDIT_COOLDOWN_MS) {
          const hoursLeft = Math.ceil(
            (REVIEW_EDIT_COOLDOWN_MS - (Date.now() - lastEdit.getTime())) / (60 * 60 * 1000),
          );
          errorEl.hidden = false;
          errorEl.textContent = t('review.cooldown').replace('{h}', String(hoursLeft));
          submitBtn.disabled = false;
          submitBtn.textContent = t('review.update');
          return;
        }
        await updateReview(editingReview.id, {
          rating,
          text: text || null,
          photoId: null,
          veganType,
        });
        // Skip XP / check-in chaining — edits don't re-pay rewards.
        renderEditSuccess();
        return;
      }
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

      let xpFedToPet = 0;
      let gemsFromXp = 0;
      try {
        const award = await awardXp(u.id, reviewXp, 'bonus', restaurantId);
        xpFedToPet = award.xpFedToPet;
        gemsFromXp = award.gemsFromXp;
      } catch { /* server XP soft fail */ }
      // Bump $today.totalXpToday for the review reward (mark a per-restaurant
      // mission so duplicate-clicks don't double-credit if user re-submits).
      markMissionDone(`review:${restaurantId}`, reviewXp);

      renderSuccess({ rating, totalXp: reviewXp, xpFedToPet, gemsFromXp });
    } catch (err) {
      console.error('[review] submit failed:', err);
      errorEl.hidden = false;
      errorEl.textContent = editingReview ? t('review.failUpdate') : t('review.failSubmit');
      submitBtn.disabled = false;
      submitBtn.textContent = editingReview
        ? t('review.update')
        : t('review.submit').replace('{xp}', String(REVIEW_XP_FIRST));
    }
  }

  function renderEditSuccess(): void {
    form.innerHTML = `
      <section class="review-success">
        <div class="review-success-icon" aria-hidden="true">✨</div>
        <h2 class="review-success-title">${t('review.editSuccessTitle')}</h2>
        <p class="review-success-sub">${t('review.editSuccessSub')}</p>
        <button class="btn text-btn-m btn-primary btn-l text-btn-l" id="back-to-detail" type="button">
          ${t('review.backToShop')}
        </button>
      </section>
    `;
    form.querySelector('#back-to-detail')?.addEventListener('click', () => {
      navigate(`/map/restaurant/${restaurantId}`);
    });
  }

  function renderSuccess(args: {
    rating: number;
    totalXp: number;
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
        <h2 class="review-success-title">${t('review.successTitle')}</h2>
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
