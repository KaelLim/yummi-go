import { describe, it, expect } from 'vitest';
import { flows } from '../index';

describe('shipping flows', () => {
  it('ships at least the registration + first-checkin flows', () => {
    const ids = flows.map((f) => f.id);
    expect(ids).toContain('registration');
    expect(ids).toContain('first-checkin');
  });

  it('every edge references existing node ids', () => {
    for (const f of flows) {
      const ids = new Set(f.nodes.map((n) => n.id));
      for (const e of f.edges) {
        expect(ids.has(e.from), `${f.id}: edge.from=${e.from}`).toBe(true);
        expect(ids.has(e.to),   `${f.id}: edge.to=${e.to}`).toBe(true);
      }
    }
  });

  it('every flow has at least one root node (no incoming edge)', () => {
    for (const f of flows) {
      const hasIncoming = new Set(f.edges.map((e) => e.to));
      const roots = f.nodes.filter((n) => !hasIncoming.has(n.id));
      expect(roots.length, `${f.id} should have ≥1 root`).toBeGreaterThan(0);
    }
  });

  it('node ids are unique within a flow', () => {
    for (const f of flows) {
      const ids = f.nodes.map((n) => n.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});
