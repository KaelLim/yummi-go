import { describe, it, expect } from 'vitest';
import { registry, listComponents, getSchema, byCategory } from '../registry';

describe('component registry', () => {
  it('exposes an object (may be empty before any components ship)', () => {
    expect(typeof registry).toBe('object');
    expect(registry).not.toBeNull();
  });

  it('listComponents returns a sorted array', () => {
    const list = listComponents();
    expect(Array.isArray(list)).toBe(true);
    const sorted = [...list].sort();
    expect(list).toEqual(sorted);
  });

  it('getSchema returns undefined for an unknown name', () => {
    expect(getSchema('DefinitelyNotAComponent')).toBeUndefined();
  });

  it('byCategory always returns the three buckets', () => {
    const groups = byCategory();
    expect(groups.primitive).toBeInstanceOf(Array);
    expect(groups.layout).toBeInstanceOf(Array);
    expect(groups.pattern).toBeInstanceOf(Array);
  });
});
