import { describe, it, expect } from 'vitest';
import { parseEatTimes, computeMatchKey } from '../meal-notifier';

describe('meal-notifier helpers', () => {
  describe('parseEatTimes', () => {
    it('parses a JSON string of meal-time map', () => {
      const out = parseEatTimes('{"breakfast":"08:00","lunch":"12:30","dinner":"19:00"}');
      expect(out).toEqual({ breakfast: '08:00', lunch: '12:30', dinner: '19:00' });
    });

    it('returns null for null/empty/malformed input', () => {
      expect(parseEatTimes(null)).toBeNull();
      expect(parseEatTimes('')).toBeNull();
      expect(parseEatTimes('not-json')).toBeNull();
    });
  });

  describe('computeMatchKey', () => {
    it('returns the slot when within ±5 min of (mealtime - 10 min)', () => {
      // meal at 12:30, target = 12:20, now = 12:18 → 2 min before target → match
      const now = new Date('2026-05-08T12:18:00+08:00');
      expect(computeMatchKey({ lunch: '12:30' }, now)).toBe('lunch');
    });

    it('returns null when no slot is within ±5 min', () => {
      const now = new Date('2026-05-08T15:00:00+08:00');
      expect(computeMatchKey({ lunch: '12:30' }, now)).toBeNull();
    });

    it('picks lunch over breakfast when lunch is the closer match', () => {
      const now = new Date('2026-05-08T12:21:00+08:00'); // 1 min after 12:20 target
      expect(computeMatchKey({ breakfast: '08:00', lunch: '12:30' }, now)).toBe('lunch');
    });
  });
});
