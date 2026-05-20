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

vi.mock('@/api/profile', () => ({
  updateDisplayName: vi.fn().mockResolvedValue(undefined),
  getUserFull: vi.fn().mockResolvedValue(null),
}));

import map from '../map';
import * as content from '@/api/content';
import * as profileApi from '@/api/profile';
import { $user } from '@/store/user';

const mockedContent = content as unknown as {
  listRestaurants: ReturnType<typeof vi.fn>;
};
const mockedProfile = profileApi as unknown as {
  updateDisplayName: ReturnType<typeof vi.fn>;
  getUserFull: ReturnType<typeof vi.fn>;
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
    $user.set(null);
  });

  it('renders header, filter chips, and a map canvas', () => {
    const el = map();
    expect(el.classList.contains('map-screen')).toBe(true);
    expect(el.querySelector('.map-title')?.textContent).toBe('蔬食地圖');
    // 全部 + 全素 + 蛋奶素 + 五辛素 + 鍋邊素 = 5 vegan-tier chips
    // (plus the partner toggle, excluded by selector).
    expect(el.querySelectorAll('.filter-chip:not(.filter-partner)').length).toBe(5);
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

  it('vegan-tier chip flip activates the clicked one and deactivates others', () => {
    const el = map();
    const tier = el.querySelector<HTMLButtonElement>('.filter-chip[data-vegan="全素"]')!;
    const all = el.querySelector<HTMLButtonElement>('.filter-chip[data-vegan=""]')!;
    tier.click();
    expect(tier.classList.contains('selected')).toBe(true);
    expect(all.classList.contains('selected')).toBe(false);
  });

  describe('first-visit name prompt', () => {
    it('stays hidden when display name is already customised', () => {
      $user.set({ id: 1, username: 'kael', displayName: 'Kael' });
      const el = map();
      expect(el.querySelector<HTMLElement>('#name-prompt')?.hidden).toBe(true);
    });

    it('shows the prompt when display name still has the 訪客 prefix', () => {
      $user.set({ id: 1, username: 'guest_a', displayName: '訪客 ab12' });
      const el = map();
      expect(el.querySelector<HTMLElement>('#name-prompt')?.hidden).toBe(false);
    });

    it('saves the new name via updateDisplayName and closes the prompt', async () => {
      $user.set({ id: 7, username: 'guest_a', displayName: '訪客 ab12' });
      const el = map();
      const input = el.querySelector<HTMLInputElement>('#name-prompt-input')!;
      input.value = '阿綠';
      el.querySelector<HTMLButtonElement>('#name-prompt-save')?.click();
      await vi.waitFor(() => {
        expect(mockedProfile.updateDisplayName).toHaveBeenCalledWith(7, '阿綠');
      });
      expect($user.get()?.displayName).toBe('阿綠');
      expect(el.querySelector<HTMLElement>('#name-prompt')?.hidden).toBe(true);
    });

    it('skip button dismisses without writing', () => {
      $user.set({ id: 7, username: 'guest_a', displayName: '訪客 ab12' });
      const el = map();
      el.querySelector<HTMLButtonElement>('#name-prompt-skip')?.click();
      expect(mockedProfile.updateDisplayName).not.toHaveBeenCalled();
      expect(el.querySelector<HTMLElement>('#name-prompt')?.hidden).toBe(true);
    });
  });
});
