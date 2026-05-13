/**
 * Shared schema types for the component registry.
 *
 * Every component file under src/components/ that starts with a capital
 * letter must export a `schema: ComponentSchema` constant alongside its
 * factory function. registry.ts picks them up automatically.
 */

export type PropType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'enum'
  | 'function'
  | 'element'
  | 'array';

export interface PropSchema {
  type: PropType;
  required?: boolean;
  default?: unknown;
  enum?: readonly string[];
  itemType?: PropType;
  description?: string;
}

export type PropSchemaMap = Record<string, PropSchema>;

export interface ComponentExample {
  label: string;
  props: Record<string, unknown>;
  notes?: string;
}

export type ComponentCategory = 'primitive' | 'layout' | 'pattern';

export interface ComponentSchema {
  name: string;
  category: ComponentCategory;
  description: string;
  props: PropSchemaMap;
  variants?: readonly string[];
  slots?: readonly string[];
  examples?: readonly ComponentExample[];
}
