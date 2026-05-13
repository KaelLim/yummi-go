import { describe, it, expect } from 'vitest';
import createBanner, { schema } from '../Banner';
import { registry } from '../registry';

describe('Banner', () => {
  it('schema basics', () => {
    expect(schema.name).toBe('Banner');
    expect(schema.category).toBe('primitive');
  });

  it('renders emoji + title + body', () => {
    const el = createBanner({ emoji: '🎉', title: 'Hello', body: 'sub' });
    expect(el.className).toContain('banner-shell');
    expect(el.querySelector('.banner-emoji')?.textContent).toBe('🎉');
    expect(el.querySelector('.banner-title')?.textContent).toBe('Hello');
    expect(el.querySelector('.banner-body')?.textContent).toBe('sub');
  });

  it('omits emoji when not provided', () => {
    const el = createBanner({ title: 'Plain' });
    expect(el.querySelector('.banner-emoji')).toBeNull();
  });

  it('appends action elements when provided', () => {
    const a = document.createElement('button'); a.textContent = 'OK';
    const el = createBanner({ title: 'X', actions: [a] });
    expect(el.querySelector('.banner-actions button')?.textContent).toBe('OK');
  });

  it('applies variant class', () => {
    const el = createBanner({ title: 'X', variant: 'warning' });
    expect(el.className).toContain('banner-warning');
  });

  it('is registered', () => {
    expect(registry.Banner).toBeDefined();
  });
});
