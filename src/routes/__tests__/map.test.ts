import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/router', () => ({ navigate: vi.fn() }));

vi.mock('@/api/content', () => ({
  listRestaurants: vi.fn(),
}));

// Stub Leaflet — we don't run the real engine in jsdom because it needs SVG
// dimensions. Each L.* primitive returns a simple object that records calls.
vi.mock('leaflet/dist/leaflet.css', () => ({}));
vi.mock('leaflet', () => {
  const map = {
    setView: vi.fn().mockReturnThis(),
    invalidateSize: vi.fn(),
    fitBounds: vi.fn(),
    remove: vi.fn(),
  };
  return {
    default: {
      map: vi.fn(() => map),
      tileLayer: vi.fn(() => ({ addTo: vi.fn() })),
      circleMarker: vi.fn(() => ({
        addTo: vi.fn().mockReturnThis(),
        bindTooltip: vi.fn().mockReturnThis(),
        on: vi.fn().mockReturnThis(),
        remove: vi.fn(),
      })),
      latLngBounds: vi.fn(() => ({})),
    },
  };
});

import map from '../map';
import * as content from '@/api/content';

const mockedContent = content as unknown as {
  listRestaurants: ReturnType<typeof vi.fn>;
};

const sampleRestaurants = [
  {
    id: 1, name: 'A', address: 'a', lat: 25.0, lng: 121.5,
    place_type: 'chinese', pin_color: 'green', is_partner: 0, partner_discount: null,
  },
  {
    id: 2, name: 'B', address: 'b', lat: 25.05, lng: 121.55,
    place_type: 'cafe', pin_color: 'gray', is_partner: 1, partner_discount: '8 折',
  },
] as Awaited<ReturnType<typeof content.listRestaurants>>;

describe('map route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedContent.listRestaurants.mockResolvedValue(sampleRestaurants);
  });

  it('renders header, filter chips, and a map canvas', () => {
    const el = map();
    expect(el.classList.contains('map-screen')).toBe(true);
    expect(el.querySelector('.map-title')?.textContent).toBe('蔬食地圖');
    expect(el.querySelectorAll('.filter-chip:not(.filter-partner)').length).toBeGreaterThanOrEqual(4);
    expect(el.querySelector('.map-canvas')).not.toBeNull();
  });

  it('updates result count to "N 家店" after data loads', async () => {
    const el = map();
    await vi.waitFor(() => {
      expect(el.querySelector('#result-count')?.textContent).toBe('2 家店');
    });
  });

  it('partner toggle flips selection state', () => {
    const el = map();
    const toggle = el.querySelector<HTMLButtonElement>('#partner-toggle')!;
    expect(toggle.classList.contains('selected')).toBe(false);
    toggle.click();
    expect(toggle.classList.contains('selected')).toBe(true);
    toggle.click();
    expect(toggle.classList.contains('selected')).toBe(false);
  });

  it('place chip flip activates the clicked one and deactivates others', () => {
    const el = map();
    const chinese = el.querySelector<HTMLButtonElement>('.filter-chip[data-place="chinese"]')!;
    const all = el.querySelector<HTMLButtonElement>('.filter-chip[data-place=""]')!;
    chinese.click();
    expect(chinese.classList.contains('selected')).toBe(true);
    expect(all.classList.contains('selected')).toBe(false);
  });
});
