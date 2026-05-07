import { describe, it, expect } from 'vitest';
import { mockScan, FOOD_BANK } from '../mock-ai';

describe('FOOD_BANK', () => {
  it('contains 30 items', () => {
    expect(FOOD_BANK.length).toBe(30);
  });
  it('every item has well-formed nutrition + colors', () => {
    for (const f of FOOD_BANK) {
      expect(typeof f.name).toBe('string');
      expect(f.name.length).toBeGreaterThan(0);
      expect(f.cal).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(f.colors)).toBe(true);
      expect(f.colors.length).toBeGreaterThan(0);
      expect(typeof f.isVeg).toBe('boolean');
      expect(f.weightG).toBeGreaterThan(0);
    }
  });
  it('contains both veg and non-veg items', () => {
    expect(FOOD_BANK.filter((f) => f.isVeg).length).toBeGreaterThan(0);
    expect(FOOD_BANK.filter((f) => !f.isVeg).length).toBeGreaterThan(0);
  });
});

describe('mockScan', () => {
  it('returns 3..6 items normally', () => {
    let counts = new Set<number>();
    // sample many runs with seeded rng to cover the range
    for (let seed = 0; seed < 80; seed++) {
      const result = mockScan({ failRate: 0, rng: seededRng(seed) });
      expect(result.scanFailed).toBe(false);
      expect(result.items.length).toBeGreaterThanOrEqual(3);
      expect(result.items.length).toBeLessThanOrEqual(6);
      counts.add(result.items.length);
    }
    expect(counts.size).toBeGreaterThan(1);
  });

  it('reports scanFailed only when rng forces failure', () => {
    const failed = mockScan({ rng: () => 0, failRate: 0.05 });
    expect(failed.scanFailed).toBe(true);
    expect(failed.items.length).toBe(0);
    expect(failed.hasMeat).toBe(false);
  });

  it('does not fail when failRate is zero', () => {
    const result = mockScan({ failRate: 0, rng: () => 0 });
    expect(result.scanFailed).toBe(false);
  });

  it('hasMeat is consistent with items', () => {
    for (let seed = 0; seed < 30; seed++) {
      const r = mockScan({ failRate: 0, rng: seededRng(seed) });
      expect(r.hasMeat).toBe(r.items.some((i) => !i.isVeg));
    }
  });

  it('is deterministic for same seeded rng', () => {
    const r1 = mockScan({ failRate: 0, rng: seededRng(42) });
    const r2 = mockScan({ failRate: 0, rng: seededRng(42) });
    expect(r1.items.map((i) => i.name)).toEqual(r2.items.map((i) => i.name));
  });

  it('respects meatRate=0 — never includes meat', () => {
    for (let seed = 0; seed < 30; seed++) {
      const r = mockScan({ failRate: 0, meatRate: 0, rng: seededRng(seed) });
      expect(r.hasMeat).toBe(false);
    }
  });
});

// Mulberry32 deterministic PRNG for seeded scenarios
function seededRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
