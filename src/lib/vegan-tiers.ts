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

export const VEGAN_TIERS: VeganTier[] = [
  { value: '全素',     label: '全素',     description: '完全植物性，不含動物製品' },
  { value: '蛋奶素',   label: '蛋奶素',   description: '含蛋奶、不含肉類' },
  { value: '五辛素',   label: '五辛素',   description: '含五辛（蔥蒜韭薤興），不含肉類' },
  { value: '方便蔬食', label: '方便蔬食', description: '一般葷食店，但有蔬食選項' },
];

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
  overlay.innerHTML = `
    <div class="vegan-info-card">
      <header class="vegan-info-header">
        <h2 class="vegan-info-title">素別說明</h2>
        <button class="vegan-info-close" type="button" aria-label="關閉">
          <span class="ms">close</span>
        </button>
      </header>
      <ul class="vegan-info-list">
        ${VEGAN_TIERS.map(
          (t) => `
          <li class="vegan-info-row">
            <span class="vegan-info-name">${t.label}</span>
            <span class="vegan-info-desc">${t.description}</span>
          </li>
        `,
        ).join('')}
      </ul>
    </div>
  `;

  const close = () => overlay.remove();
  overlay.querySelector('.vegan-info-close')?.addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  host.appendChild(overlay);
}
