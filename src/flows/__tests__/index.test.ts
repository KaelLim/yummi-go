import { describe, it, expect } from 'vitest';
import { flows, getFlow } from '../index';

describe('flows registry', () => {
  it('flows is an array (may be empty before any flow ships)', () => {
    expect(Array.isArray(flows)).toBe(true);
  });

  it('flows are sorted by order, falling back to id', () => {
    // Adjacent pairs must be in non-decreasing (order, id) order.
    for (let i = 1; i < flows.length; i++) {
      const a = flows[i - 1];
      const b = flows[i];
      const oa = a.order ?? 100;
      const ob = b.order ?? 100;
      if (oa !== ob) {
        expect(oa, `${a.id} should come before ${b.id}`).toBeLessThan(ob);
      } else {
        expect(a.id.localeCompare(b.id)).toBeLessThanOrEqual(0);
      }
    }
  });

  it('getFlow returns undefined for unknown id', () => {
    expect(getFlow('does-not-exist')).toBeUndefined();
  });
});
