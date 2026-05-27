/**
 * Google Maps deep-link builder — shared by the map card and the
 * restaurant detail page (蔬食地圖規格 v0.1 §3.2).
 *
 * Spec priority order:
 *   1. place_id  → `https://www.google.com/maps/place/?q=place_id:PLACE_ID`
 *      The store page (phone, hours, photos, reviews, navigate). This is
 *      what the spec calls "most precise".
 *   2. name+address fallback → search URL.
 *      Used when the restaurant has no `google_place_id` yet (older
 *      fixtures, freshly-seeded admin entries).
 *
 * NOTE — we intentionally do not fall back to lat/lng. Per spec, a bare
 * coordinate dumps the user on "there's a dot here" with no business
 * context, which is the failure mode this helper is meant to fix.
 */
import type { Restaurant } from '@/api/content';

export function googleMapsPlaceUrl(r: Pick<Restaurant, 'name' | 'address' | 'google_place_id'>): string {
  if (r.google_place_id) {
    return `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(r.google_place_id)}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${r.name} ${r.address}`)}`;
}
