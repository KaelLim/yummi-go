/**
 * Transient check-in flow state (capture → scanning → result → success).
 *
 * The four /check-in/* routes are stateless on their own — they read and
 * mutate $checkin so the user can navigate forward without losing the
 * captured image or scanned ingredients. Reset on success or on an explicit
 * abort. NOT persisted to localStorage; an in-flight check-in is dropped on
 * page reload, which matches user intent for a 30-second flow.
 */
import { atom } from 'nanostores';
import type { ScanResult, MockFood } from '@/lib/mock-ai';

export interface CheckinDraft {
  imageDataUrl: string | null;
  scan: ScanResult | null;
  /** Editable working copy of `scan.items` — user may add/remove/edit. */
  items: MockFood[];
  veganType: '全素' | '蛋奶素' | '五辛素' | '鍋邊素' | null;
  wasMeatReplaced: boolean;
  mealIndex: 1 | 2 | 3;
  /** Populated after createCheckIn returns; read by /check-in/success. */
  lastResult: {
    xpEarned: number;
    luckyColorMatched: boolean;
    fogReductionPct: number;
  } | null;
}

const empty = (): CheckinDraft => ({
  imageDataUrl: null,
  scan: null,
  items: [],
  veganType: null,
  wasMeatReplaced: false,
  mealIndex: 1,
  lastResult: null,
});

export const $checkin = atom<CheckinDraft>(empty());

export function resetCheckin() {
  $checkin.set(empty());
}

export function setCapture(imageDataUrl: string | null) {
  $checkin.set({ ...$checkin.get(), imageDataUrl });
}

export function setScan(scan: ScanResult) {
  $checkin.set({ ...$checkin.get(), scan, items: [...scan.items] });
}

export function setItems(items: MockFood[]) {
  $checkin.set({ ...$checkin.get(), items });
}

export function setVeganType(type: CheckinDraft['veganType']) {
  $checkin.set({ ...$checkin.get(), veganType: type });
}

export function setMeatReplaced(flag: boolean) {
  $checkin.set({ ...$checkin.get(), wasMeatReplaced: flag });
}

export function setMealIndex(idx: 1 | 2 | 3) {
  $checkin.set({ ...$checkin.get(), mealIndex: idx });
}

export function setLastResult(r: CheckinDraft['lastResult']) {
  $checkin.set({ ...$checkin.get(), lastResult: r });
}

/** Pick the meal index from clock time (rough split: <11:00 早, 11-17 午, ≥17 晚). */
export function inferMealIndex(now: Date = new Date()): 1 | 2 | 3 {
  const h = now.getHours();
  if (h < 11) return 1;
  if (h < 17) return 2;
  return 3;
}
