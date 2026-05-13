import { describe, it, expect } from 'vitest';
import createProgress, { schema, createProgress as namedCreateProgress } from '../Progress';
import { registry } from '../registry';

describe('Progress', () => {
  it('schema basics', () => {
    expect(schema.name).toBe('Progress');
    expect(schema.category).toBe('pattern');
    expect(schema.props.current.required).toBe(true);
    expect(schema.props.total.required).toBe(true);
  });

  it('default export and named export reference the same factory', () => {
    expect(createProgress).toBe(namedCreateProgress);
  });

  it('returns an element with N dots', () => {
    const el = createProgress({ current: 2, total: 6 });
    expect(el.classList.contains('onb-progress')).toBe(true);
    expect(el.querySelectorAll('.onb-progress-dot').length).toBe(6);
  });

  it('marks the first M dots with .done', () => {
    const el = createProgress({ current: 3, total: 5 });
    expect(el.querySelectorAll('.onb-progress-dot.done').length).toBe(3);
  });

  it('handles current=0 (no dots done)', () => {
    const el = createProgress({ current: 0, total: 4 });
    expect(el.querySelectorAll('.onb-progress-dot.done').length).toBe(0);
    expect(el.querySelectorAll('.onb-progress-dot').length).toBe(4);
  });

  it('handles current=total (all dots done)', () => {
    const el = createProgress({ current: 6, total: 6 });
    expect(el.querySelectorAll('.onb-progress-dot.done').length).toBe(6);
  });

  it('is registered', () => {
    expect(registry.Progress).toBeDefined();
  });
});
