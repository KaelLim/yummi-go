import { describe, it, expect } from 'vitest';
import type {
  ComponentSchema,
  PropSchema,
  PropType,
  ComponentCategory,
  ComponentExample,
} from '../_schema';

describe('_schema types', () => {
  it('accepts a minimal component schema literal', () => {
    const s: ComponentSchema = {
      name: 'Foo',
      category: 'primitive',
      description: 'A foo.',
      props: {},
    };
    expect(s.name).toBe('Foo');
    expect(s.category).toBe('primitive');
  });

  it('accepts an enum prop with values and a default', () => {
    const p: PropSchema = {
      type: 'enum',
      enum: ['a', 'b'],
      default: 'a',
    };
    expect(p.enum).toEqual(['a', 'b']);
    expect(p.default).toBe('a');
  });

  it('accepts variants, slots, and examples on a schema', () => {
    const example: ComponentExample = { label: 'Default', props: { label: 'X' } };
    const s: ComponentSchema = {
      name: 'Bar',
      category: 'layout',
      description: 'Bar.',
      props: { label: { type: 'string', required: true } },
      variants: ['a', 'b'],
      slots: ['leading'],
      examples: [example],
    };
    expect(s.variants).toEqual(['a', 'b']);
    expect(s.examples?.[0].label).toBe('Default');
  });

  it('ComponentCategory accepts the three documented values', () => {
    const cats: ComponentCategory[] = ['primitive', 'layout', 'pattern'];
    expect(cats).toHaveLength(3);
  });

  it('PropType accepts the documented type literals', () => {
    const t: PropType[] = ['string', 'number', 'boolean', 'enum', 'function', 'element', 'array'];
    expect(t).toHaveLength(7);
  });
});
