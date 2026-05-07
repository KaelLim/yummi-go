import { describe, it, expect } from 'vitest';
import { sha256Salted } from '../hash';

describe('sha256Salted', () => {
  it('hashes consistently — same input yields same 64-char hex', async () => {
    const a = await sha256Salted('password123', 'alice');
    const b = await sha256Salted('password123', 'alice');
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('differs by salt — same password, different salt', async () => {
    const a = await sha256Salted('password123', 'alice');
    const b = await sha256Salted('password123', 'bob');
    expect(a).not.toBe(b);
  });

  it('differs by password — same salt, different password', async () => {
    const a = await sha256Salted('password123', 'alice');
    const b = await sha256Salted('password456', 'alice');
    expect(a).not.toBe(b);
  });
});
