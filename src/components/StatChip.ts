/**
 * Display chip showing a numeric stat — icon + value + optional unit.
 * Covers the home header XP / gem / card chips (.resource-chip pattern).
 * Reuses the existing .resource-chip / .resource-num / .resource-unit CSS.
 */
import type { ComponentSchema } from './_schema';

export interface StatChipProps {
  icon: string;
  value: number | string;
  unit?: string;
  resource?: string;
  title?: string;
}

export const schema: ComponentSchema = {
  name: 'StatChip',
  category: 'primitive',
  description: 'Icon + value + optional unit display (resource header chip).',
  props: {
    icon:     { type: 'string', required: true, description: 'Material Symbol name' },
    value:    { type: 'string', required: true, description: 'number or string — coerced to string' },
    unit:     { type: 'string' },
    resource: { type: 'string', description: 'Stamped onto data-resource for CSS variants' },
    title:    { type: 'string', description: 'Tooltip text' },
  },
};

export default function createStatChip(props: StatChipProps): HTMLDivElement {
  const { icon, value, unit, resource, title } = props;
  const el = document.createElement('div');
  el.className = 'resource-chip';
  if (resource) el.dataset.resource = resource;
  if (title) el.title = title;

  const ic = document.createElement('span');
  ic.className = 'ms';
  ic.textContent = icon;
  el.append(ic);

  const num = document.createElement('span');
  num.className = 'resource-num';
  num.textContent = String(value);
  el.append(num);

  if (unit) {
    const u = document.createElement('span');
    u.className = 'resource-unit';
    u.textContent = unit;
    el.append(u);
  }
  return el;
}
