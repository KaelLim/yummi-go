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
import { listReviewsForRestaurant, type RestaurantReview } from '@/api/reviews';

const PLACE_LABEL: Record<string, string> = {
  chinese: '中式',
  western: '西式',
  cafe: '咖啡',
  japanese: '日式',
  thai: '泰式',
  dessert: '甜點',
};

/** Reasons surfaced when the user reports the *restaurant* (top-right flag).
 *  Primary use case is "店家似乎已歇業" — the rest are practical follow-ups. */
const RESTAURANT_REPORT_REASONS = [
  '已歇業',
  '位置錯誤',
  '不再供應素食',
  '其他',
];

/** Reasons surfaced when the user reports a *single review* (per-row flag). */
const REVIEW_REPORT_REASONS = [
  '不當內容',
  '廣告 / 垃圾訊息',
  '不實評論',
  '其他',
];

export default function detail(params: Record<string, string>): HTMLElement {
  const id = Number(params.id);
  const wrap = document.createElement('div');
  wrap.className = 'restaurant-detail';
  wrap.innerHTML = `
    <header class="detail-header">
      <button class="checkin-back" id="back-btn" aria-label="返回地圖">
        <span class="ms">arrow_back</span>
      </button>
      <span class="checkin-title" id="title">載入中…</span>
      <button class="detail-flag-btn" id="report-btn" aria-label="檢舉店家（已歇業 / 位置錯誤等）" title="檢舉店家">
        <span class="ms">flag</span>
      </button>
    </header>
    <div class="detail-body">
      <section class="detail-meta" id="meta"></section>
      <section class="reviews">
        <div class="reviews-head">
          <h2 class="reviews-title">評論</h2>
          <button class="btn text-btn-m btn-primary btn-sm text-mini" id="add-review">
            <span class="ms">edit</span>寫評論
          </button>
        </div>
        <div class="reviews-list" id="reviews-list">
          <p class="reviews-empty">載入中…</p>
        </div>
      </section>
    </div>
  `;

  const titleEl = wrap.querySelector<HTMLElement>('#title')!;
  const metaEl = wrap.querySelector<HTMLElement>('#meta')!;
  const listEl = wrap.querySelector<HTMLElement>('#reviews-list')!;

  wrap.querySelector('#back-btn')?.addEventListener('click', () => navigate('/map'));
  wrap.querySelector('#add-review')?.addEventListener('click', () => navigate(`/map/restaurant/${id}/review`));
  wrap.querySelector('#report-btn')?.addEventListener('click', () => {
    const reason = RESTAURANT_REPORT_REASONS.find((r) =>
      window.confirm(`檢舉店家：「${r}」？\n（取消以查看下一個）`),
    );
    if (reason) {
      window.alert(`已記錄檢舉：${reason}`);
    }
  });

  // Event delegation for per-review flag — listEl is re-rendered after the
  // reviews fetch, so binding listeners per-row would require re-binding
  // on every render. One listener on the list covers all rows including
  // those that haven't been rendered yet.
  listEl.addEventListener('click', (e) => {
    const target = (e.target as Element).closest<HTMLButtonElement>('.review-flag');
    if (!target) return;
    const reviewId = target.dataset.reviewId;
    const reason = REVIEW_REPORT_REASONS.find((r) =>
      window.confirm(`檢舉這則評論：「${r}」？\n（取消以查看下一個）`),
    );
    if (reason) {
      window.alert(`已記錄檢舉：${reason}${reviewId ? `（評論 #${reviewId}）` : ''}`);
    }
  });

  void (async () => {
    try {
      const r = await getRestaurant(id);
      if (!r) {
        titleEl.textContent = '店家不存在';
        listEl.innerHTML = '';
        return;
      }
      titleEl.textContent = r.name;
      renderMeta(metaEl, r);
      const reviews = await listReviewsForRestaurant(id);
      renderReviews(listEl, reviews);
    } catch (err) {
      console.error('[detail] load failed:', err);
      titleEl.textContent = '載入失敗';
    }
  })();

  return wrap;
}

function renderMeta(el: HTMLElement, r: Restaurant): void {
  el.innerHTML = `
    <div class="detail-line">
      <span class="ms">place</span>
      <span>${escapeHtml(r.address)}</span>
    </div>
    <div class="detail-line">
      <span class="ms">restaurant</span>
      <span>${PLACE_LABEL[r.place_type] ?? r.place_type}</span>
      ${r.is_partner ? '<span class="map-partner-tag">合作</span>' : ''}
    </div>
    ${
      r.partner_discount
        ? `<div class="detail-line detail-discount"><span class="ms">redeem</span><span>${escapeHtml(r.partner_discount)}</span></div>`
        : ''
    }
  `;
}

function renderReviews(el: HTMLElement, reviews: RestaurantReview[]): void {
  if (reviews.length === 0) {
    el.innerHTML = '<p class="reviews-empty">還沒有評論，成為第一位吧！</p>';
    return;
  }
  el.innerHTML = reviews
    .map(
      (rv) => `
      <article class="review-item">
        <div class="review-head">
          <span class="review-stars" aria-label="${rv.rating} 顆星">${'★'.repeat(rv.rating)}${'☆'.repeat(5 - rv.rating)}</span>
          ${rv.vegan_type ? `<span class="review-tag">${escapeHtml(rv.vegan_type)}</span>` : ''}
          <span class="review-date">${formatDate(rv.created_at)}</span>
          <button class="review-flag" data-review-id="${rv.id}" type="button" aria-label="檢舉這則評論" title="檢舉這則評論">
            <span class="ms">flag</span>
          </button>
        </div>
        ${rv.text ? `<p class="review-text">${escapeHtml(rv.text)}</p>` : ''}
      </article>`,
    )
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
