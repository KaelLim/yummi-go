import { describe, it, expect } from 'vitest';
import createSheet, { schema } from '../Sheet';
import { registry } from '../registry';

describe('Sheet', () => {
  it('schema basics', () => {
    expect(schema.name).toBe('Sheet');
    expect(schema.category).toBe('layout');
  });

  it('renders a .sheet-shell with a card aligned to the bottom', () => {
    const el = createSheet({ title: 'Edit', body: 'content' });
    expect(el.className).toContain('sheet-shell');
    expect(el.querySelector('.sheet-card')).not.toBeNull();
  });

  it('is registered', () => {
    expect(registry.Sheet).toBeDefined();
  });
});
