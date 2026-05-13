import { describe, it, expect } from 'vitest';
import createListRow, { schema } from '../ListRow';
import { registry } from '../registry';

describe('ListRow', () => {
  it('schema basics', () => {
    expect(schema.name).toBe('ListRow');
    expect(schema.category).toBe('primitive');
  });

  it('renders a div.list-row containing a body slot', () => {
    const el = createListRow({ body: 'Hello' });
    expect(el.className).toContain('list-row');
    expect(el.querySelector('.list-row-body')?.textContent).toBe('Hello');
  });

  it('renders a leading slot when provided', () => {
    const leading = document.createElement('span');
    leading.textContent = '🥬';
    const el = createListRow({ leading, body: 'lettuce' });
    expect(el.querySelector('.list-row-leading')?.firstChild?.textContent).toBe('🥬');
  });

  it('renders a trailing slot when provided', () => {
    const el = createListRow({ body: 'item', trailing: 'X' });
    expect(el.querySelector('.list-row-trailing')?.textContent).toBe('X');
  });

  it('is registered', () => {
    expect(registry.ListRow).toBeDefined();
  });
});
