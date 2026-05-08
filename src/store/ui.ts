/**
 * UI global store (theme, dev mode flag, time mode, manual day, current tab).
 *
 * Theme / time mode / manual day persist to localStorage; setters update both
 * the atom and storage. devMode is enabled by `?dev` in the URL.
 */
import { atom } from 'nanostores';
import { storage, KEYS } from '@/lib/storage';

export type Theme = 'light' | 'dark';
export type TimeMode = 'real' | 'compressed' | 'manual';

export interface UiStoreShape {
  theme: Theme;
  devMode: boolean;
  timeMode: TimeMode;
  manualDay: number;
  challengeStartedAt: number;
  currentTab: 'home' | 'map' | 'check-in' | 'tasks' | 'profile';
}

// Dev mode is on whenever the bundle is built in Vite's `dev` mode (i.e.
// `npm run dev`), or when ?dev is appended to the URL on a production build.
// This keeps the dev panel a free affordance while iterating, while still
// hiding it from the deployed bundle by default.
const devFromUrl = new URLSearchParams(globalThis.location?.search ?? '').has('dev');
const devFromEnv = Boolean(import.meta.env?.DEV);

const defaults: UiStoreShape = {
  theme: storage.get<Theme>(KEYS.THEME, 'light'),
  devMode: devFromUrl || devFromEnv,
  timeMode: storage.get<TimeMode>(KEYS.TIME_MODE, 'real'),
  manualDay: storage.get<number>(KEYS.MANUAL_DAY, 1),
  challengeStartedAt: storage.get<number>(KEYS.CHALLENGE_STARTED_AT, Date.now()),
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
