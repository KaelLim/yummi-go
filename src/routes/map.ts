/**
 * Map route — Leaflet + OSM tiles, three-tier pin markers, filter chips.
 *
 * Pins (UX_UPDATE_SPEC_v0.1 §6):
 *   - gray   → unverified — tapping opens the verification sheet
 *   - green  → verified
 *   - blue (legacy enum, rendered orange) → partner store
 *
 * Filters:
 *   - 素別 chip group (全部 / Vegan / Vegetarian / Veggie Option)
 *   - 合作 toggle (is_partner = 1) — single switch button
 *
 * Clicking a verified/partner marker surfaces a bottom card with the
 * 進詳情 CTA. Clicking a gray pin instead opens a verification sheet:
 * radio of vegan-types + optional photo + comment → submit awards
 * +20 XP and flips the pin to green.
 *
 * Map cleanup uses lifecycle.onUnmount so leaving the route disposes the
 * Leaflet instance (otherwise it would leak listeners and a dangling DOM
 * subtree of tiles).
 */
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { navigate } from '@/router';
import {
  listRestaurants,
  parseVeganTypes,
  parseActivityTags,
  ACTIVITY_TAG_PARTNER,
  ACTIVITY_TAG_600,
  ACTIVITY_TAG_OTHER,
  type Restaurant,
} from '@/api/content';
import { listAllReviews, aggregateConsensusTiers } from '@/api/reviews';
import { onUnmount } from '@/lib/lifecycle';
import { $user } from '@/store/user';
import { requireRealName } from '@/lib/name-prompt';
import { googleMapsPlaceUrl } from '@/lib/google-maps-link';
import { openVeganTierInfo } from '@/lib/vegan-tiers';

const PLACE_LABEL: Record<string, string> = {
  chinese: '中式',
  western: '西式',
  cafe: '咖啡',
  japanese: '日式',
  thai: '泰式',
  dessert: '甜點',
};

const PIN_COLOR: Record<Restaurant['pin_color'], string> = {
  green: '#1d5937',
  gray: '#7a7a7a',
  // Legacy 'blue' enum now renders orange — partner tier per §6.
  blue: '#f59e0b',
};

/**
 * Display color for a restaurant pin.
 *
 * Partners always render orange — even if their `pin_color` column was
 * seeded as 'gray' or 'green'. This makes "合作店家 = 橘色" a single
 * source of truth at the render layer, so any future data drift can't
 * leave a partner showing as a verified green or unverified gray pin.
 */
function pinColorFor(r: Restaurant): string {
  if (r.is_partner === 1) return PIN_COLOR.blue;
  return PIN_COLOR[r.pin_color];
}

interface VeganTypeOption {
  value: string;
  label: string;
}

/**
 * Filter chips use the same 4-tier list as the review/verify forms
 * (全素 / 蛋奶素 / 五辛素 / 鍋邊素) so 「filter → restaurant tier flags」
 * lines up. value === label here because the stored vegan_type list is
 * also Chinese (comma-separated, e.g. "全素,蛋奶素").
 */
// Sourced from shared lib/vegan-tiers so the review/verify forms, the
// map filter chips, and the consensus banner colours all stay in sync.
import { VEGAN_TIERS } from '@/lib/vegan-tiers';
const VEGAN_TYPES: VeganTypeOption[] = VEGAN_TIERS.map((t) => ({ value: t.value, label: t.label }));

interface FilterState {
  veganType: string | null; // null = all
  /**
   * Set of enabled activity tags (合作店家 / 蔬食 600 盤 / 其他).
   * Per spec §1.5 the default is all-on, so a restaurant passes the
   * filter when at least one of its derived tags is still in this set.
   * Empty set ⇒ no restaurants visible (user has deselected everything).
   */
  activityTags: Set<string>;
  query: string; // free-text search over restaurant names
}

interface ActivityTagOption {
  value: string;
  label: string;
  icon: string;
}

const ACTIVITY_TAG_OPTIONS: ActivityTagOption[] = [
  { value: ACTIVITY_TAG_PARTNER, label: '合作店家',      icon: 'handshake' },
  { value: ACTIVITY_TAG_600,     label: '蔬食 600 盤',   icon: 'restaurant' },
  { value: ACTIVITY_TAG_OTHER,   label: '其他',          icon: 'storefront' },
];

