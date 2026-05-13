/**
 * Standard tappable action button. Visual styling delegates to the
 * existing CSS in src/styles/globals.css + tokens.css:
 *   .btn (base) + .btn-<variant> + size-specific size + text class.
 * Sizes:
 *   sm → .btn-sm + .text-mini
 *   md → (no size class) + .text-btn-m  (default)
 *   lg → .btn-l + .text-btn-l
 * Variants currently shipped in CSS: primary, secondary. ghost / danger
 * are intentionally not exposed in v1 — add them when the CSS gets the
 * matching classes.
 */
import type { ComponentSchema } from './_schema';

export type ButtonVariant = 'primary' | 'secondary';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: string;
  disabled?: boolean;
  onClick?: () => void;
}

const SIZE_CLASS: Record<ButtonSize, string> = { sm: 'btn-sm', md: '', lg: 'btn-l' };
const TEXT_CLASS: Record<ButtonSize, string> = { sm: 'text-mini', md: 'text-btn-m', lg: 'text-btn-l' };

export const schema: ComponentSchema = {
  name: 'Button',
  category: 'primitive',
  description: 'Tappable action button. Visual styled via existing .btn-* CSS.',
  props: {
    label:    { type: 'string',   required: true },
    variant:  { type: 'enum',     enum: ['primary', 'secondary'], default: 'primary' },
    size:     { type: 'enum',     enum: ['sm', 'md', 'lg'], default: 'md' },
    icon:     { type: 'string',   description: 'Material Symbol name' },
    disabled: { type: 'boolean',  default: false },
    onClick:  { type: 'function' },
  },
  variants: ['primary', 'secondary'],
  examples: [
    { label: 'Primary CTA',  props: { label: '繼續', variant: 'primary', size: 'lg' } },
    { label: 'Small action', props: { label: '取消', variant: 'secondary', size: 'sm' } },
  ],
};

export default function createButton(props: ButtonProps): HTMLButtonElement {
  const { label, variant = 'primary', size = 'md', icon, disabled = false, onClick } = props;
  const btn = document.createElement('button');
  const sizeClass = SIZE_CLASS[size];
  btn.className = ['btn', `btn-${variant}`, sizeClass, TEXT_CLASS[size]].filter(Boolean).join(' ');
  btn.disabled = disabled;
  if (icon) {
    const ic = document.createElement('span');
    ic.className = 'ms';
    ic.textContent = icon;
    btn.append(ic);
  }
  btn.append(document.createTextNode(label));
  if (onClick) btn.addEventListener('click', onClick);
  return btn;
}
