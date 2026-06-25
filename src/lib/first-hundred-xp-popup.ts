/**
 * First-100-XP education popup (spec #43 `first_100_xp_popup`).
 *
 * Fires exactly ONCE in a user's lifetime — the first time they
 * cross 100 XP fed-to-pet (i.e. the daily pet-feed cap) and trigger
 * the milestone branch in `store/pet.awardXp`. Replaces the normal
 * per-day milestone popup (spec #26) on that single first crossing
 * so the user sees the educational copy instead of the celebratory
 * one. Subsequent crossings on later days route to the normal
 * milestone popup unchanged.
 *
 * Dismissal sets a persisted flag (KEYS.FIRST_100_XP_SHOWN) so the
 * popup never reappears. Dev panel exposes
 * `clearFirstHundredXpShown` to retest.
 *
 * The popup explains, in plain language:
 *   1. XP fills the pet's level bar up to 100/day.
 *   2. Any XP beyond 100/day automatically converts to Gems.
 *   3. Gems are the store currency — see /store.
 */
import { KEYS, storage } from '@/lib/storage';
import { $locale, type Locale, t } from '@/lib/i18n';
import { bind } from '@/lib/lifecycle';
import { xpIcon, gemIcon } from '@/lib/currency-icons';

export function hasShownFirstHundredXp(): boolean {
  return storage.get<boolean>(KEYS.FIRST_100_XP_SHOWN, false) === true;
}

function markShown(): void {
  storage.set(KEYS.FIRST_100_XP_SHOWN, true);
}

/** Dev-only — re-arm the popup so the next 100 XP crossing fires it. */
export function clearFirstHundredXpShown(): void {
  storage.remove(KEYS.FIRST_100_XP_SHOWN);
}

/**
 * Mounts the popup onto document.body (so it survives any route
 * transition the calling code may trigger). Idempotent: a previously
 * mounted popup is replaced rather than stacked.
 */
export function showFirstHundredXpPopup(): void {
  const existing = document.getElementById('first-100-xp-modal-host');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'first-100-xp-modal';
  overlay.id = 'first-100-xp-modal-host';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');

  const card = document.createElement('div');
  card.className = 'first-100-xp-card';
  card.addEventListener('click', (e) => e.stopPropagation());
  overlay.append(card);

  function paint(locale: Locale): void {
    const closeLabel = locale === 'en' ? 'Close' : '關閉';
    card.innerHTML = `
      <header class="first-100-xp-head">
        <span class="first-100-xp-eyebrow">${escapeHtml(t('first100xp.eyebrow'))}</span>
        <button class="first-100-xp-close" type="button" aria-label="${escapeAttr(closeLabel)}">
          <span class="ms">close</span>
        </button>
      </header>
      <div class="first-100-xp-hero">
        ${xpIcon(48)}
        <span class="first-100-xp-arrow">→</span>
        ${gemIcon(40)}
      </div>
      <h2 class="first-100-xp-title">${escapeHtml(t('first100xp.title'))}</h2>
      <ol class="first-100-xp-list">
        <li>
          <span class="first-100-xp-step-icon">${xpIcon(20)}</span>
          <span>${escapeHtml(t('first100xp.step1'))}</span>
        </li>
        <li>
          <span class="first-100-xp-step-icon">${gemIcon(20)}</span>
          <span>${escapeHtml(t('first100xp.step2'))}</span>
        </li>
        <li>
          <span class="first-100-xp-step-icon"><span class="ms">storefront</span></span>
          <span>${escapeHtml(t('first100xp.step3'))}</span>
        </li>
      </ol>
      <button class="btn btn-primary btn-l text-btn-l first-100-xp-cta" type="button">
        ${escapeHtml(t('first100xp.cta'))}
      </button>
    `;
    card.querySelector<HTMLButtonElement>('.first-100-xp-close')?.addEventListener('click', dismiss);
    card.querySelector<HTMLButtonElement>('.first-100-xp-cta')?.addEventListener('click', dismiss);
  }

  function dismiss(): void {
    markShown();
    overlay.remove();
  }

  paint($locale.get());
  bind(overlay, $locale, paint);
  document.body.appendChild(overlay);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;',
  );
}

function escapeAttr(s: string): string {
  return escapeHtml(s);
}
