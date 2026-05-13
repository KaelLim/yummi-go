/**
 * Highlighted full-width info card — emoji + title + body + optional
 * action buttons. Covers the AHA first-banner and the meat-detection
 * banner patterns. Four variants tint the background + border.
 */
import type { ComponentSchema } from './_schema';

export type BannerVariant = 'info' | 'success' | 'warning' | 'meat-prompt';

export interface BannerProps {
  title: string;
  body?: string;
  emoji?: string;
  actions?: HTMLElement[];
  variant?: BannerVariant;
}

export const schema: ComponentSchema = {
  name: 'Banner',
  category: 'primitive',
  description: 'Highlighted info card with emoji + title + body + actions.',
  props: {
    title:   { type: 'string',  required: true },
    body:    { type: 'string',  description: 'Subtext below the title' },
    emoji:   { type: 'string',  description: 'Leading emoji or symbol' },
    actions: { type: 'array',   itemType: 'element', description: 'Buttons rendered in a trailing row' },
    variant: { type: 'enum',    enum: ['info', 'success', 'warning', 'meat-prompt'], default: 'info' },
  },
  variants: ['info', 'success', 'warning', 'meat-prompt'],
};

export default function createBanner(props: BannerProps): HTMLDivElement {
  const { title, body, emoji, actions, variant = 'info' } = props;
  const root = document.createElement('div');
  root.className = `banner-shell banner-${variant}`;

  if (emoji) {
    const e = document.createElement('span');
    e.className = 'banner-emoji';
    e.textContent = emoji;
    root.append(e);
  }

  const text = document.createElement('div');
  text.className = 'banner-body-wrap';
  const t = document.createElement('strong');
  t.className = 'banner-title';
  t.textContent = title;
  text.append(t);
  if (body) {
    const b = document.createElement('p');
    b.className = 'banner-body';
    b.textContent = body;
    text.append(b);
  }
  root.append(text);

  if (actions && actions.length > 0) {
    const a = document.createElement('div');
    a.className = 'banner-actions';
    for (const btn of actions) a.append(btn);
    root.append(a);
  }
  return root;
}
