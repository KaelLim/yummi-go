import { describe, it, expect, beforeEach } from 'vitest';
import { KEYS } from '@/lib/storage';
import {
  $ui,
  setTheme,
  setTimeMode,
  setManualDay,
  setCurrentTab,
} from '../ui';

describe('ui store', () => {
  beforeEach(() => {
    // Reset to defaults snapshot — atom is module-singleton so we rewrite it.
    $ui.set({
      theme: 'light',
      devMode: false,
      timeMode: 'real',
      manualDay: 1,
      fontScale: 'default',
      challengeStartedAt: 0,
      currentTab: 'home',
    });
  });

  it('setTheme persists and updates atom', () => {
    setTheme('dark');
    expect($ui.get().theme).toBe('dark');
    expect(localStorage.getItem(KEYS.THEME)).toBe('"dark"');
  });

  it('setTimeMode persists and updates atom', () => {
    setTimeMode('compressed');
    expect($ui.get().timeMode).toBe('compressed');
    expect(localStorage.getItem(KEYS.TIME_MODE)).toBe('"compressed"');
  });

  it('setManualDay persists and updates atom', () => {
    setManualDay(7);
    expect($ui.get().manualDay).toBe(7);
    expect(localStorage.getItem(KEYS.MANUAL_DAY)).toBe('7');
  });

  it('setCurrentTab updates atom only (not persisted)', () => {
    setCurrentTab('map');
    expect($ui.get().currentTab).toBe('map');
  });
});