export default function map(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'map-screen';
  wrap.innerHTML = `
    <header class="map-header">
      <h1 class="map-title">
        蔬食地圖
        <button class="vegan-info-btn vegan-info-btn-inline" id="map-vegan-info-btn" type="button" aria-label="素別說明" title="素別說明">
          <span class="ms">info</span>
        </button>
      </h1>
      <span class="map-meta" id="result-count">載入中…</span>
    </header>
    <div class="map-search">
      <span class="ms map-search-icon" aria-hidden="true">search</span>
      <input
        type="search"
        id="map-search"
        class="map-search-input"
        placeholder="搜尋店家名稱或料理類型（中式、咖啡…）"
        autocomplete="off"
        aria-label="搜尋店家"
      />
      <button class="map-search-clear" id="map-search-clear" type="button" aria-label="清除搜尋" hidden>
        <span class="ms">close</span>
      </button>
    </div>
    <div class="map-filters" id="filters">
      <button class="filter-chip selected" data-vegan="">全部</button>
      ${VEGAN_TYPES.map(
        (v) => `<button class="filter-chip" data-vegan="${v.value}">${v.label}</button>`,
      ).join('')}
    </div>
    <div class="map-filters map-filters-activity" id="activity-filters" role="group" aria-label="活動標籤（可複選）">
      ${ACTIVITY_TAG_OPTIONS.map(
        (a) => `<button class="filter-chip filter-activity selected" data-activity="${a.value}"><span class="ms">${a.icon}</span>${a.label}</button>`,
      ).join('')}
    </div>
    <div class="map-canvas" id="canvas"></div>
    <div class="map-card" id="card" hidden></div>
  `;
  // Name prompt overlay is now built lazily by `requireRealName`
  // (lib/name-prompt) — no inline HTML needed. Guards keep firing on
  // map mount AND before any social action (寫評論 / 認證餐廳).

  const canvas = wrap.querySelector<HTMLDivElement>('#canvas')!;
  const card = wrap.querySelector<HTMLDivElement>('#card')!;
  const countEl = wrap.querySelector<HTMLElement>('#result-count')!;

  // Default centered on Taipei; will refit once data loads.
  const leafletMap = L.map(canvas, {
    zoomControl: false,
    attributionControl: false,
  }).setView([25.0413, 121.5439], 13);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
  }).addTo(leafletMap);

  const filterState: FilterState = {
    veganType: null,
    activityTags: new Set(ACTIVITY_TAG_OPTIONS.map((a) => a.value)),
    query: '',
  };
  let allRestaurants: Restaurant[] = [];
  let currentMarkers: L.Marker[] = [];
  let selectedId: number | null = null;
  // Per-restaurant consensus tiers (vegan_type picked by ≥3 reviewers).
  // Empty until the reviews fetch resolves; renderCard reads from this
  // map directly so cards opened before the fetch lands simply show no
  // tags, then the next card render after the fetch shows them.
  let consensusTiers: Map<number, string[]> = new Map();

  /**
   * Tiers to fly on the card's flag bar. Union of:
   *   - admin-declared `vegan_type` column (e.g. set in drust admin)
   *   - crowd-sourced consensus tiers (≥3 reviewers, see §4 reviews)
   * Dedup preserves admin order first, then appends consensus extras.
   * This mirrors the filter logic — both surfaces agree on "what
   * counts as a 素別 for this restaurant" so a filter pick and a card
   * flag never disagree.
   */
  function tiersForCard(r: Restaurant): string[] {
    const out: string[] = [];
    for (const t of parseVeganTypes(r)) if (!out.includes(t)) out.push(t);
    for (const t of consensusTiers.get(r.id) ?? []) if (!out.includes(t)) out.push(t);
    return out;
  }

  function renderCard(r: Restaurant | null) {
    if (!r) {
      card.hidden = true;
      card.innerHTML = '';
      return;
    }
    card.hidden = false;
    // Gray pins show the same details card as verified pins; only the CTA
    // changes (認證餐廳 → opens the verification sheet) so the user can
    // read the basic info first instead of being dropped straight into a
    // form.
    // Partners overrule pin_color for the CTA decision too — even if a
    // partner is stored as 'gray', the card should not offer 認證餐廳.
    const isGray = r.pin_color === 'gray' && r.is_partner !== 1;
    const ctaLabel = isGray ? '認證餐廳' : '看詳情';
    card.innerHTML = `
      <div class="map-card-body">
        <div class="map-card-meta">
          <span class="map-pin-dot" style="background:${pinColorFor(r)}"></span>
          <span class="map-card-type">${PLACE_LABEL[r.place_type] ?? r.place_type}</span>
          ${r.is_partner ? '<span class="map-partner-tag">合作</span>' : ''}
          ${isGray ? '<span class="map-unverified-tag">未驗證</span>' : ''}
        </div>
        <div class="map-card-name">${escapeHtml(r.name)}</div>
        <div class="map-card-hours">
          <span class="ms">schedule</span>${r.business_hours
            ? escapeHtml(r.business_hours)
            : '<span class="map-card-hours-placeholder">營業時間未提供</span>'
          }
        </div>
        <a class="map-card-addr map-card-addr-link" href="${googleMapsPlaceUrl(r)}" target="_blank" rel="noopener noreferrer">
          <span class="ms">place</span>${escapeHtml(r.address)}
        </a>
        ${r.partner_discount ? `<div class="map-card-disc">優惠：${escapeHtml(r.partner_discount)}</div>` : ''}
      </div>
      ${renderConsensusTiers(tiersForCard(r))}
      <button class="btn text-btn-m btn-primary btn-sm text-mini" id="card-detail">${ctaLabel}</button>
    `;
    card.querySelector('#card-detail')?.addEventListener('click', () => {
      if (isGray) {
        // 認證餐廳 is a social action — make sure the user has a real
        // display name first so the verification's review credit reads
        // sensibly to other users.
        void (async () => {
          await requireRealName(wrap);
          navigate(`/map/restaurant/${r.id}/verify`);
        })();
      } else {
        navigate(`/map/restaurant/${r.id}`);
      }
    });
  }

  function renderMarkers() {
    for (const m of currentMarkers) m.remove();
    currentMarkers = [];
    const q = filterState.query.trim().toLowerCase();
    const filtered = allRestaurants.filter((r) => {
      // 素別 filter is satisfied by EITHER source of truth:
      //   - admin-declared `vegan_type` column on the restaurant, OR
      //   - the crowd-sourced consensus tier (≥3 reviewers picked it).
      // Without the OR, a restaurant can fly a 蛋奶素 banner from reviews
      // alone (no admin field set) and the filter would silently exclude
      // it — exactly the bug 老艋舺素食 hit.
      if (filterState.veganType) {
        const adminTiers = parseVeganTypes(r);
        const consensus = consensusTiers.get(r.id) ?? [];
        const matches =
          adminTiers.includes(filterState.veganType) ||
          consensus.includes(filterState.veganType);
        if (!matches) return false;
      }
      // 活動標籤 filter is multi-select: at least one of the restaurant's
      // derived tags must still be in the enabled set (§1.5 default
      // "all on"). Empty set ⇒ user has deselected everything.
      const tags = parseActivityTags(r);
      if (!tags.some((t) => filterState.activityTags.has(t))) return false;
      if (q) {
        // Match against name + dish type (both the enum key and its
        // localised label) + address, so "中式"/"chinese"/"忠孝東路"
        // all narrow the same way as a name query.
        const dishLabel = (PLACE_LABEL[r.place_type] ?? '').toLowerCase();
        const haystack = `${r.name} ${r.place_type} ${dishLabel} ${r.address}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
    countEl.textContent = `${filtered.length} 家店`;

    for (const r of filtered) {
      const isSelected = selectedId === r.id;
      const marker = L.marker([r.lat, r.lng], {
        icon: buildPinIcon(pinColorFor(r), isSelected),
      });
      marker.addTo(leafletMap);
      marker.bindTooltip(r.name, { direction: 'top', offset: [0, -28] });
      marker.on('click', () => {
        selectedId = r.id;
        renderCard(r);
        renderMarkers();
      });
      currentMarkers.push(marker);
    }

    if (filtered.length > 0 && selectedId === null) {
      const lats = filtered.map((r) => r.lat);
      const lngs = filtered.map((r) => r.lng);
      const bounds = L.latLngBounds([
        [Math.min(...lats), Math.min(...lngs)],
        [Math.max(...lats), Math.max(...lngs)],
      ]);
      leafletMap.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    }
  }

  // Search input — narrows by restaurant-name substring on every keystroke.
  const searchInput = wrap.querySelector<HTMLInputElement>('#map-search')!;
  const searchClear = wrap.querySelector<HTMLButtonElement>('#map-search-clear')!;
  searchInput.addEventListener('input', () => {
    filterState.query = searchInput.value;
    searchClear.hidden = filterState.query === '';
    selectedId = null;
    renderCard(null);
    renderMarkers();
  });
  searchClear.addEventListener('click', () => {
    searchInput.value = '';
    filterState.query = '';
    searchClear.hidden = true;
    selectedId = null;
    renderCard(null);
    renderMarkers();
    searchInput.focus();
  });

  // 素別 chips — exclusive radio (one selected at a time, 全部 == null).
  wrap.querySelectorAll<HTMLButtonElement>('.filter-chip[data-vegan]').forEach((c) => {
    c.addEventListener('click', () => {
      filterState.veganType = c.dataset.vegan || null;
      wrap.querySelectorAll<HTMLButtonElement>('.filter-chip[data-vegan]').forEach((x) => {
        x.classList.toggle('selected', x === c);
      });
      selectedId = null;
      renderCard(null);
      renderMarkers();
    });
  });
  // 活動標籤 chips — multi-select toggle, default all on.
  wrap.querySelectorAll<HTMLButtonElement>('.filter-chip[data-activity]').forEach((c) => {
    c.addEventListener('click', () => {
      const tag = c.dataset.activity!;
      if (filterState.activityTags.has(tag)) {
        filterState.activityTags.delete(tag);
        c.classList.remove('selected');
      } else {
        filterState.activityTags.add(tag);
        c.classList.add('selected');
      }
      selectedId = null;
      renderCard(null);
      renderMarkers();
    });
  });

  wrap.querySelector('#map-vegan-info-btn')?.addEventListener('click', () => openVeganTierInfo(wrap));

  // Force Leaflet to re-measure once the layout settles. Otherwise tiles
  // only fill the box the canvas had at L.map() time — typically 0px because
  // the route mounts before the parent flex chain has computed sizes. Guard
  // against navigating away mid-frame, which would call invalidateSize on a
  // disposed map and throw inside Leaflet's pan calculation.
  let alive = true;
  const safeInvalidate = () => {
    if (alive) leafletMap.invalidateSize();
  };
  const rafId = requestAnimationFrame(safeInvalidate);

  // First-visit prompt: surface the name overlay once on map entry so
  // returning users land on the map already-named.
  void requireRealName(wrap);

  void (async () => {
    try {
      allRestaurants = await listRestaurants();
      if (!alive) return;
      safeInvalidate();
      renderMarkers();
    } catch (err) {
      if (!alive) return;
      countEl.textContent = '載入失敗';
      console.error('[map] listRestaurants failed:', err);
    }
  })();

  // Reviews load in parallel with restaurants — once they land we have
  // the consensus map ready for any subsequent card render. Soft fail
  // leaves consensusTiers empty (cards just don't show the chip row).
  // Re-render markers once consensus arrives so the 素別 filter can
  // honour crowd-sourced tiers (not just admin-declared ones).
  void (async () => {
    try {
      const reviews = await listAllReviews();
      if (!alive) return;
      consensusTiers = aggregateConsensusTiers(reviews, 3);
      if (allRestaurants.length > 0) renderMarkers();
    } catch (err) {
      console.warn('[map] listAllReviews failed:', err);
    }
  })();

  onUnmount(wrap, () => {
    alive = false;
    cancelAnimationFrame(rafId);
    leafletMap.remove();
  });

  return wrap;
}

/**
 * Build a Leaflet DivIcon shaped like a classic teardrop pin, painted
 * with the restaurant's tier colour. Selected pins get a slight scale
 * bump so the user can tell at a glance which one their card is for.
 */
function buildPinIcon(color: string, selected: boolean): L.DivIcon {
  const scale = selected ? 1.15 : 1;
  // We use inline styles for the colour (per-marker) so the same .map-pin
  // CSS rule can stay generic. The inner dot is a thin white circle that
  // reads as the pin's "hole" — a common map convention.
  return L.divIcon({
    className: 'map-pin' + (selected ? ' is-selected' : ''),
    html: `
      <div class="map-pin-shape" style="background:${color};transform:rotate(-45deg) scale(${scale});">
        <div class="map-pin-dot-inner"></div>
      </div>
    `,
    iconSize: [28, 36],
    iconAnchor: [14, 36],
    tooltipAnchor: [0, -32],
  });
}

/** Render the consensus-tier banners for the map card. Each tier renders
 *  as a tall vertical pennant hung from the top edge — like a Harry Potter
 *  house banner on a castle wall. Returns empty string when nothing has
 *  hit the ≥3 review threshold yet. */
function renderConsensusTiers(tiers: string[]): string {
  if (tiers.length === 0) return '';
  return `
    <div class="map-card-tiers" aria-label="社群認證素別">
      ${tiers
        .map((t) => `<span class="map-card-tier-banner" data-tier="${escapeHtml(t)}">${escapeHtml(t)}</span>`)
        .join('')}
    </div>
  `;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;',
  );
}

