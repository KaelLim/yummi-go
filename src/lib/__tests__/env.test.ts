import { describe, it, expect } from 'vitest';
import { ENV } from '../env';

describe('ENV', () => {
  it('exposes the two drust keys', () => {
    expect(ENV).toBeTypeOf('object');
    expect('DRUST_BASE' in ENV).toBe(true);
    expect('DRUST_ANON_TOKEN' in ENV).toBe(true);
  });
});
