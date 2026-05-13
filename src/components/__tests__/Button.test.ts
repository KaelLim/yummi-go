import { describe, it, expect, vi } from 'vitest';
import createButton, { schema } from '../Button';
import { registry } from '../registry';

describe('Button', () => {
  it('schema basics', () => {
    expect(schema.name).toBe('Button');
    expect(schema.category).toBe('primitive');
    expect(schema.props.label.required).toBe(true);
  });

  it('renders a button element with default classes', () => {
    const el = createButton({ label: 'Hi' });
    expect(el.tagName).toBe('BUTTON');
    expect(el.className).toContain('btn');
    expect(el.className).toContain('btn-primary');
    expect(el.className).toContain('text-btn-m');
    expect(el.textContent).toBe('Hi');
  });

  it('applies variant + size from props (sm → btn-sm + text-mini)', () => {
    const el = createButton({ label: 'X', variant: 'secondary', size: 'sm' });
    expect(el.className).toContain('btn-secondary');
    expect(el.className).toContain('btn-sm');
    expect(el.className).toContain('text-mini');
  });

  it('size lg adds btn-l + text-btn-l', () => {
    const el = createButton({ label: 'X', size: 'lg' });
    expect(el.className).toContain('btn-l');
    expect(el.className).toContain('text-btn-l');
  });

  it('prepends a Material Symbols span when icon is given', () => {
    const el = createButton({ label: 'X', icon: 'star' });
    const icon = el.querySelector('.ms');
    expect(icon).not.toBeNull();
    expect(icon?.textContent).toBe('star');
  });

  it('respects disabled', () => {
    const el = createButton({ label: 'X', disabled: true });
    expect(el.disabled).toBe(true);
  });

  it('wires onClick', () => {
    const onClick = vi.fn();
    const el = createButton({ label: 'X', onClick });
    el.click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('every variant in schema.variants renders without throwing', () => {
    for (const v of schema.variants ?? []) {
      expect(() => createButton({ label: 'X', variant: v as ButtonVariant })).not.toThrow();
    }
  });

  it('is registered in the registry', () => {
    expect(registry.Button).toBeDefined();
    expect(registry.Button.name).toBe('Button');
  });
});

type ButtonVariant = 'primary' | 'secondary';
