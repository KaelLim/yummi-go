import { describe, it, expect, vi } from 'vitest';
import createFilterChip, { schema } from '../FilterChip';
import { registry } from '../registry';

describe('FilterChip', () => {
  it('schema basics', () => {
    expect(schema.name).toBe('FilterChip');
    expect(schema.category).toBe('primitive');
  });

  it('renders a button with .filter-chip', () => {
    const el = createFilterChip({ label: '中式' });
    expect(el.tagName).toBe('BUTTON');
    expect(el.className).toContain('filter-chip');
    expect(el.textContent).toBe('中式');
  });

  it('selected adds .selected class', () => {
    const el = createFilterChip({ label: 'X', selected: true });
    expect(el.classList.contains('selected')).toBe(true);
  });

  it('value goes onto data-value when given', () => {
    const el = createFilterChip({ label: 'X', value: 'chinese' });
    expect(el.dataset.value).toBe('chinese');
  });

  it('wires onClick', () => {
    const onClick = vi.fn();
    const el = createFilterChip({ label: 'X', onClick });
    el.click();
    expect(onClick).toHaveBeenCalled();
  });

  it('is registered', () => {
    expect(registry.FilterChip).toBeDefined();
  });
});
