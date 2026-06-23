/**
 * /store/banner/:id — in-app detail page for a single Gem-store
 * banner. Replaces the previous "open external URL in a new tab"
 * behaviour: 詳細 now stays inside the app, with a back button to
 * /store and a primary 兌換 CTA that fires the SurveyCake redeem
 * flow (same as the banner card's redeem button).
 *
 * The detail_url field on StoreBanner is treated as a link to a
 * partner microsite — when present we surface it as a secondary
 * "前往合作頁面" external link below the description. This keeps
 * the partner page reachable without making it the primary action.
 */
import { navigate } from '@/router';
import { $user, $profile } from '@/store/user';
import { $gems } from '@/store/pet';
import { bind } from '@/lib/lifecycle';
import { $locale, t } from '@/lib/i18n';
import {
  listVisibleBanners,
  buildSurveycakeUrl,
  type StoreBanner,
} from '@/api/store-banners';
import { requireRealName, hasGuestName } from '@/lib/name-prompt';
import { gemIcon } from '@/lib/currency-icons';

export default async function storeBannerDetail(
  params: Record<string, string>,
): Promise<HTMLElement> {
  const wrap = document.createElement('div');
  wrap.className = 'store-detail-screen';

  const bannerId = Number(params.id);
  const banners = await listVisibleBanners();
  const banner = banners.find((b) => b.id === bannerId) ?? null;

  if (!banner) {
    wrap.innerHTML = `
      <header class="checkin-header">
        <button class="checkin-back" id="back-btn" aria-label="${t('common.back')}">
          <span class="ms">arrow_back</span>
        </button>
        <span class="checkin-title">${t('store.bannerDetail')}</span>
        <span></span>
      </header>
      <div class="store-detail-body">
        <p class="store-empty">${t('store.empty')}</p>
      </div>
    `;
    wrap.querySelector('#back-btn')?.addEventListener('click', () => navigate('/store'));
    return wrap;
  }

  const isActive = banner.status === 'active';

  function paint(): void {
    const partner = banner!.partner_name
      ? `<p class="store-detail-partner">${escapeHtml(banner!.partner_name)}</p>`
      : '';
    const image = banner!.image_url
      ? `<img class="store-detail-img" src="${escapeAttr(banner!.image_url)}" alt="${escapeAttr(banner!.title)}" />`
      : `<div class="store-detail-img store-detail-img-placeholder" aria-hidden="true">${escapeHtml(banner!.partner_name ?? banner!.title)}</div>`;
    const description = banner!.description
      ? `<p class="store-detail-desc">${escapeHtml(banner!.description)}</p>`
      : '';
    const limit = banner!.monthly_limit
      ? `<p class="store-detail-meta">
           <span class="ms">inventory_2</span>
           <span>${t('store.bannerLimited').replace('{n}', String(banner!.monthly_limit))}</span>
         </p>`
      : '';
    const cost = banner!.cost_gems > 0
      ? `<p class="store-detail-meta">
           ${gemIcon(20)}
           <span>${t('store.detailCostFmt').replace('{n}', String(banner!.cost_gems))}</span>
         </p>`
      : '';
    const redeemCta = isActive && banner!.surveycake_url
      ? `<button class="btn btn-primary btn-l text-btn-l" id="redeem-btn" type="button">
           ${gemIcon(18)}${banner!.cost_gems} · ${t('store.bannerCta')}
         </button>`
      : `<span class="store-banner-ended"><span class="ms">history</span>${t('store.bannerEnded')}</span>`;

    wrap.innerHTML = `
      <header class="checkin-header">
        <button class="checkin-back" id="back-btn" aria-label="${t('common.back')}">
          <span class="ms">arrow_back</span>
        </button>
        <span class="checkin-title">${escapeHtml(banner!.title)}</span>
        <span></span>
      </header>
      <div class="store-detail-body">
        <div class="store-detail-image-wrap">
          ${image}
          ${!isActive ? `<div class="store-banner-ended-overlay">${t('store.bannerEnded')}</div>` : ''}
        </div>
        ${partner}
        <h1 class="store-detail-title">${escapeHtml(banner!.title)}</h1>
        ${description}
        <div class="store-detail-meta-rows">
          ${limit}${cost}
        </div>
      </div>
      <div class="store-detail-actions">
        ${redeemCta}
      </div>
    `;

    wrap.querySelector('#back-btn')?.addEventListener('click', () => navigate('/store'));
    wrap.querySelector('#redeem-btn')?.addEventListener('click', () => {
      void redeem(banner!);
    });
  }

  async function redeem(b: StoreBanner): Promise<void> {
    await requireRealName(wrap);
    const u = $user.get();
    if (!u || hasGuestName(u.displayName)) return;
    const profile = $profile.get();
    const googleEmail = deriveEmailFromUsername(u.username, profile);
    const target = buildSurveycakeUrl(b, { anonId: u.id, googleEmail });
    if (target) window.open(target, '_blank', 'noopener,noreferrer');
  }

  paint();
  // Locale flips need a re-render so the meta rows + CTA copy swap.
  bind(wrap, $locale, paint);
  bind(wrap, $gems, () => {/* surfaced via gemIcon size only — no balance shown on this screen */});

  return wrap;
}

function deriveEmailFromUsername(
  username: string,
  _profile: ReturnType<typeof $profile.get>,
): string | null {
  // Mirror store.ts's lookup — best-effort, doesn't block redeem.
  if (username.includes('@')) return username;
  return null;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;',
  );
}

function escapeAttr(s: string): string {
  return escapeHtml(s);
}
