/**
 * Currency icon helpers — return the markup for the redesigned XP
 * drop + Gem petal SVGs (2026-06-22). Centralising these means we
 * can swap the assets in one place when the design refreshes again
 * without touching every chip, banner CTA, toast, and modal.
 *
 * The helpers return HTML strings (the surrounding code uses
 * template literals + innerHTML). When inserted as plain <img> they
 * inherit `ms`-style sizing only if their parent gives them a width
 * — see the .currency-icon CSS rule in globals.css.
 */

export function xpIcon(size = 22): string {
  return `<img class="currency-icon currency-icon-xp" src="/icons/xp.svg" alt="XP" width="${size}" height="${size}" draggable="false" />`;
}

export function gemIcon(size = 22): string {
  return `<img class="currency-icon currency-icon-gem" src="/icons/gem.svg" alt="Gem" width="${size}" height="${size}" draggable="false" />`;
}
