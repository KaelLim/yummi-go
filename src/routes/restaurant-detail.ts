/**
 * Restaurant detail route — `/map/restaurant/:id`.
 *
 * Loads the restaurant + its public reviews and renders header + meta,
 * partner discount line, scrollable reviews list, and a 寫評論 CTA. The
 * 檢舉 menu is intentionally a thin client surface (5 fixed reasons,
 * client-side toast); a real moderation pipeline is out of scope.
 */
import { navigate } from '@/router';
import { getRestaurant, type Restaurant } from '@/api/content';
import {
  listReviewsForRestaurant,
  type RestaurantReview,
} from '@/api/reviews';
import { requireRealName } from '@/lib/name-prompt';
import { googleMapsPlaceUrl } from '@/lib/google-maps-link';
import { openVeganTierInfo } from '@/lib/vegan-tiers';
import { $user } from '@/store/user';
import { t } from '@/lib/i18n';

const PLACE_LABEL_KEY: Record<string, string> = {
  chinese: 'place.chinese',
  western: 'place.western',
  cafe: 'place.cafe',
  japanese: 'place.japanese',
  thai: 'place.thai',
  dessert: 'place.dessert',
};
function placeLabel(key: string): string {
  const k = PLACE_LABEL_KEY[key];
  return k ? t(k) : key;
}

const RESTAURANT_REPORT_REASON_KEYS = [
  'detail.reasonNotExists',
  'detail.reasonClosed',
  'detail.reasonInfoErr',
];

const REVIEW_REPORT_REASON_KEYS = [
  'detail.reviewReasonBad',
  'detail.reviewReasonAd',
  'detail.reviewReasonFake',
  'detail.reviewReasonOther',
];

export default function detail(params: Record<string, string>): HTMLElement {
  const id = Number(params.id);
  const wrap = document.createElement('div');
  wrap.className = 'restaurant-detail';
  wrap.innerHTML = `
    <header class="detail-header">
      <button class="checkin-back" id="back-btn" aria-label="${t('common.back')}">
        <span class="ms">arrow_back</span>
      </button>
      <span class="checkin-title" id="title">${t('common.loading')}</span>
      <button class="detail-flag-btn" id="report-btn" aria-label="${t('detail.reportTitle')}" title="${t('detail.reportTitle')}">
        <span class="ms">flag</span>
      </button>
    </header>
    <div class="detail-body">
      <section class="detail-meta" id="meta"></section>
      <section class="reviews">
        <div class="reviews-head">
          <h2 class="reviews-title">
            ${t('detail.reviewsTitle')}
            <button class="vegan-info-btn vegan-info-btn-inline" id="reviews-vegan-info-btn" type="button" aria-label="${t('review.veganInfo')}" title="${t('review.veganInfo')}">
              <span class="ms">info</span>
            </button>
          </h2>
          <button class="btn text-btn-m btn-primary btn-sm text-mini" id="add-review">
            <span class="ms">edit</span>${t('detail.writeReview')}
          </button>
        </div>
        <div class="reviews-list" id="reviews-list">
          <p class="reviews-empty">${t('common.loading')}</p>
        </div>
      </section>
    </div>
  `;

  const titleEl = wrap.querySelector<HTMLElement>('#title')!;
  const metaEl = wrap.querySelector<HTMLElement>('#meta')!;
  const listEl = wrap.querySelector<HTMLElement>('#reviews-list')!;

  // Reviews load once and stick around so the tally-filter can re-render
  // narrowed subsets without re-hitting drust. selectedTier === null
  // means "show all"; clicking the same chip again clears the filter.
  let allReviews: RestaurantReview[] = [];
  let selectedTier: string | null = null;

  const renderList = () => {
    const uid = $user.get()?.id ?? null;
    renderReviews(listEl, allReviews, uid, selectedTier);
    // Flip the 寫評論 button to 更新評論 when the current user already
    // has a review on this restaurant — the review route auto-detects
    // and rehydrates in edit mode, so the label just needs to match.
    const btn = wrap.querySelector<HTMLButtonElement>('#add-review');
    if (btn) {
      const mine = uid !== null && allReviews.some((r) => r.user_id === uid);
      btn.innerHTML = mine
        ? `<span class="ms">edit_note</span>${t('detail.updateReview')}`
        : `<span class="ms">edit</span>${t('detail.writeReview')}`;
    }
  };

  wrap.querySelector('#back-btn')?.addEventListener('click', () => navigate('/map'));
  wrap.querySelector('#reviews-vegan-info-btn')?.addEventListener('click', () => openVeganTierInfo(wrap));
  wrap.querySelector('#add-review')?.addEventListener('click', () => {
    // First-time social action — prompt for a real name before the user
    // enters the review form so their submission is attributed properly.
    void (async () => {
      await requireRealName(wrap);
      navigate(`/map/restaurant/${id}/review`);
    })();
  });
  wrap.querySelector('#report-btn')?.addEventListener('click', () => {
    openReportPicker(wrap, {
      title: t('detail.reportTitle'),
      hint: t('detail.reportSub'),
      reasons: RESTAURANT_REPORT_REASON_KEYS.map((k) => t(k)),
      onPick: (reason) => window.alert(t('detail.reportLogged').replace('{reason}', reason)),
    });
  });

  // Event delegation for per-review actions — listEl is re-rendered
  // after the reviews fetch, so binding listeners per-row would require
  // re-binding on every render. One listener on the list covers all
  // rows, including those that haven't been rendered yet.
  listEl.addEventListener('click', (e) => {
    // Tally chip — toggles the selected 素別 filter on the reviews list.
    const tallyChip = (e.target as Element).closest<HTMLButtonElement>('.vegan-tally-chip');
    if (tallyChip) {
      const tier = tallyChip.dataset.tier ?? '';
      selectedTier = selectedTier === tier ? null : tier;
      renderList();
      return;
    }
    // Explicit "顯示全部" pill — only present while a tier is active.
    const clearBtn = (e.target as Element).closest<HTMLButtonElement>('.vegan-tally-clear');
    if (clearBtn) {
      selectedTier = null;
      renderList();
      return;
    }
    const flag = (e.target as Element).closest<HTMLButtonElement>('.review-flag');
    if (flag) {
      const reviewId = flag.dataset.reviewId;
      openReportPicker(wrap, {
        title: t('detail.reportReview'),
        hint: t('detail.reportSub'),
        reasons: REVIEW_REPORT_REASON_KEYS.map((k) => t(k)),
        onPick: (reason) =>
          window.alert(
            reviewId
              ? t('detail.reportLoggedRev').replace('{reason}', reason).replace('{id}', reviewId)
              : t('detail.reportLogged').replace('{reason}', reason),
          ),
      });
      return;
    }
    const editBtn = (e.target as Element).closest<HTMLButtonElement>('.review-edit');
    if (editBtn) {
      // Reuse the existing review route — 4a logic loads the user's
      // existing review and flips into edit mode automatically.
      navigate(`/map/restaurant/${id}/review`);
      return;
    }
    // Delete-review path removed 2026-06-25 — users now contact
    // customer support to remove a review (see FAQ Q6).
  });

  void (async () => {
    try {
      const r = await getRestaurant(id);
      if (!r) {
        titleEl.textContent = t('detail.notFound');
        listEl.innerHTML = '';
        return;
      }
      titleEl.textContent = r.name;
      renderMeta(metaEl, r);
      allReviews = await listReviewsForRestaurant(id);
      renderList();
    } catch (err) {
      console.error('[detail] load failed:', err);
      titleEl.textContent = t('common.loadFailed');
    }
  })();

  return wrap;
}

