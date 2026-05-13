/**
 * Three-slot horizontal row primitive — leading / body / trailing.
 * Replaces ad-hoc rows like .meal-row, .edit-row, .dist-row by giving
 * each slot an explicit class hook. Strings or HTMLElements both work
 * in any slot.
 */
import type { ComponentSchema } from './_schema';

type Slot = HTMLElement | string;

export interface ListRowProps {
  leading?: Slot;
  body: Slot;
  trailing?: Slot;
}

export const schema: ComponentSchema = {
  name: 'ListRow',
  category: 'primitive',
  description: 'Three-slot row (leading / body / trailing).',
  props: {
    leading:  { type: 'element', description: 'Optional left slot (icon, emoji, image)' },
    body:     { type: 'element', required: true, description: 'Main content' },
    trailing: { type: 'element', description: 'Optional right slot (action, value)' },
  },
  slots: ['leading', 'body', 'trailing'],
};

function attach(parent: HTMLElement, slotClass: string, content: Slot): void {
  const wrap = document.createElement('div');
  wrap.className = slotClass;
  if (typeof content === 'string') {
    wrap.textContent = content;
  } else {
    wrap.append(content);
  }
  parent.append(wrap);
}

export default function createListRow(props: ListRowProps): HTMLDivElement {
  const { leading, body, trailing } = props;
  const row = document.createElement('div');
  row.className = 'list-row';
  if (leading !== undefined) attach(row, 'list-row-leading', leading);
  attach(row, 'list-row-body', body);
  if (trailing !== undefined) attach(row, 'list-row-trailing', trailing);
  return row;
}
