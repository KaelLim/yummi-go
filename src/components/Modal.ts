/**
 * Centered overlay with a card. Tap the backdrop to close (calls
 * onClose). Tap inside the card does nothing. Use Modal for short
 * decisions / prompts; use Sheet for forms anchored to the bottom edge.
 */
import type { ComponentSchema } from './_schema';

type Slot = HTMLElement | string;

export interface ModalProps {
  title: string;
  body: Slot;
  actions?: HTMLElement[];
  open?: boolean;
  onClose?: () => void;
}

export const schema: ComponentSchema = {
  name: 'Modal',
  category: 'layout',
  description: 'Centered overlay with a card body and optional action row.',
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

export default function createModal(props: ModalProps): HTMLDivElement {
  const { title, body, actions, open = true, onClose } = props;
  const root = document.createElement('div');
  root.className = 'modal-shell';
  root.hidden = !open;

  const card = document.createElement('div');
  card.className = 'modal-card';
  card.addEventListener('click', (e) => e.stopPropagation());

  const t = document.createElement('h2');
  t.className = 'modal-title text-h3';
  t.textContent = title;
  card.append(t);

  const b = document.createElement('div');
  b.className = 'modal-body';
  attach(b, body);
  card.append(b);

  if (actions && actions.length > 0) {
    const a = document.createElement('div');
    a.className = 'modal-actions';
    for (const btn of actions) a.append(btn);
    card.append(a);
  }

  root.append(card);
  if (onClose) root.addEventListener('click', () => onClose());
  return root;
}
