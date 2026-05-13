/**
 * Central component registry. Auto-imports every capitalised .ts file in
 * this directory (skipping _schema.ts and registry.ts) and indexes them by
 * their `schema.name`. Throws on duplicate names so collisions surface
 * immediately on app boot.
 */
import type { ComponentSchema } from './_schema';

const modules = import.meta.glob<{ schema?: ComponentSchema }>(
  './[A-Z]*.ts',
  { eager: true },
);

export const registry: Record<string, ComponentSchema> = Object.create(null);
const seen = new Set<string>();
for (const path in modules) {
  const s = modules[path].schema;
  if (!s) continue;
  if (seen.has(s.name)) {
    throw new Error(`[components/registry] duplicate schema name: ${s.name} (${path})`);
  }
  seen.add(s.name);
  registry[s.name] = s;
}

export function listComponents(): string[] {
  return Object.keys(registry).sort();
}

export function getSchema(name: string): ComponentSchema | undefined {
  return registry[name];
}

export function byCategory(): Record<ComponentSchema['category'], ComponentSchema[]> {
  const groups: Record<ComponentSchema['category'], ComponentSchema[]> = {
    primitive: [], layout: [], pattern: [],
  };
  for (const s of Object.values(registry)) groups[s.category].push(s);
  return groups;
}
