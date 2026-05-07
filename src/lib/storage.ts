/**
 * Typed localStorage wrapper. Falls back gracefully on parse errors or quota exceptions.
 */
export const storage = {
  get<T>(key: string, fallback: T): T {
    try {
      const v = localStorage.getItem(key);
      return v ? (JSON.parse(v) as T) : fallback;
    } catch {
      return fallback;
    }
  },
  set<T>(key: string, value: T): void {
    localStorage.setItem(key, JSON.stringify(value));
  },
  remove(key: string): void {
    localStorage.removeItem(key);
  },
};

export const KEYS = {
  USER_ID: 'yummi.userId',
  THEME: 'yummi.theme',
  TIME_MODE: 'yummi.timeMode',
  MANUAL_DAY: 'yummi.manualDay',
  CHALLENGE_STARTED_AT: 'yummi.challengeStartedAt',
} as const;
