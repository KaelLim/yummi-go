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
import { navigate } from '@/router';
import { listVisibleBanners, buildSurveycakeUrl, type StoreBanner } from '@/api/store-banners';
import { requireRealName, hasGuestName } from '@/lib/name-prompt';
import { gemIcon } from '@/lib/currency-icons';

export default function store(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'store-screen';
  wrap.innerHTML = `
    <header class="store-header">
      <h1 class="store-title" data-bind="store-title">${t('store.title')}</h1>
      <div class="store-balance">
        ${gemIcon(22)}
        <span class="store-balance-num" data-bind="gems">0</span>
      </div>
    </header>
    <section class="store-tab-content" id="tab-content">
      <p class="store-empty">${t('store.loading')}</p>
    </section>
  `;

  bind(wrap, $gems, (g) => {
    const num = wrap.querySelector<HTMLElement>('[data-bind="gems"]');
    if (num) num.textContent = String(g.balance);
  });

  bind(wrap, $locale, () => {
    const title = wrap.querySelector<HTMLElement>('[data-bind="store-title"]');
    if (title) title.textContent = t('store.title');
    void renderActive();
  });

  async function renderActive(): Promise<void> {
    const panel = wrap.querySelector<HTMLElement>('#tab-content');
    if (!panel) return;
    panel.innerHTML = `<p class="store-empty">${t('store.loading')}</p>`;
    await renderBannersTab(panel);
  }
  void renderActive();

  async function renderBannersTab(panel: HTMLElement): Promise<void> {
    const banners = await listVisibleBanners();
    if (banners.length === 0) {
      panel.innerHTML = `<p class="store-empty">${t('store.empty')}</p>`;
      return;
    }
    panel.innerHTML = `<section class="store-banners">${banners.map(renderBanner).join('')}</section>`;
    // 詳細 — navigates to the in-app detail page (/store/banner/:id)
    // instead of opening an external URL. The detail page surfaces
    // the partner microsite link below the description for users who
    // still want to leave the app.
    panel.querySelectorAll<HTMLButtonElement>('[data-action="detail"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = Number(btn.dataset.id);
        if (!Number.isFinite(id)) return;
        navigate(`/store/banner/${id}`);
      });
    });
    // 兌換 — SurveyCake URL with anonId + googleEmail appended.
    // Gated by requireRealName so guest accounts get prompted first.
    panel.querySelectorAll<HTMLButtonElement>('[data-action="redeem"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = Number(btn.dataset.id);
        const banner = banners.find((b) => b.id === id);
        if (banner) openRedeemUrl(banner);
      });
    });
  }

  function openRedeemUrl(banner: StoreBanner): void {
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
  // Two side-by-side actions — 詳細 opens the standalone detail URL,
  // 兌換 opens the SurveyCake URL with anonId + googleEmail appended.
  // Disabled banners drop both buttons and show the ended badge.
  const detailUrl = b.detail_url || b.surveycake_url;
  const detailBtn = detailUrl
    ? `<button class="btn btn-secondary btn-sm text-mini store-banner-detail" type="button" data-action="detail" data-id="${b.id}">
         ${t('store.bannerDetail')}<span class="ms">open_in_new</span>
       </button>`
    : '';
  const redeemBtn = b.surveycake_url
    ? `<button class="btn btn-primary btn-sm text-mini store-banner-cta" type="button" data-action="redeem" data-id="${b.id}">
         ${gemIcon(16)}${b.cost_gems} · ${t('store.bannerCta')}
       </button>`
    : '';
  const action = isActive
    ? `${redeemBtn}${detailBtn}`
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
        <div class="store-banner-actions">${action}</div>
      </div>
    </article>
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
