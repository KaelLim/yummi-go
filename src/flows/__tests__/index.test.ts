import { describe, it, expect } from 'vitest';
import { flows, getFlow } from '../index';

describe('flows registry', () => {
  it('flows is a sorted array (may be empty before any flow ships)', () => {
    expect(Array.isArray(flows)).toBe(true);
    const ids = flows.map((f) => f.id);
    const sorted = [...ids].sort();
    expect(ids).toEqual(sorted);
  });

  it('getFlow returns undefined for unknown id', () => {
    expect(getFlow('does-not-exist')).toBeUndefined();
  });
});
