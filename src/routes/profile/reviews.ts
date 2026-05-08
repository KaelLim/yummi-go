/**
 * My reviews — list of restaurant_reviews where user_id = current user,
 * with restaurant name resolved via getRestaurant.
 */
import { navigate } from '@/router';
import { $user } from '@/store/user';
import { listMyReviews, type RestaurantReview } from '@/api/reviews';
import { getRestaurant } from '@/api/content';

export default function myReviews(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'reviews-screen';
  wrap.innerHTML = `
    <header class="checkin-header">
      <button class="checkin-back" id="back-btn" aria-label="返回">
        <span class="ms">arrow_back</span>
      </button>
      <span class="checkin-title">我的評論</span>
      <span></span>
    </header>
    <div class="reviews-list" id="list">
      <p class="reviews-empty">載入中…</p>
    </div>
  `;

  wrap.querySelector('#back-btn')?.addEventListener('click', () => navigate('/profile'));

  void hydrate(wrap);

  return wrap;
}

async function hydrate(wrap: HTMLElement): Promise<void> {
  const u = $user.get();
  if (!u) {
    navigate('/login');
    return;
  }
  const listEl = wrap.querySelector<HTMLElement>('#list')!;

  let reviews: RestaurantReview[] = [];
  try {
    reviews = await listMyReviews(u.id);
  } catch (err) {
    listEl.innerHTML = '<p class="reviews-empty">載入失敗</p>';
    console.warn('[my-reviews] load failed:', err);
    return;
  }

  if (reviews.length === 0) {
    listEl.innerHTML = '<p class="reviews-empty">還沒寫過評論。打開地圖找一家去評論看看吧！</p>';
    return;
  }

  // Resolve restaurant names in parallel.
  const ids = Array.from(new Set(reviews.map((r) => r.restaurant_id)));
  const idToName = new Map<number, string>();
  await Promise.all(
    ids.map(async (id) => {
      try {
        const r = await getRestaurant(id);
        if (r) idToName.set(id, r.name);
      } catch {
        /* skip */
      }
    }),
  );

  listEl.innerHTML = reviews
    .map(
      (r) => `
      <article class="review-item review-item-mine" data-id="${r.id}">
        <div class="review-head">
          <strong class="review-restaurant">${escapeHtml(idToName.get(r.restaurant_id) ?? `店家 #${r.restaurant_id}`)}</strong>
          <span class="review-stars">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</span>
          <span class="review-date">${formatDate(r.created_at)}</span>
        </div>
        ${r.text ? `<p class="review-text">${escapeHtml(r.text)}</p>` : ''}
        <div class="review-actions">
          <button class="link-btn" data-go="/map/restaurant/${r.restaurant_id}">前往店家</button>
        </div>
      </article>`,
    )
    .join('');

  listEl.querySelectorAll<HTMLButtonElement>('button[data-go]').forEach((b) => {
    b.addEventListener('click', () => navigate(b.dataset.go!));
  });
}

function formatDate(s: string): string {
  return s.split(' ')[0] ?? s;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;',
  );
}
