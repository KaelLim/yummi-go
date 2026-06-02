import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/router', () => ({ navigate: vi.fn() }));

vi.mock('@/api/content', () => ({
  listRestaurants: vi.fn(),
  parseVeganTypes: (r: { vegan_type?: string | null }) =>
    r.vegan_type ? r.vegan_type.split(',').map((s) => s.trim()).filter(Boolean) : [],
  parseActivityTags: (r: { is_partner?: number; activity_tags?: string | null }) => {
    const out: string[] = [];
    if (r.is_partner === 1) out.push('partner');
    if (r.activity_tags) for (const t of r.activity_tags.split(',').map((s) => s.trim()).filter(Boolean)) out.push(t);
    if (out.length === 0) out.push('other');
    return out;
  },
  ACTIVITY_TAG_PARTNER: 'partner',
  ACTIVITY_TAG_600: '600plates',
  ACTIVITY_TAG_OTHER: 'other',
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
      marker: vi.fn(() => ({
        addTo: vi.fn().mockReturnThis(),
        bindTooltip: vi.fn().mockReturnThis(),
        on: vi.fn().mockReturnThis(),
        remove: vi.fn(),
      })),
      divIcon: vi.fn(() => ({})),
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
    expect(el.querySelector('.map-title')?.textContent?.trim().startsWith('蔬食地圖')).toBe(true);
    // 全部 + 全素 + 蛋奶素 + 五辛素 + 方便蔬食 = 5 vegan-tier chips.
    expect(el.querySelectorAll('.filter-chip[data-vegan]').length).toBe(5);
    // 合作店家 / 蔬食 600 盤 / 其他 = 3 activity-tag chips.
    expect(el.querySelectorAll('.filter-chip[data-activity]').length).toBe(3);
    expect(el.querySelector('.map-canvas')).not.toBeNull();
  });

  it('updates result count to "N 家店" after data loads', async () => {
    const el = map();
    await vi.waitFor(() => {
      expect(el.querySelector('#result-count')?.textContent).toBe('2 家店');
    });
  });

  it('activity-tag chips default to all selected and toggle independently', () => {
    const el = map();
    const partner = el.querySelector<HTMLButtonElement>('.filter-chip[data-activity="partner"]')!;
    const other = el.querySelector<HTMLButtonElement>('.filter-chip[data-activity="other"]')!;
    expect(partner.classList.contains('selected')).toBe(true);
    expect(other.classList.contains('selected')).toBe(true);
    partner.click();
    expect(partner.classList.contains('selected')).toBe(false);
    expect(other.classList.contains('selected')).toBe(true);
    partner.click();
    expect(partner.classList.contains('selected')).toBe(true);
  });

  it('vegan-tier chip flip activates the clicked one and deactivates others', () => {
    const el = map();
    const tier = el.querySelector<HTMLButtonElement>('.filter-chip[data-vegan="全素"]')!;
    const all = el.querySelector<HTMLButtonElement>('.filter-chip[data-vegan=""]')!;
    tier.click();
    expect(tier.classList.contains('selected')).toBe(true);
    expect(all.classList.contains('selected')).toBe(false);
  });

  describe('Google bind prompt (was name prompt)', () => {
    // The Google-bind prompt no longer auto-fires on map mount. It only
    // appears on the review CTA — see restaurant-detail.ts. These tests
    // assert that map mount stays prompt-free regardless of guest state.
    it('does not mount the prompt when display name is already customised', async () => {
      $user.set({ id: 1, username: 'kael', displayName: 'Kael' });
      const el = map();
      await vi.waitFor(() => {
        expect(el.querySelector('.name-prompt')).toBeNull();
      });
    });

    it('does not mount the prompt even when the user is still a guest', async () => {
      $user.set({ id: 1, username: 'guest_a', displayName: '訪客 ab12' });
      const el = map();
      document.body.appendChild(el);
      // Wait one tick — the prompt is no longer triggered, so the
      // assertion should hold after any microtasks settle.
      await new Promise((r) => setTimeout(r, 0));
      expect(el.querySelector('.name-prompt')).toBeNull();
      el.remove();
    });

    it('does not call updateDisplayName from the map mount path', async () => {
      $user.set({ id: 7, username: 'guest_a', displayName: '訪客 ab12' });
      const el = map();
      document.body.appendChild(el);
      await new Promise((r) => setTimeout(r, 0));
      expect(mockedProfile.updateDisplayName).not.toHaveBeenCalled();
      el.remove();
    });

    it('skip button is irrelevant — no overlay mounts to skip', async () => {
      $user.set({ id: 7, username: 'guest_a', displayName: '訪客 ab12' });
      const el = map();
      document.body.appendChild(el);
      await new Promise((r) => setTimeout(r, 0));
      expect(el.querySelector<HTMLButtonElement>('#name-prompt-skip')).toBeNull();
      expect(mockedProfile.updateDisplayName).not.toHaveBeenCalled();
      expect(el.querySelector('.name-prompt')).toBeNull();
      el.remove();
    });
  });
});
