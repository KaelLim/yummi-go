/**
 * Generic content card — padded, rounded container with optional
 * shadow. Use Card whenever you need a content surface that isn't a
 * full-screen layout. Three variants share the same shape, differ only
 * in elevation.
 */
import type { ComponentSchema } from './_schema';

export type CardVariant = 'default' | 'flat' | 'raised';

export interface CardProps {
  children: HTMLElement | HTMLElement[] | string;
  variant?: CardVariant;
}

export const schema: ComponentSchema = {
  name: 'Card',
  category: 'primitive',
  description: 'Padded rounded content container, three elevation variants.',
  props: {
    children: { type: 'element', required: true, description: 'String, HTMLElement, or array of elements' },
    variant:  { type: 'enum',    enum: ['default', 'flat', 'raised'], default: 'default' },
  },
  variants: ['default', 'flat', 'raised'],
};

export default function createCard(props: CardProps): HTMLDivElement {
  const { children, variant = 'default' } = props;
  const card = document.createElement('div');
  card.className = `card-shell card-${variant}`;
  if (typeof children === 'string') {
    card.textContent = children;
  } else if (Array.isArray(children)) {
    for (const c of children) card.append(c);
  } else {
    card.append(children);
  }
  return card;
}
