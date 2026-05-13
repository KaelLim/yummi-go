/**
 * Bottom-anchored overlay with a card. Same internals as Modal but the
 * card slides up from the bottom edge. Used for forms / editors where
 * the keyboard might cover a centered modal on mobile.
 */
import type { ComponentSchema } from './_schema';

type Slot = HTMLElement | string;

export interface SheetProps {
  title: string;
  body: Slot;
  actions?: HTMLElement[];
  open?: boolean;
  onClose?: () => void;
}

export const schema: ComponentSchema = {
  name: 'Sheet',
  category: 'layout',
  description: 'Bottom-aligned overlay (a Modal that slides up from the bottom).',
  props: {
    title:   { type: 'string',  required: true },
    body:    { type: 'element', required: true },
    actions: { type: 'array',   itemType: 'element' },
    open:    { type: 'boolean', default: true },
    onClose: { type: 'function' },
  },
};

function attach(parent: HTMLElement, content: Slot): void {
  if (typeof content === 'string') parent.append(document.createTextNode(content));
  else parent.append(content);
}

export default function createSheet(props: SheetProps): HTMLDivElement {
  const { title, body, actions, open = true, onClose } = props;
  const root = document.createElement('div');
  root.className = 'sheet-shell';
  root.hidden = !open;

  const card = document.createElement('div');
  card.className = 'sheet-card';
  card.addEventListener('click', (e) => e.stopPropagation());

  const t = document.createElement('h2');
  t.className = 'sheet-title text-h3';
  t.textContent = title;
  card.append(t);

  const b = document.createElement('div');
  b.className = 'sheet-body';
  attach(b, body);
  card.append(b);

  if (actions && actions.length > 0) {
    const a = document.createElement('div');
    a.className = 'sheet-actions';
    for (const btn of actions) a.append(btn);
    card.append(a);
  }

  root.append(card);
  if (onClose) root.addEventListener('click', () => onClose());
  return root;
}
