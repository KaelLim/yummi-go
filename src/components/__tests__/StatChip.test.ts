import { describe, it, expect } from 'vitest';
import createStatChip, { schema } from '../StatChip';
import { registry } from '../registry';

describe('StatChip', () => {
  it('schema basics', () => {
    expect(schema.name).toBe('StatChip');
    expect(schema.category).toBe('primitive');
  });

  it('renders icon + value + unit inside .resource-chip', () => {
    const el = createStatChip({ icon: 'eco', value: 420, unit: 'XP', resource: 'xp' });
    expect(el.className).toContain('resource-chip');
    expect(el.dataset.resource).toBe('xp');
    expect(el.querySelector('.ms')?.textContent).toBe('eco');
    expect(el.querySelector('.resource-num')?.textContent).toBe('420');
    expect(el.querySelector('.resource-unit')?.textContent).toBe('XP');
  });

  it('omits unit element when unit is not provided', () => {
    const el = createStatChip({ icon: 'diamond', value: 12 });
    expect(el.querySelector('.resource-unit')).toBeNull();
  });

  it('uses title prop as tooltip', () => {
    const el = createStatChip({ icon: 'eco', value: 1, title: '累計總 XP' });
    expect(el.title).toBe('累計總 XP');
  });

  it('is registered', () => {
    expect(registry.StatChip).toBeDefined();
  });
});
