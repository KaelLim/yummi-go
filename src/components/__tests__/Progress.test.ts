import { describe, it, expect } from 'vitest';
import { createProgress } from '../Progress';

describe('createProgress', () => {
  it('returns an element with N dots', () => {
    const el = createProgress(2, 6);
    expect(el.classList.contains('onb-progress')).toBe(true);
    expect(el.querySelectorAll('.onb-progress-dot').length).toBe(6);
  });

  it('marks the first M dots with .done', () => {
    const el = createProgress(3, 5);
    const done = el.querySelectorAll('.onb-progress-dot.done');
    expect(done.length).toBe(3);
  });

  it('handles current=0 (no dots done)', () => {
    const el = createProgress(0, 4);
    expect(el.querySelectorAll('.onb-progress-dot.done').length).toBe(0);
    expect(el.querySelectorAll('.onb-progress-dot').length).toBe(4);
  });

  it('handles current=total (all dots done)', () => {
    const el = createProgress(6, 6);
    expect(el.querySelectorAll('.onb-progress-dot.done').length).toBe(6);
  });
});
