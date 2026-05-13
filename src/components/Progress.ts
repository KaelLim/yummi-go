/**
 * Onboarding progress dots — N segments, the first M filled with `.done`.
 *
 * Migrated to the schema-driven shape: now a default factory taking a
 * props object, plus a `schema` export so the registry can index it.
 * A backwards-compatible named export `createProgress` is preserved so
 * routes that were already using the function-form import keep working
 * after they migrate to the props-object call signature.
 */
import type { ComponentSchema } from './_schema';

export interface ProgressProps {
  current: number;
  total: number;
}

export const schema: ComponentSchema = {
  name: 'Progress',
  category: 'pattern',
  description: 'Horizontal row of N dots, first M filled. Used at the top of onboarding screens.',
  props: {
    current: { type: 'number', required: true, description: '1-based count of completed steps' },
    total:   { type: 'number', required: true, description: 'Total number of steps' },
  },
  examples: [
    { label: 'Onboarding 3/5', props: { current: 3, total: 5 } },
  ],
};

export default function createProgress(props: ProgressProps): HTMLElement {
  const { current, total } = props;
  const wrap = document.createElement('div');
  wrap.className = 'onb-progress';
  for (let i = 1; i <= total; i++) {
    const dot = document.createElement('span');
    dot.className = 'onb-progress-dot' + (i <= current ? ' done' : '');
    wrap.appendChild(dot);
  }
  return wrap;
}

export { createProgress };