/**
 * Generic single-select picker modal — used for both the restaurant-level
 * 🚩 (詳細頁右上) and the per-review 🚩. Replaces the prior
 * `window.confirm` cycle so reasons land in one screen instead of
 * tap-through-each-option.
 */
interface ReportPickerOpts {
  title: string;
  hint?: string;
  reasons: readonly string[];
  onPick: (reason: string) => void;
}

function openReportPicker(host: HTMLElement, opts: ReportPickerOpts): void {
  const overlay = document.createElement('div');
  overlay.className = 'report-picker-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.innerHTML = `
    <div class="report-picker-card">
      <h2 class="report-picker-title">${escapeHtml(opts.title)}</h2>
      ${opts.hint ? `<p class="report-picker-hint">${escapeHtml(opts.hint)}</p>` : ''}
      <fieldset class="report-picker-reasons">
        <legend class="report-picker-legend">原因</legend>
        ${opts.reasons
          .map(
            (r, i) => `
            <label class="report-picker-reason">
              <input type="radio" name="report-reason" value="${escapeHtml(r)}" ${i === 0 ? 'checked' : ''} />
              <span>${escapeHtml(r)}</span>
            </label>`,
          )
          .join('')}
      </fieldset>
      <div class="report-picker-actions">
        <button type="button" class="btn text-btn-m btn-secondary btn-l text-btn-l" data-act="cancel">取消</button>
        <button type="button" class="btn text-btn-m btn-primary btn-l text-btn-l" data-act="confirm">送出</button>
      </div>
    </div>
  `;

  function close(): void { overlay.remove(); }

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) { close(); return; }
    const act = (e.target as HTMLElement).closest<HTMLElement>('[data-act]')?.dataset.act;
    if (!act) return;
    if (act === 'cancel') { close(); return; }
    if (act === 'confirm') {
      const picked = overlay.querySelector<HTMLInputElement>('input[name="report-reason"]:checked');
      if (!picked) return;
      const reason = picked.value;
      close();
      opts.onPick(reason);
    }
  });

  host.appendChild(overlay);
}

function renderMeta(el: HTMLElement, r: Restaurant): void {
  el.innerHTML = `
    <a class="detail-line detail-addr-link" href="${googleMapsPlaceUrl(r)}" target="_blank" rel="noopener noreferrer">
      <span class="ms">place</span>
      <span>${escapeHtml(r.address)}</span>
      <span class="ms detail-addr-arrow" aria-hidden="true">open_in_new</span>
    </a>
    <div class="detail-line">
      <span class="ms">restaurant</span>
      <span>${placeLabel(r.place_type)}</span>
      ${r.is_partner ? '<span class="map-partner-tag">合作</span>' : ''}
    </div>
    ${
      r.partner_discount
        ? `<div class="detail-line detail-discount"><span class="ms">redeem</span><span>${escapeHtml(r.partner_discount)}</span></div>`
        : ''
    }
  `;
}

/**
 * Spec §3.3 「評論字體右方：計算個素別選擇人數」 — surface a tally of how
 * many reviewers picked each 素別 above the list. Counts are computed
 * from the FULL review set (not the active filter) so the user can see
 * how big the other buckets are while drilling into one. Clicking a
 * chip toggles a filter on the reviews list (chip → `selectedTier`).
 */
function renderVeganTally(reviews: RestaurantReview[], selectedTier: string | null): string {
  if (reviews.length === 0) return '';
  const counts = new Map<string, number>();
  for (const rv of reviews) {
    if (!rv.vegan_type) continue;
    for (const tier of rv.vegan_type.split(',').map((s) => s.trim()).filter(Boolean)) {
      counts.set(tier, (counts.get(tier) ?? 0) + 1);
    }
  }
  if (counts.size === 0) return '';
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return `
    <div class="vegan-tally" role="group" aria-label="${t('tally.aria')}">
      ${sorted
        .map(([tier, n]) => {
          const active = selectedTier === tier;
          const title = t('tally.filterTitle').replace('{tier}', escapeHtml(tier));
          return `<button class="vegan-tally-chip${active ? ' is-active' : ''}" data-tier="${escapeHtml(tier)}" type="button" aria-pressed="${active}" title="${title}"><span class="vegan-tally-label">${escapeHtml(tier)}</span><span class="vegan-tally-count">×${n}</span></button>`;
        })
        .join('')}
      ${selectedTier ? `<button class="vegan-tally-clear" type="button" data-clear="1" title="${t('tally.clearTitle')}"><span class="ms">close</span>${t('tally.clear')}</button>` : ''}
    </div>
  `;
}

function renderReviews(
  el: HTMLElement,
  reviews: RestaurantReview[],
  currentUserId: number | null,
  selectedTier: string | null,
): void {
  const tally = renderVeganTally(reviews, selectedTier);
  // Apply the selected-tier filter to the rows only — the tally above
  // keeps showing total counts so the user can see what's in other
  // buckets while drilling into one.
  const visible = selectedTier
    ? reviews.filter((rv) =>
        (rv.vegan_type ?? '')
          .split(',')
          .map((s) => s.trim())
          .includes(selectedTier),
      )
    : reviews;
  if (visible.length === 0) {
    const empty = reviews.length === 0
      ? `<p class="reviews-empty">${t('detail.emptyReviews')}</p>`
      : `<p class="reviews-empty">${t('detail.empty.filtered').replace('{tier}', escapeHtml(selectedTier ?? ''))}</p>`;
    el.innerHTML = tally + empty;
    return;
  }
  el.innerHTML = tally + visible
    .map((rv) => {
      const isMine = currentUserId !== null && rv.user_id === currentUserId;
      // Own-review row drops the report flag (no point reporting
      // yourself) and gains an edit action. Delete was removed
      // 2026-06-25 per policy: users contact customer support to
      // remove a review — see FAQ Q6.
      const actions = isMine
        ? `<button class="review-edit" type="button" aria-label="${t('detail.editReview')}" title="${t('detail.editReview')}">
             <span class="ms">edit</span>
           </button>`
        : `<button class="review-flag" data-review-id="${rv.id}" type="button" aria-label="${t('detail.reportReview')}" title="${t('detail.reportReview')}">
             <span class="ms">flag</span>
           </button>`;
      return `
      <article class="review-item${isMine ? ' is-mine' : ''}">
        <div class="review-head">
          <span class="review-stars" aria-label="${rv.rating} 顆星">${'★'.repeat(rv.rating)}${'☆'.repeat(5 - rv.rating)}</span>
          ${rv.vegan_type ? `<span class="review-tag">${escapeHtml(rv.vegan_type)}</span>` : ''}
          ${isMine ? `<span class="review-mine-tag">${t('detail.myReview')}</span>` : ''}
          <span class="review-date">${formatDate(rv.created_at)}</span>
          ${actions}
        </div>
        ${rv.text ? `<p class="review-text">${escapeHtml(rv.text)}</p>` : ''}
      </article>`;
    })
    .join('');
}

function formatDate(s: string): string {
  return s.split(' ')[0] ?? s;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;',
  );
}
