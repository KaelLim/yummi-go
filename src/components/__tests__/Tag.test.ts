import { describe, it, expect } from 'vitest';
import createTag, { schema } from '../Tag';
import type { TagVariant } from '../Tag';
import { registry } from '../registry';

describe('Tag', () => {
  it('schema basics', () => {
    expect(schema.name).toBe('Tag');
    expect(schema.category).toBe('primitive');
  });

  it('renders a span with default variant class', () => {
    const el = createTag({ label: '推薦' });
    expect(el.tagName).toBe('SPAN');
    expect(el.className).toContain('tag');
    expect(el.className).toContain('tag-default');
    expect(el.textContent).toBe('推薦');
  });

  it('applies variant when given', () => {
    const el = createTag({ label: '硬核', variant: 'warning' });
    expect(el.className).toContain('tag-warning');
  });

  it('every variant renders without throwing', () => {
    for (const v of schema.variants ?? []) {
      expect(() => createTag({ label: 'x', variant: v as TagVariant })).not.toThrow();
    }
  });

  it('is registered', () => {
    expect(registry.Tag).toBeDefined();
  });
});
