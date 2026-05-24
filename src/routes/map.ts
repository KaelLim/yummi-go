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
import { listRestaurants, parseVeganTypes, type Restaurant } from '@/api/content';
import { listAllReviews, aggregateConsensusTiers } from '@/api/reviews';
import { onUnmount } from '@/lib/lifecycle';
import { $user, $profile } from '@/store/user';
import { updateDisplayName, getUserFull } from '@/api/profile';

/**
 * Auto-generated guest display names follow the `訪客 xxxx` shape from
 * registerGuest(). If the user still has that placeholder, the map is
 * the first social-ish surface where the name actually matters — prompt
 * once on entry so they can pick something real.
 */
const GUEST_NAME_PREFIX = '訪客 ';

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
  partnerOnly: boolean;
  query: string; // free-text search over restaurant names
}

export default function map(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'map-screen';
  wrap.innerHTML = `
    <header class="map-header">
      <h1 class="map-title">蔬食地圖</h1>
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
      <button class="filter-chip filter-partner" id="partner-toggle">
        <span class="ms">handshake</span>合作店家
      </button>
    </div>
    <div class="map-canvas" id="canvas"></div>
    <div class="map-card" id="card" hidden></div>
    <div class="name-prompt" id="name-prompt" hidden role="dialog" aria-modal="true" aria-labelledby="name-prompt-title">
      <div class="name-prompt-card">
        <h2 class="name-prompt-title text-h3" id="name-prompt-title">嗨，先取個名字吧</h2>
        <p class="name-prompt-sub text-mini">讓小綠在地圖上認得你</p>
        <input type="text" class="input" id="name-prompt-input" maxlength="20" autocomplete="off" />
        <p class="name-prompt-error" id="name-prompt-error" hidden></p>
        <div class="name-prompt-actions">
          <button type="button" class="btn text-btn-m btn-secondary btn-l text-btn-l" id="name-prompt-skip">先跳過</button>
          <button type="button" class="btn text-btn-m btn-primary btn-l text-btn-l" id="name-prompt-save">儲存</button>
        </div>
      </div>
    </div>
  `;

  void maybeShowNamePrompt(wrap);

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

  const filterState: FilterState = { veganType: null, partnerOnly: false, query: '' };
  let allRestaurants: Restaurant[] = [];
  let currentMarkers: L.Marker[] = [];
  let selectedId: number | null = null;
  // Per-restaurant consensus tiers (vegan_type picked by ≥3 reviewers).
  // Empty until the reviews fetch resolves; renderCard reads from this
  // map directly so cards opened before the fetch lands simply show no
  // tags, then the next card render after the fetch shows them.
  let consensusTiers: Map<number, string[]> = new Map();

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
        <a class="map-card-addr map-card-addr-link" href="${googleMapsUrl(r)}" target="_blank" rel="noopener noreferrer">
          <span class="ms">place</span>${escapeHtml(r.address)}
        </a>
        ${r.partner_discount ? `<div class="map-card-disc">優惠：${escapeHtml(r.partner_discount)}</div>` : ''}
      </div>
      ${renderConsensusTiers(consensusTiers.get(r.id) ?? [])}
      <button class="btn text-btn-m btn-primary btn-sm text-mini" id="card-detail">${ctaLabel}</button>
    `;
    card.querySelector('#card-detail')?.addEventListener('click', () => {
      if (isGray) {
        // Verification is its own full-page form at /…/verify so it
        // mirrors the /…/review layout — feels like one consistent path
        // instead of a slide-up sheet plus a routed form.
        navigate(`/map/restaurant/${r.id}/verify`);
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
      if (filterState.veganType && !parseVeganTypes(r).includes(filterState.veganType)) return false;
      if (filterState.partnerOnly && !r.is_partner) return false;
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

  // Filter chips (vegan type — exclusive radio)
  wrap.querySelectorAll<HTMLButtonElement>('.filter-chip:not(.filter-partner)').forEach((c) => {
    c.addEventListener('click', () => {
      filterState.veganType = c.dataset.vegan || null;
      wrap.querySelectorAll<HTMLButtonElement>('.filter-chip:not(.filter-partner)').forEach((x) => {
        x.classList.toggle('selected', x === c);
      });
      selectedId = null;
      renderCard(null);
      renderMarkers();
    });
  });
  wrap.querySelector('#partner-toggle')?.addEventListener('click', (e) => {
    filterState.partnerOnly = !filterState.partnerOnly;
    (e.currentTarget as HTMLElement).classList.toggle('selected', filterState.partnerOnly);
    selectedId = null;
    renderCard(null);
    renderMarkers();
  });

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
  void (async () => {
    try {
      const reviews = await listAllReviews();
      if (!alive) return;
      consensusTiers = aggregateConsensusTiers(reviews, 3);
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

/** Build a Google Maps deep link for the restaurant. Coords beat address
 *  because they survive bad geocoding on admin-typed addresses. */
function googleMapsUrl(r: Restaurant): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${r.lat},${r.lng}`)}`;
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

async function maybeShowNamePrompt(wrap: HTMLElement): Promise<void> {
  const u = $user.get();
  if (!u) return;
  if (!u.displayName.startsWith(GUEST_NAME_PREFIX)) return;

  const prompt = wrap.querySelector<HTMLElement>('#name-prompt');
  const input = wrap.querySelector<HTMLInputElement>('#name-prompt-input');
  const errorEl = wrap.querySelector<HTMLElement>('#name-prompt-error');
  const skipBtn = wrap.querySelector<HTMLButtonElement>('#name-prompt-skip');
  const saveBtn = wrap.querySelector<HTMLButtonElement>('#name-prompt-save');
  if (!prompt || !input || !errorEl || !skipBtn || !saveBtn) return;

  prompt.hidden = false;
  input.value = '';
  input.focus();

  function close(): void {
    if (prompt) prompt.hidden = true;
  }

  function showError(msg: string): void {
    if (!errorEl) return;
    errorEl.hidden = false;
    errorEl.textContent = msg;
  }

  skipBtn.addEventListener('click', close);

  saveBtn.addEventListener('click', async () => {
    const name = input.value.trim();
    if (!name) {
      showError('幫自己取個名字吧');
      return;
    }
    if (name.startsWith(GUEST_NAME_PREFIX)) {
      showError('換一個吧，這個是預設訪客名');
      return;
    }
    saveBtn.disabled = true;
    saveBtn.textContent = '儲存中…';
    try {
      await updateDisplayName(u.id, name);
      $user.set({ ...u, displayName: name });
      // Refresh $profile in the background so other screens see the
      // new name on their next render. Soft fail is fine — the local
      // store update is enough for the user's current session.
      void getUserFull(u.id).then((full) => { if (full) $profile.set(full); });
      close();
    } catch (err) {
      console.error('[map] updateDisplayName failed:', err);
      showError('儲存失敗，請稍後再試');
      saveBtn.disabled = false;
      saveBtn.textContent = '儲存';
    }
  });
}
