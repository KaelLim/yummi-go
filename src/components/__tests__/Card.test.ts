import { describe, it, expect } from 'vitest';
import createCard, { schema } from '../Card';
import { registry } from '../registry';

describe('Card', () => {
  it('schema basics', () => {
    expect(schema.name).toBe('Card');
    expect(schema.category).toBe('primitive');
  });

  it('renders a div.card-shell with default variant', () => {
    const el = createCard({ children: 'body' });
    expect(el.className).toContain('card-shell');
    expect(el.className).toContain('card-default');
    expect(el.textContent).toBe('body');
  });

  it('applies the requested variant class', () => {
    const el = createCard({ children: 'x', variant: 'raised' });
    expect(el.className).toContain('card-raised');
  });

  it('accepts an HTMLElement array as children', () => {
    const a = document.createElement('p'); a.textContent = 'a';
    const b = document.createElement('p'); b.textContent = 'b';
    const el = createCard({ children: [a, b] });
    expect(el.children.length).toBe(2);
  });

  it('is registered', () => {
    expect(registry.Card).toBeDefined();
  });
});
