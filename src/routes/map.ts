/**
 * Map route — Leaflet + OSM tiles, three-color pin markers, filter chips.
 *
 * Filters:
 *   - 餐廳類別 chip group (全部 / 中式 / 西式 / 咖啡 — derived from place_type)
 *   - 合作 toggle (is_partner = 1) — single switch button
 *
 * Click a marker to surface a bottom card with name/address/place-type +
 * 進詳情 CTA. The selected pin is highlighted via CSS class swap.
 *
 * Map cleanup uses lifecycle.onUnmount so leaving the route disposes the
 * Leaflet instance (otherwise it would leak listeners and a dangling DOM
 * subtree of tiles).
 */
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { navigate } from '@/router';
import { listRestaurants, type Restaurant } from '@/api/content';
import { onUnmount } from '@/lib/lifecycle';

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
  blue: '#3b8eff',
};

interface FilterState {
  placeType: string | null; // null = all
  partnerOnly: boolean;
}

export default function map(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'map-screen';
  wrap.innerHTML = `
    <header class="map-header">
      <h1 class="map-title">蔬食地圖</h1>
      <span class="map-meta" id="result-count">載入中…</span>
    </header>
    <div class="map-filters" id="filters">
      <button class="filter-chip selected" data-place="">全部</button>
      <button class="filter-chip" data-place="chinese">中式</button>
      <button class="filter-chip" data-place="western">西式</button>
      <button class="filter-chip" data-place="cafe">咖啡</button>
      <button class="filter-chip filter-partner" id="partner-toggle">
        <span class="ms">handshake</span>合作店家
      </button>
    </div>
    <div class="map-canvas" id="canvas"></div>
    <div class="map-card" id="card" hidden></div>
  `;

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

  const filterState: FilterState = { placeType: null, partnerOnly: false };
  let allRestaurants: Restaurant[] = [];
  let currentMarkers: L.CircleMarker[] = [];
  let selectedId: number | null = null;

  function renderCard(r: Restaurant | null) {
    if (!r) {
      card.hidden = true;
      card.innerHTML = '';
      return;
    }
    card.hidden = false;
    card.innerHTML = `
      <div class="map-card-body">
        <div class="map-card-meta">
          <span class="map-pin-dot" style="background:${PIN_COLOR[r.pin_color]}"></span>
          <span class="map-card-type">${PLACE_LABEL[r.place_type] ?? r.place_type}</span>
          ${r.is_partner ? '<span class="map-partner-tag">合作</span>' : ''}
        </div>
        <div class="map-card-name">${escapeHtml(r.name)}</div>
        <div class="map-card-addr">${escapeHtml(r.address)}</div>
        ${r.partner_discount ? `<div class="map-card-disc">優惠：${escapeHtml(r.partner_discount)}</div>` : ''}
      </div>
      <button class="btn text-btn-m btn-primary btn-sm text-mini" id="card-detail">進詳情</button>
    `;
    card.querySelector('#card-detail')?.addEventListener('click', () => {
      navigate(`/map/restaurant/${r.id}`);
    });
  }

  function renderMarkers() {
    for (const m of currentMarkers) m.remove();
    currentMarkers = [];
    const filtered = allRestaurants.filter((r) => {
      if (filterState.placeType && r.place_type !== filterState.placeType) return false;
      if (filterState.partnerOnly && !r.is_partner) return false;
      return true;
    });
    countEl.textContent = `${filtered.length} 家店`;

    for (const r of filtered) {
      const isSelected = selectedId === r.id;
      const marker = L.circleMarker([r.lat, r.lng], {
        radius: isSelected ? 12 : 10,
        color: '#fff',
        weight: 2,
        fillColor: PIN_COLOR[r.pin_color],
        fillOpacity: 0.95,
      });
      marker.addTo(leafletMap);
      marker.bindTooltip(r.name, { direction: 'top', offset: [0, -8] });
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

  // Filter chips (place type — exclusive radio)
  wrap.querySelectorAll<HTMLButtonElement>('.filter-chip:not(.filter-partner)').forEach((c) => {
    c.addEventListener('click', () => {
      filterState.placeType = c.dataset.place || null;
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

  onUnmount(wrap, () => {
    alive = false;
    cancelAnimationFrame(rafId);
    leafletMap.remove();
  });

  return wrap;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;',
  );
}
