/**
 * Small inline badge — used as 推薦 / 硬核 pills next to headings,
 * status indicators, etc. Visual is the new generic .tag .tag-<variant>
 * CSS (added in this commit), so we don't reuse the older domain-
 * specific .level-tag class.
 */
import type { ComponentSchema } from './_schema';

export type TagVariant = 'default' | 'secondary' | 'success' | 'warning';

export interface TagProps {
  label: string;
  variant?: TagVariant;
}

export const schema: ComponentSchema = {
  name: 'Tag',
  category: 'primitive',
  description: 'Small inline badge for status / category labels.',
  props: {
    label:   { type: 'string', required: true },
    variant: { type: 'enum',   enum: ['default', 'secondary', 'success', 'warning'], default: 'default' },
  },
  variants: ['default', 'secondary', 'success', 'warning'],
};

export default function createTag(props: TagProps): HTMLSpanElement {
  const { label, variant = 'default' } = props;
  const el = document.createElement('span');
  el.className = `tag tag-${variant}`;
  el.textContent = label;
  return el;
}
