import { describe, it, expect, vi } from 'vitest';
import createModal, { schema } from '../Modal';
import { registry } from '../registry';

describe('Modal', () => {
  it('schema basics', () => {
    expect(schema.name).toBe('Modal');
    expect(schema.category).toBe('layout');
  });

  it('renders an overlay with a card containing title + body', () => {
    const el = createModal({ title: 'Hello', body: 'world' });
    expect(el.className).toContain('modal-shell');
    expect(el.querySelector('.modal-card')).not.toBeNull();
    expect(el.querySelector('.modal-title')?.textContent).toBe('Hello');
    expect(el.querySelector('.modal-body')?.textContent).toBe('world');
  });

  it('open=false sets hidden', () => {
    const el = createModal({ title: 'X', body: 'y', open: false });
    expect(el.hidden).toBe(true);
  });

  it('open=true is visible', () => {
    const el = createModal({ title: 'X', body: 'y', open: true });
    expect(el.hidden).toBe(false);
  });

  it('appends action buttons', () => {
    const btn = document.createElement('button'); btn.textContent = 'OK';
    const el = createModal({ title: 'X', body: 'y', actions: [btn] });
    expect(el.querySelector('.modal-actions button')?.textContent).toBe('OK');
  });

  it('clicking the backdrop fires onClose', () => {
    const onClose = vi.fn();
    const el = createModal({ title: 'X', body: 'y', onClose });
    el.click();
    expect(onClose).toHaveBeenCalled();
  });

  it('clicking the inner card does not fire onClose', () => {
    const onClose = vi.fn();
    const el = createModal({ title: 'X', body: 'y', onClose });
    (el.querySelector('.modal-card') as HTMLElement).click();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('is registered', () => {
    expect(registry.Modal).toBeDefined();
  });
});
