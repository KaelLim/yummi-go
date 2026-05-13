/**
 * Flow viewer data model.
 *
 * A Flow is a directed graph of screens (nodes) connected by transitions
 * (edges). Coordinates are logical grid units, multiplied by CELL_W /
 * CELL_H in the renderer. Hand-curated per flow file.
 */

export interface FlowNode {
  id: string;
  routePath: string;
  title: string;
  description?: string;
  x: number;
  y: number;
}

export interface FlowEdge {
  from: string;
  to: string;
  trigger: string;
}

export interface Flow {
  id: string;
  name: string;
  description: string;
  /** Lower numbers sort first in the sidebar. Default = 100. */
  order?: number;
  nodes: readonly FlowNode[];
  edges: readonly FlowEdge[];
}
