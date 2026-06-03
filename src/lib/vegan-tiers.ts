/**
 * Shared 素別 (vegan-tier) catalogue.
 *
 * The four-tier classification used in review forms, verify forms, the
 * map filter chips, and the consensus banner colours. Renamed
 * 鍋邊素 → 方便蔬食 per the 2026-05-22 design update; descriptions
 * match the in-app info popover so users can pick the right tier.
 */

export interface VeganTier {
  /** Stored value (e.g. comma-joined into `restaurants.vegan_type` or
   *  `reviews.vegan_type`). Same string is used for the filter chip's
   *  `data-vegan` attribute on the map. */
  value: string;
  /** Display label — currently equal to `value`, but separated for the
   *  rare case a future tier needs an English/short form. */
  label: string;
  /** One-line description shown in the 素別 info popover. */
  description: string;
}

import { t as i18n } from './i18n';

const TIER_DEFS = [
  { value: '全素',     descKey: 'veganTier.vegan.desc' },
  { value: '蛋奶素',   descKey: 'veganTier.lactoovo.desc' },
  { value: '五辛素',   descKey: 'veganTier.fivePungent.desc' },
  { value: '方便蔬食', descKey: 'veganTier.convenient.desc' },
] as const;

// VEGAN_TIERS is consumed at module-init in some callers as a snapshot.
// We resolve descriptions lazily through getVeganTiers() when locale
// matters; the legacy array keeps the same shape so existing imports
// (filter chips, review form) just see the source tier labels.
export const VEGAN_TIERS: VeganTier[] = TIER_DEFS.map((d) => ({
  value: d.value,
  label: d.value,
  description: '',
}));

function getVeganTiers(): VeganTier[] {
  return TIER_DEFS.map((d) => ({
    value: d.value,
    label: d.value,
    description: i18n(d.descKey),
  }));
}

/**
 * Open a centred modal that explains each 素別 tier. Reuses the
 * `.vegan-info-overlay` CSS shipped in globals.css; appends to the
 * supplied host so the modal lives within the route element and tears
 * down with it. Click outside or on the close button to dismiss.
 */
export function openVeganTierInfo(host: HTMLElement): void {
  const existing = host.querySelector('.vegan-info-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'vegan-info-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  const tiers = getVeganTiers();
  overlay.innerHTML = `
    <div class="vegan-info-card">
      <header class="vegan-info-header">
        <h2 class="vegan-info-title">${i18n('veganInfo.title')}</h2>
        <button class="vegan-info-close" type="button" aria-label="${i18n('common.close')}">
          <span class="ms">close</span>
        </button>
      </header>
      <ul class="vegan-info-list">
        ${tiers.map(
          (tier) => `
          <li class="vegan-info-row">
            <span class="vegan-info-name">${tier.label}</span>
            <span class="vegan-info-desc">${tier.description}</span>
          </li>
        `,
        ).join('')}
      </ul>
      <p class="vegan-info-footnote">
        <span class="ms">info</span>
        ${i18n('veganInfo.footnote')}
      </p>
    </div>
  `;

  const close = () => overlay.remove();
  overlay.querySelector('.vegan-info-close')?.addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  host.appendChild(overlay);
}
