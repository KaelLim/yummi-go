import { describe, it, expect, beforeEach } from 'vitest';
import { storage, KEYS } from '../storage';

describe('storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('get returns fallback when key missing', () => {
    expect(storage.get('nope', 'default')).toBe('default');
    expect(storage.get('nope2', 42)).toBe(42);
    expect(storage.get('nope3', { a: 1 })).toEqual({ a: 1 });
  });

  it('set/get round-trip for primitives', () => {
    storage.set('k', 'hello');
    expect(storage.get('k', 'fallback')).toBe('hello');
  });

  it('set/get round-trip for objects', () => {
    storage.set('o', { a: 1, b: [2, 3] });
    expect(storage.get<{ a: number; b: number[] }>('o', { a: 0, b: [] })).toEqual({ a: 1, b: [2, 3] });
  });

  it('returns fallback when value is malformed JSON', () => {
    localStorage.setItem('bad', '{not-json');
    expect(storage.get('bad', 'fb')).toBe('fb');
  });

  it('remove clears the key', () => {
    storage.set('k', 'v');
    storage.remove('k');
    expect(storage.get('k', null)).toBe(null);
  });

  it('exposes namespaced KEYS for device-scoped state only', () => {
    expect(KEYS.USER_ID).toBe('yummi.userId');
    expect(KEYS.THEME).toBe('yummi.theme');
    expect(KEYS.TIME_MODE).toBe('yummi.timeMode');
    expect(KEYS.MANUAL_DAY).toBe('yummi.manualDay');
    // CHALLENGE_STARTED_AT moved to drust users.challenge_started_at
    expect((KEYS as Record<string, string>).CHALLENGE_STARTED_AT).toBeUndefined();
  });
});
