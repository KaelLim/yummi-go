/**
 * Review-guideline popup (spec #18 `review_guideline`, 2026-06-24).
 *
 * Fires exactly once — the first time the user enters EITHER the
 * restaurant verification flow (/map/restaurant/:id/verify) or the
 * restaurant review flow (/map/restaurant/:id/review). Once shown
 * and dismissed, a localStorage flag prevents it from reappearing
 * on subsequent visits. Independent of route — the next entry into
 * either flow won't trip it.
 *
 * The popup is appended to the host element, not document.body, so
 * it lives inside the route's lifecycle (back-button-safe). The
 * "我知道了" CTA + the close X both remove the overlay AND set the
 * persisted flag.
 *
 * Dev panel exposes `clearReviewGuidelineShown` to wipe the flag
 * for retesting.
 */
import { KEYS, storage } from '@/lib/storage';
import { $locale, type Locale, t } from '@/lib/i18n';
import { bind } from '@/lib/lifecycle';

/** True when the popup has already been shown + dismissed once. */
export function hasShownReviewGuideline(): boolean {
  return storage.get<boolean>(KEYS.REVIEW_GUIDELINE_SHOWN, false) === true;
}

/** Mark as shown so it won't fire again. */
function markShown(): void {
  storage.set(KEYS.REVIEW_GUIDELINE_SHOWN, true);
}

/** Dev-only — wipe the flag so the popup re-fires on next entry. */
export function clearReviewGuidelineShown(): void {
  storage.remove(KEYS.REVIEW_GUIDELINE_SHOWN);
}

/**
 * Mounts the popup inside `host` if it hasn't been shown yet.
 * Safe to call on every verify/review-route mount — early-exits when
 * the flag is set.
 */
export function maybeShowReviewGuideline(host: HTMLElement): void {
  if (hasShownReviewGuideline()) return;

  const overlay = document.createElement('div');
  overlay.className = 'review-guideline-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');

  const card = document.createElement('div');
  card.className = 'review-guideline-card';
  card.addEventListener('click', (e) => e.stopPropagation());
  overlay.append(card);

  function paint(locale: Locale): void {
    const closeLabel = locale === 'en' ? 'Close' : '關閉';
    card.innerHTML = `
      <header class="review-guideline-head">
        <span class="review-guideline-eyebrow">${escapeHtml(t('reviewGuideline.eyebrow'))}</span>
        <button class="review-guideline-close" type="button" aria-label="${escapeAttr(closeLabel)}">
          <span class="ms">close</span>
        </button>
      </header>
      <h2 class="review-guideline-title">${escapeHtml(t('reviewGuideline.title'))}</h2>
      <ul class="review-guideline-list">
        <li>${escapeHtml(t('reviewGuideline.point1'))}</li>
        <li>${escapeHtml(t('reviewGuideline.point2'))}</li>
        <li>${escapeHtml(t('reviewGuideline.point3'))}</li>
      </ul>
      <p class="review-guideline-foot">${escapeHtml(t('reviewGuideline.footnote'))}</p>
      <button class="btn btn-primary btn-l text-btn-l review-guideline-cta" type="button">
        ${escapeHtml(t('reviewGuideline.cta'))}
      </button>
    `;
    card.querySelector<HTMLButtonElement>('.review-guideline-close')?.addEventListener('click', dismiss);
    card.querySelector<HTMLButtonElement>('.review-guideline-cta')?.addEventListener('click', dismiss);
  }

  function dismiss(): void {
    markShown();
    overlay.remove();
  }

  paint($locale.get());
  bind(overlay, $locale, paint);
  host.appendChild(overlay);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;',
  );
}

function escapeAttr(s: string): string {
  return escapeHtml(s);
}
