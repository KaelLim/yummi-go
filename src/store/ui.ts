/**
 * UI global store (theme, dev mode flag, time mode, manual day, current tab,
 * challenge-started timestamp).
 *
 * Theme / time mode / manual day stay in localStorage — they're per-device
 * preferences. challengeStartedAt is mirrored from drust
 * (`users.challenge_started_at`) by `bootstrapChallengeStartedAt` after
 * login; localStorage no longer participates.
 *
 * devMode is enabled by `?dev` in the URL or whenever vite is in dev mode.
 */
import { atom } from 'nanostores';
import { storage, KEYS } from '@/lib/storage';
import { setChallengeStartedAt as apiSetChallengeStartedAt } from '@/api/profile';

export type Theme = 'light' | 'dark';
export type TimeMode = 'real' | 'compressed' | 'manual';

export interface UiStoreShape {
  theme: Theme;
  devMode: boolean;
  timeMode: TimeMode;
  manualDay: number;
  challengeStartedAt: number; // epoch ms, hydrated from drust on login
  currentTab: 'home' | 'map' | 'check-in' | 'tasks' | 'profile';
}

const devFromUrl = new URLSearchParams(globalThis.location?.search ?? '').has('dev');
const devFromEnv = Boolean(import.meta.env?.DEV);

const defaults: UiStoreShape = {
  theme: storage.get<Theme>(KEYS.THEME, 'light'),
  devMode: devFromUrl || devFromEnv,
  timeMode: storage.get<TimeMode>(KEYS.TIME_MODE, 'real'),
  manualDay: storage.get<number>(KEYS.MANUAL_DAY, 1),
  challengeStartedAt: Date.now(), // overwritten by bootstrapChallengeStartedAt after login
  currentTab: 'home',
};

export const $ui = atom<UiStoreShape>(defaults);

export function setTheme(theme: Theme) {
  storage.set(KEYS.THEME, theme);
  $ui.set({ ...$ui.get(), theme });
}
export function setTimeMode(mode: TimeMode) {
  storage.set(KEYS.TIME_MODE, mode);
  $ui.set({ ...$ui.get(), timeMode: mode });
}
export function setManualDay(day: number) {
  storage.set(KEYS.MANUAL_DAY, day);
  $ui.set({ ...$ui.get(), manualDay: day });
}
export function setCurrentTab(tab: UiStoreShape['currentTab']) {
  $ui.set({ ...$ui.get(), currentTab: tab });
}

/**
 * Update $ui.challengeStartedAt to now and persist to drust. Used by the
 * day-1 hook CTA — the first time the user accepts the challenge we stamp
 * `users.challenge_started_at` so the timestamp follows them across
 * devices.
 */
export async function setChallengeStartedAt(
  userId: number,
  ts: number = Date.now(),
): Promise<void> {
  $ui.set({ ...$ui.get(), challengeStartedAt: ts });
  try {
    await apiSetChallengeStartedAt(userId, new Date(ts).toISOString());
  } catch (err) {
    console.warn('[ui] setChallengeStartedAt drust write failed:', err);
  }
}

/**
 * Seed $ui.challengeStartedAt from a drust ISO string (typically pulled
 * via get_user_full at login). If null, leaves the existing value alone
 * (the user hasn't pressed the day-1 CTA yet).
 */
export function bootstrapChallengeStartedAtFromIso(iso: string | null): void {
  if (!iso) return;
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return;
  $ui.set({ ...$ui.get(), challengeStartedAt: ms });
}
