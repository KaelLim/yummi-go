/**
 * Toggleable filter pill — used in the map page place-type / partner
 * filters. Reuses the existing .filter-chip / .selected CSS rules; this
 * factory only handles state composition + event wiring.
 */
import type { ComponentSchema } from './_schema';

export interface FilterChipProps {
  label: string;
  value?: string;
  selected?: boolean;
  onClick?: () => void;
}

export const schema: ComponentSchema = {
  name: 'FilterChip',
  category: 'primitive',
  description: 'Toggleable filter pill (map filters, etc.).',
  props: {
    label:    { type: 'string',   required: true },
    value:    { type: 'string',   description: 'Stamped onto data-value for CSS / handlers.' },
    selected: { type: 'boolean',  default: false },
    onClick:  { type: 'function' },
  },
};

export default function createFilterChip(props: FilterChipProps): HTMLButtonElement {
  const { label, value, selected = false, onClick } = props;
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'filter-chip' + (selected ? ' selected' : '');
  if (value !== undefined) el.dataset.value = value;
  el.textContent = label;
  if (onClick) el.addEventListener('click', onClick);
  return el;
}
