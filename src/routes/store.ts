/**
 * Gem Store — two tabs.
 *
 *   活動 (Campaigns)   — list of active + disabled banners from drust's
 *                       `store_banners`. Active = tappable card that
 *                       opens SurveyCake with anonId + googleEmail
 *                       query params (Phase B: webhook deducts gems).
 *   中獎名單 (Winners) — read-only list of past draw winners, grouped
 *                       by banner. Names are masked via maskName().
 *
 * Tab state is local (no URL hash) — switching tabs re-renders the
 * `#tab-content` panel. Both data sources fall back to fixtures
 * when drust is unreachable.
 */
import { $user, $profile } from '@/store/user';
import { $gems } from '@/store/pet';
import { bind } from '@/lib/lifecycle';
import { $locale, t } from '@/lib/i18n';
import { listVisibleBanners, buildSurveycakeUrl, type StoreBanner } from '@/api/store-banners';
import { listVisibleWinners, maskEmail, type StoreWinner } from '@/api/store-winners';
import { requireRealName, hasGuestName } from '@/lib/name-prompt';
import createModal from '@/components/Modal';

type Tab = 'banners' | 'winners';

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
    <div class="store-tabs" role="tablist">
      <button class="store-tab is-active" role="tab" aria-selected="true" data-tab="banners" data-bind="tab-banners">${t('store.tabBanners')}</button>
      <button class="store-tab" role="tab" aria-selected="false" data-tab="winners" data-bind="tab-winners">${t('store.tabWinners')}</button>
    </div>
    <section class="store-tab-content" id="tab-content">
      <p class="store-empty">${t('store.loading')}</p>
    </section>
  `;

  let activeTab: Tab = 'banners';

  bind(wrap, $gems, (g) => {
    const num = wrap.querySelector<HTMLElement>('[data-bind="gems"]');
    if (num) num.textContent = String(g.balance);
  });

  bind(wrap, $locale, () => {
    const title = wrap.querySelector<HTMLElement>('[data-bind="store-title"]');
    if (title) title.textContent = t('store.title');
    const tb = wrap.querySelector<HTMLElement>('[data-bind="tab-banners"]');
    if (tb) tb.textContent = t('store.tabBanners');
    const tw = wrap.querySelector<HTMLElement>('[data-bind="tab-winners"]');
    if (tw) tw.textContent = t('store.tabWinners');
    void renderActive();
  });

  wrap.querySelectorAll<HTMLButtonElement>('.store-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      const next = btn.dataset.tab as Tab;
      if (next === activeTab) return;
      activeTab = next;
      wrap.querySelectorAll<HTMLButtonElement>('.store-tab').forEach((b) => {
        const on = b.dataset.tab === activeTab;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-selected', String(on));
      });
      void renderActive();
    });
  });

  async function renderActive(): Promise<void> {
    const panel = wrap.querySelector<HTMLElement>('#tab-content');
    if (!panel) return;
    panel.innerHTML = `<p class="store-empty">${t('store.loading')}</p>`;
    if (activeTab === 'banners') {
      await renderBannersTab(panel);
    } else {
      await renderWinnersTab(panel);
    }
  }
  void renderActive();

  async function renderBannersTab(panel: HTMLElement): Promise<void> {
    const banners = await listVisibleBanners();
    if (banners.length === 0) {
      panel.innerHTML = `<p class="store-empty">${t('store.empty')}</p>`;
      return;
    }
    panel.innerHTML = `<section class="store-banners">${banners.map(renderBanner).join('')}</section>`;
    panel.querySelectorAll<HTMLElement>('.store-banner[data-active="1"]').forEach((card) => {
      card.addEventListener('click', (e) => {
        // Tapping the detail button or its icon shouldn't also trigger
        // the card's redeem action — let the detail handler take it.
        const target = e.target as HTMLElement;
        if (target.closest('[data-action="detail"]')) return;
        onTapActive(card, banners);
      });
    });
    panel.querySelectorAll<HTMLButtonElement>('[data-action="detail"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = Number(btn.dataset.id);
        const banner = banners.find((b) => b.id === id);
        if (banner) openBannerDetail(banner, banners);
      });
    });
  }

  function openBannerDetail(banner: StoreBanner, allBanners: StoreBanner[]): void {
    const body = document.createElement('div');
    body.className = 'store-banner-detail-body';
    const isActive = banner.status === 'active';
    const partner = banner.partner_name
      ? `<p class="store-banner-detail-partner">${escapeHtml(banner.partner_name)}</p>`
      : '';
    const image = banner.image_url
      ? `<img class="store-banner-detail-img" src="${escapeAttr(banner.image_url)}" alt="${escapeAttr(banner.title)}" />`
      : '';
    const description = banner.description
      ? `<p class="store-banner-detail-desc">${escapeHtml(banner.description)}</p>`
      : '';
    const limit = banner.monthly_limit
      ? `<p class="store-banner-detail-limit"><span class="ms">inventory_2</span>${t('store.bannerLimited').replace('{n}', String(banner.monthly_limit))}</p>`
      : '';
    const cost = banner.cost_gems > 0
      ? `<p class="store-banner-detail-cost"><span class="ms">diamond</span>${t('store.detailCostFmt').replace('{n}', String(banner.cost_gems))}</p>`
      : '';
    body.innerHTML = `${image}${partner}${description}${limit}${cost}`;

    const closeBtn = document.createElement('button');
    closeBtn.className = 'btn btn-secondary btn-l text-btn-l';
    closeBtn.textContent = t('store.bannerClose');
    closeBtn.type = 'button';
    const actions: HTMLElement[] = [closeBtn];

    if (isActive) {
      const ctaBtn = document.createElement('button');
      ctaBtn.className = 'btn btn-primary btn-l text-btn-l';
      ctaBtn.type = 'button';
      ctaBtn.innerHTML = `<span class="ms">diamond</span>${banner.cost_gems} · ${t('store.bannerCta')}`;
      ctaBtn.addEventListener('click', () => {
        modal.remove();
        const card = wrap.querySelector<HTMLElement>(`.store-banner[data-id="${banner.id}"]`);
        if (card) onTapActive(card, allBanners);
      });
      actions.push(ctaBtn);
    }

    const modal = createModal({
      title: banner.title,
      body,
      actions,
      onClose: () => modal.remove(),
    });
    closeBtn.addEventListener('click', () => modal.remove());
    wrap.appendChild(modal);
  }

  async function renderWinnersTab(panel: HTMLElement): Promise<void> {
    const winners = await listVisibleWinners();
    if (winners.length === 0) {
      panel.innerHTML = `<p class="store-empty">${t('store.winnersEmpty')}</p>`;
      return;
    }
    // Group by banner so each campaign gets its own block. Preserve
    // insertion order (already sorted newest-first by the API).
    const groups = new Map<number, { title: string; rows: StoreWinner[] }>();
    for (const w of winners) {
      let g = groups.get(w.banner_id);
      if (!g) {
        g = { title: w.banner_title, rows: [] };
        groups.set(w.banner_id, g);
      }
      g.rows.push(w);
    }
    panel.innerHTML = `<section class="store-winners">${
      Array.from(groups.entries())
        .map(([, g]) => renderWinnerGroup(g.title, g.rows))
        .join('')
    }</section>`;
  }

  function onTapActive(card: HTMLElement, banners: StoreBanner[]): void {
    const id = Number(card.dataset.id);
    const banner = banners.find((b) => b.id === id);
    if (!banner) return;
    void (async () => {
      await requireRealName(wrap);
      const u = $user.get();
      if (!u || hasGuestName(u.displayName)) return;
      const profile = $profile.get();
      const googleEmail = deriveEmailFromUsername(u.username, profile);
      const target = buildSurveycakeUrl(banner, { anonId: u.id, googleEmail });
      if (target) window.open(target, '_blank', 'noopener,noreferrer');
    })();
  }

  return wrap;
}

function renderBanner(b: StoreBanner): string {
  const isActive = b.status === 'active';
  const image = b.image_url
    ? `<img class="store-banner-img" src="${escapeAttr(b.image_url)}" alt="${escapeAttr(b.title)}" />`
    : `<div class="store-banner-img store-banner-img-placeholder" aria-hidden="true">${escapeHtml(b.partner_name ?? b.title)}</div>`;
  const limit = b.monthly_limit
    ? `<span class="store-banner-limit">${t('store.bannerLimited').replace('{n}', String(b.monthly_limit))}</span>`
    : '';
  const partner = b.partner_name
    ? `<span class="store-banner-partner">${escapeHtml(b.partner_name)}</span>`
    : '';
  const description = b.description
    ? `<p class="store-banner-desc">${escapeHtml(b.description)}</p>`
    : '';
  const cta = isActive
    ? `<button class="btn text-btn-m btn-primary btn-sm text-mini store-banner-cta" type="button"><span class="ms">diamond</span>${b.cost_gems} · ${t('store.bannerCta')}</button>`
    : `<span class="store-banner-ended"><span class="ms">history</span>${t('store.bannerEnded')}</span>`;

  return `
    <article class="store-banner ${isActive ? 'is-active' : 'is-disabled'}" data-id="${b.id}" data-active="${isActive ? '1' : '0'}">
      <div class="store-banner-image-wrap">
        ${image}
        ${!isActive ? `<div class="store-banner-ended-overlay">${t('store.bannerEnded')}</div>` : ''}
      </div>
      <div class="store-banner-body">
        ${partner}
        <h2 class="store-banner-title">${escapeHtml(b.title)}</h2>
        ${description}
        ${limit}
        <div class="store-banner-actions">
          <button class="btn btn-secondary btn-sm text-mini store-banner-detail" type="button" data-action="detail" data-id="${b.id}">
            <span class="ms">info</span>${t('store.bannerDetail')}
          </button>
          ${cta}
        </div>
      </div>
    </article>
  `;
}

function renderWinnerGroup(title: string, rows: StoreWinner[]): string {
  const datePart = rows[0]?.drawn_at.split(' ')[0] ?? '';
  const sub = datePart ? t('store.winnersDrawnFmt').replace('{date}', datePart) : '';
  return `
    <section class="winners-group">
      <header class="winners-group-head">
        <h2 class="winners-group-title">${escapeHtml(title)}</h2>
        ${sub ? `<span class="winners-group-sub">${escapeHtml(sub)}</span>` : ''}
      </header>
      <ul class="winners-list">
        ${rows.map((w) => `
          <li class="winners-row">
            <span class="ms winners-row-icon">emoji_events</span>
            <span class="winners-row-name">${escapeHtml(maskEmail(w.email ?? w.display_name))}</span>
          </li>
        `).join('')}
      </ul>
    </section>
  `;
}

function deriveEmailFromUsername(
  username: string,
  _profile: ReturnType<typeof $profile.get>,
): string | null {
  if (!username.startsWith('google_')) return null;
  return username.slice('google_'.length);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;',
  );
}
function escapeAttr(s: string): string { return escapeHtml(s); }
