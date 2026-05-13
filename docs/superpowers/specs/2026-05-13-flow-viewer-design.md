# Flow Viewer (`/dev/flows`) — Design Spec

**Date:** 2026-05-13
**Status:** Draft — autonomous brainstorm (Subsystem B)
**Depends on:** Subsystem A — component schema system (uses Card, Button)

## Goal

A dev-facing `/dev/flows` page that renders each prototype user journey as a Miro-style node graph. Helps stakeholders understand how screens connect at a glance, and gives AI / new devs a map of cross-route dependencies without grepping `navigate(...)` calls.

## Why now

- The prototype is now ~20 routes with non-trivial transitions (first-check-in flow alone touches splash → onboarding (5 screens) → home → check-in (5 screens) → success → challenge-level → eat-times → home).
- Stakeholder demos waste time tracing the path verbally. A visual map turns "let me show you" into "click here".
- AI agents touching one route need to know its incoming + outgoing edges to avoid breaking the chain. The flow file is now the source of truth they can read.

## Non-goals (out of v1 scope)

- Drag-to-edit. Coords are hand-curated in the data file.
- Pan / zoom. The canvas is just a scrollable area.
- Auto-derivation from `navigate(...)` calls. Brittle and high-effort; hand-curated wins.
- User-facing access. The route is dev-only — surfaced through DevPanel.
- Mermaid / react-flow / d3 dependencies. Vanilla SVG is enough.

## Architecture

```
src/flows/
├── _types.ts                 # Flow, FlowNode, FlowEdge
├── index.ts                  # registry — auto-indexes flow files via import.meta.glob
├── registration.ts           # v1 flow #1
└── first-checkin.ts          # v1 flow #2

src/routes/dev/
└── flows.ts                  # the /dev/flows route — sidebar + canvas + SVG arrows

src/router.ts                 # register `/dev/flows`
src/styles/globals.css        # add .flow-* block
```

## Data layer

```typescript
// src/flows/_types.ts
export interface FlowNode {
  id: string;                  // 'splash', 'diet-survey'
  routePath: string;           // '/splash', '/onboarding/diet-survey'
  title: string;               // 'Splash', '飲食習慣'
  description?: string;        // optional one-line note
  x: number;                   // logical grid units (multiplied by CELL_W in render)
  y: number;                   // logical grid units (multiplied by CELL_H in render)
}

export interface FlowEdge {
  from: string;                // node id
  to: string;                  // node id
  trigger: string;             // 'tap Get Started', 'after 1.2s', '若 challenge_level=null'
}

export interface Flow {
  id: string;                  // 'registration'
  name: string;                // '註冊與初次設定'
  description: string;         // one-line summary for the sidebar
  nodes: readonly FlowNode[];
  edges: readonly FlowEdge[];
}
```

`src/flows/index.ts` exports `flows: Flow[]` and `getFlow(id): Flow | undefined`, sourced from `import.meta.glob('./[a-z]*.ts', { eager: true })` (skipping `_types.ts` and `index.ts`). Each flow file `export default` a Flow object.

## Layout convention

- Coordinates are logical units (0, 1, 2, …), not pixels.
- Render multiplies by `CELL_W = 220` (px) and `CELL_H = 140` (px).
- Nodes are 200x110 cards. Plenty of room for arrows between rows.
- Hand-curated: each flow file specifies x/y per node. Author picks a layout that reads top-to-bottom for sequential flows and side-by-side for branches.

## View layer (`/dev/flows`)

Layout (desktop):

```
┌─────────────┬─────────────────────────────────────┐
│  Flows      │  <flow.name>                        │
│ ────────    │  <flow.description>                 │
│ • 註冊       │ ┌─────────────────────────────────┐ │
│ • 首次打卡   │ │  [splash]                       │ │
│ • ...       │ │     │ 1.2s                       │ │
│             │ │     ▼                            │ │
│             │ │  [diet-survey]                   │ │
│             │ │     │ 選項                        │ │
│             │ │     ▼                            │ │
│             │ │  ...                             │ │
│             │ └─────────────────────────────────┘ │
└─────────────┴─────────────────────────────────────┘
```

Components reused from Subsystem A:
- **Card** for each node (variant: `raised`).
- **Button** for sidebar items (variant: `secondary` / `primary` selected).

The arrows are drawn by an `<svg>` layer absolutely positioned over the canvas. For each edge:
- Get from-node center and to-node center.
- Draw a polyline from from-center down-to-mid then across-to to-center (right-angle elbow).
- Mid-segment label = `edge.trigger`.
- Arrow head as SVG `<marker>` at the to-end.

## Routing

Add a `/dev/flows` route to `src/router.ts`. Visible only via DevPanel (already in the codebase). No nav-bar entry.

## Tests

- `flows/index.test.ts`: registry auto-indexes flow files, returns sorted `flows`, `getFlow('registration')` returns the right object, `getFlow('nope')` returns `undefined`.
- `flows/registration.test.ts`: hand-written flow asserts structural invariants — every `edge.from` and `edge.to` matches some `node.id`, no orphan nodes (unless explicitly allowed), at least one root node (no incoming edges).
- `flows/first-checkin.test.ts`: same invariants.
- `routes/dev/flows.test.ts`: sidebar lists every registered flow; selecting a flow renders one card per node + one SVG `<line>` per edge.

## Migration / future work (out of v1)

- Add more flows: daily check-in, tasks system, map + makeup, day-30.
- Add a "view source" link from each node to its route file.
- Highlight the current screen (when accessed mid-session) as you navigate.
- Auto-layout fallback when coordinates are omitted.

## Acceptance criteria

- [ ] `src/flows/_types.ts` defines `Flow`, `FlowNode`, `FlowEdge`.
- [ ] `src/flows/index.ts` auto-indexes flow files and exports `flows`, `getFlow`.
- [ ] Two hand-written flow files ship: `registration.ts`, `first-checkin.ts`.
- [ ] `/dev/flows` route renders sidebar + canvas + SVG arrows.
- [ ] All existing tests still pass; ≥4 new tests cover the registry + the two flows + the route.
- [ ] `npm run build` clean.
- [ ] Manual sanity check on deploy.
