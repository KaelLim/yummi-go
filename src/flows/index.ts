/**
 * Flow registry — auto-imports every lowercase .ts under src/flows/
 * (skipping _types.ts and index.ts) and exposes them as a sorted array.
 */
import type { Flow } from './_types';

const modules = import.meta.glob<{ default?: Flow }>(
  './[a-z]*.ts',
  { eager: true },
);

export const flows: Flow[] = Object.values(modules)
  .map((m) => m.default)
  .filter((f): f is Flow => Boolean(f))
  // Author-controlled order first, then id as a stable tiebreaker.
  .sort((a, b) => ((a.order ?? 100) - (b.order ?? 100)) || a.id.localeCompare(b.id));

export function getFlow(id: string): Flow | undefined {
  return flows.find((f) => f.id === id);
}

export type { Flow, FlowNode, FlowEdge } from './_types';
