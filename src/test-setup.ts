/**
 * Vitest global setup — patches Node 25's broken native localStorage.
 *
 * Node 25 ships an experimental built-in `localStorage` global that shadows
 * jsdom's working implementation. When invoked without
 * `--localstorage-file=<path>`, the methods (`setItem` / `clear` / etc.)
 * are not callable, breaking every test that touches storage. This setup
 * replaces both `globalThis.localStorage` and `window.localStorage` with a
 * clean in-memory Storage shim.
 *
 * Each test file gets a fresh map so state cannot leak across files; tests
 * inside a file are still expected to call `localStorage.clear()` in
 * `beforeEach` if they want isolation.
 */
const memory = new Map<string, string>();

const ls: Storage = {
  get length() {
    return memory.size;
  },
  clear(): void {
    memory.clear();
  },
  getItem(key: string): string | null {
    return memory.get(key) ?? null;
  },
  key(index: number): string | null {
    return Array.from(memory.keys())[index] ?? null;
  },
  removeItem(key: string): void {
    memory.delete(key);
  },
  setItem(key: string, value: string): void {
    memory.set(key, String(value));
  },
};

Object.defineProperty(globalThis, 'localStorage', {
  value: ls,
  writable: true,
  configurable: true,
});

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'localStorage', {
    value: ls,
    writable: true,
    configurable: true,
  });
}

// Pin tests to zh — the prototype's source language. Component tests
// that assert against on-screen copy were written before i18n shipped,
// so they all read in zh. Tests that care about en behaviour can
// override via $locale.set('en') in their own beforeEach.
import { $locale } from './lib/i18n';
import { beforeEach } from 'vitest';
beforeEach(() => $locale.set('zh'));
