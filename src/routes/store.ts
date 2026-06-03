/**
 * Gem Store — placeholder.
 *
 * Replaces the 任務 (tasks) tab in the bottom nav per the 2026-05-19 user
 * pivot. The full store catalogue (pet outfits, makeup-card bundles,
 * cosmetics) hasn't been speced yet — this screen exists today as a stub
 * so the new tab routes somewhere meaningful and the rest of the UX
 * refactor can land without a phantom nav target.
 */
import { $gems } from '@/store/pet';
import { bind } from '@/lib/lifecycle';
import { $locale, t } from '@/lib/i18n';

export default function store(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'store-screen';
  wrap.innerHTML = `
    <header class="store-header">
      <h1 class="store-title" data-bind="store-title">${t('store.title')}</h1>
      <div class="store-balance">
        <span class="ms">diamond</span>
        <span class="store-balance-num" data-bind="gems">0</span>
      </div>
    </header>
    <section class="store-soon">
      <div class="store-soon-icon" aria-hidden="true">💎</div>
      <h2 class="store-soon-title" data-bind="store-soon-title">${t('store.soonTitle')}</h2>
      <p class="store-soon-text" data-bind="store-soon-text">${t('store.soonText')}</p>
    </section>
  `;

  bind(wrap, $gems, (g) => {
    const num = wrap.querySelector<HTMLElement>('[data-bind="gems"]');
    if (num) num.textContent = String(g.balance);
  });

  bind(wrap, $locale, () => {
    const title = wrap.querySelector<HTMLElement>('[data-bind="store-title"]');
    if (title) title.textContent = t('store.title');
    const soonTitle = wrap.querySelector<HTMLElement>('[data-bind="store-soon-title"]');
    if (soonTitle) soonTitle.textContent = t('store.soonTitle');
    const soonText = wrap.querySelector<HTMLElement>('[data-bind="store-soon-text"]');
    if (soonText) soonText.innerHTML = t('store.soonText');
  });

  return wrap;
}
