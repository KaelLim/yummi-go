# Flow Viewer (`/dev/flows`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to drive the tasks below.

**Goal:** Ship `/dev/flows` — a dev-only page rendering each user journey as a Miro-style node graph (Card nodes + SVG arrows).

**Architecture:** Hand-curated flow files under `src/flows/` (each `export default` a `Flow` object), auto-indexed by `src/flows/index.ts` via `import.meta.glob`. The route at `src/routes/dev/flows.ts` renders a sidebar (flow list) + canvas (Cards positioned by `(x,y)` × constants, SVG `<line>` arrows between them).

**Tech Stack:** TypeScript, vanilla DOM factories, schema-driven Card component (from Subsystem A), inline SVG for arrows.

---

## File structure

```
src/flows/
├── _types.ts              # Flow / FlowNode / FlowEdge
├── index.ts               # auto-index registry
├── registration.ts        # flow data #1
└── first-checkin.ts       # flow data #2

src/routes/dev/
└── flows.ts               # /dev/flows route

src/router.ts              # register /dev/flows
src/components/DevPanel.ts # surface a link to it
src/styles/globals.css     # .flow-* block

src/flows/__tests__/
├── index.test.ts
└── flows.test.ts          # invariant check across both shipping flows

src/routes/__tests__/
└── dev-flows.test.ts
```

---

## Task B1: Flow types

**Files:**
- Create: `src/flows/_types.ts`

- [ ] **Step 1: Define the three interfaces**

```typescript
// src/flows/_types.ts
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
  nodes: readonly FlowNode[];
  edges: readonly FlowEdge[];
}
```

- [ ] **Step 2: Commit**

```bash
git add src/flows/_types.ts
git commit -m "feat(flows): define Flow / FlowNode / FlowEdge types"
```

---

## Task B2: Flow registry

**Files:**
- Create: `src/flows/index.ts`
- Test: `src/flows/__tests__/index.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// src/flows/__tests__/index.test.ts
import { describe, it, expect } from 'vitest';
import { flows, getFlow } from '../index';

describe('flows registry', () => {
  it('flows is a sorted array (may be empty before any flow ships)', () => {
    expect(Array.isArray(flows)).toBe(true);
    const ids = flows.map((f) => f.id);
    const sorted = [...ids].sort();
    expect(ids).toEqual(sorted);
  });

  it('getFlow returns undefined for unknown id', () => {
    expect(getFlow('does-not-exist')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Implement**

```typescript
// src/flows/index.ts
import type { Flow } from './_types';

const modules = import.meta.glob<{ default?: Flow }>(
  './[a-z]*.ts',
  { eager: true },
);

export const flows: Flow[] = Object.values(modules)
  .map((m) => m.default)
  .filter((f): f is Flow => Boolean(f))
  .sort((a, b) => a.id.localeCompare(b.id));

export function getFlow(id: string): Flow | undefined {
  return flows.find((f) => f.id === id);
}

export type { Flow, FlowNode, FlowEdge } from './_types';
```

- [ ] **Step 3: Verify**

`npx vitest run src/flows/__tests__/index.test.ts` → 2 pass.

- [ ] **Step 4: Commit**

---

## Task B3: Registration flow data

**Files:**
- Create: `src/flows/registration.ts`

- [ ] **Step 1: Write the flow** (Splash → Onboarding → Home, the post-Get-Started happy path)

```typescript
// src/flows/registration.ts
import type { Flow } from './_types';

const flow: Flow = {
  id: 'registration',
  name: '註冊與初次設定',
  description: 'Splash → Get Started 建匿名帳號 → 5-step onboarding → /home',
  nodes: [
    { id: 'splash',       routePath: '/splash',                    title: 'Splash',           description: 'Logo hold 1.2s，CTAs 露出', x: 1, y: 0 },
    { id: 'login',        routePath: '/login',                     title: '登入',             description: '已有帳號路徑',              x: 0, y: 1 },
    { id: 'diet',         routePath: '/onboarding/diet-survey',    title: '飲食習慣 (1/5)',   description: '葷 / 蛋奶素 / 全素 / 蔬食',  x: 2, y: 1 },
    { id: 'baseline',     routePath: '/onboarding/baseline',       title: '肉類基線 (2/5)',   description: '葷食者填，植物者直跳 purpose', x: 2, y: 2 },
    { id: 'purpose',      routePath: '/onboarding/purpose',        title: '挑戰目的 (3/5)',   description: '身體 / 環境 / 動物',         x: 2, y: 3 },
    { id: 'day1',         routePath: '/onboarding/day1-hook',      title: '蛋誕生 (4/5)',     description: '取得守護者蛋',              x: 2, y: 4 },
    { id: 'pet-name',     routePath: '/onboarding/pet-name',       title: '幫蛋取名 (5/5)',   description: '隨機建議 + 改名',           x: 2, y: 5 },
    { id: 'home',         routePath: '/home',                      title: 'Home',             description: '主介面，等待第一次打卡',      x: 2, y: 6 },
  ],
  edges: [
    { from: 'splash',   to: 'login',    trigger: '點「已有帳號 — 登入」' },
    { from: 'splash',   to: 'diet',     trigger: '點 Get Started → registerGuest()' },
    { from: 'diet',     to: 'baseline', trigger: '選擇葷食' },
    { from: 'diet',     to: 'purpose',  trigger: '選擇蛋奶素 / 全素 / 蔬食（跳過 baseline）' },
    { from: 'baseline', to: 'purpose',  trigger: '繼續' },
    { from: 'purpose',  to: 'day1',     trigger: '選擇目的' },
    { from: 'day1',     to: 'pet-name', trigger: '點「進入」' },
    { from: 'pet-name', to: 'home',     trigger: '完成命名' },
  ],
};

export default flow;
```

- [ ] **Step 2: Commit**

---

## Task B4: First-checkin flow data

**Files:**
- Create: `src/flows/first-checkin.ts`

- [ ] **Step 1: Write the flow**

```typescript
// src/flows/first-checkin.ts
import type { Flow } from './_types';

const flow: Flow = {
  id: 'first-checkin',
  name: '首次打卡',
  description: '從 /home 第一次走完打卡 → AHA banner → 選挑戰難度 → 設用餐時間 → 回 /home',
  nodes: [
    { id: 'home',          routePath: '/home',                          title: 'Home',                  description: '點「打卡」',                       x: 1, y: 0 },
    { id: 'capture',       routePath: '/check-in',                      title: '拍照',                   description: '相機 / 上傳圖片',                  x: 1, y: 1 },
    { id: 'scanning',      routePath: '/check-in/scanning',             title: 'AI 辨識',                description: 'Dev picker：🌱 無肉 / 🥩 有肉',      x: 1, y: 2 },
    { id: 'result',        routePath: '/check-in/result',               title: '辨識結果',               description: '無肉 → 直接送出；有肉 → 詢問',       x: 1, y: 3 },
    { id: 'fail',          routePath: '/check-in/fail',                 title: '下一餐加油',             description: '使用者確認有肉，鼓勵下一餐',         x: 0, y: 4 },
    { id: 'success',       routePath: '/check-in/success',              title: 'Success + AHA',         description: '三幕動畫 + 第一次 banner',         x: 2, y: 4 },
    { id: 'challenge',     routePath: '/onboarding/challenge-level',    title: '挑戰難度',               description: '1/1.5/2× 進化速度',                x: 2, y: 5 },
    { id: 'eat-times',     routePath: '/onboarding/eat-times',          title: '用餐時間',               description: '三餐通知時段',                    x: 2, y: 6 },
    { id: 'home-after',    routePath: '/home',                          title: 'Home（已完成設定）',     description: '回主介面，level-bar 即時更新',       x: 2, y: 7 },
  ],
  edges: [
    { from: 'home',      to: 'capture',   trigger: '點「打卡」' },
    { from: 'capture',   to: 'scanning',  trigger: '拍 / 上傳照片' },
    { from: 'scanning',  to: 'result',    trigger: '點 dev picker 卡片' },
    { from: 'result',    to: 'fail',      trigger: '有肉 → 確認「是」' },
    { from: 'result',    to: 'success',   trigger: '無肉 / 替換成植物肉' },
    { from: 'success',   to: 'challenge', trigger: '繼續守護（首次：challenge_level=null）' },
    { from: 'challenge', to: 'eat-times', trigger: '選擇難度（首次：eat_times=null）' },
    { from: 'eat-times', to: 'home-after', trigger: '完成設定' },
  ],
};

export default flow;
```

- [ ] **Step 2: Commit**

---

## Task B5: Cross-flow invariants test

**Files:**
- Test: `src/flows/__tests__/flows.test.ts`

- [ ] **Step 1: Write the test**

```typescript
// src/flows/__tests__/flows.test.ts
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
```

- [ ] **Step 2: Verify all pass + commit**

---

## Task B6: /dev/flows route + register in router

**Files:**
- Create: `src/routes/dev/flows.ts`
- Modify: `src/router.ts` (register route)
- Test: `src/routes/__tests__/dev-flows.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// src/routes/__tests__/dev-flows.test.ts
import { describe, it, expect } from 'vitest';
import devFlows from '../dev/flows';

describe('/dev/flows route', () => {
  it('renders a sidebar listing every flow', () => {
    const el = devFlows();
    const items = el.querySelectorAll('.flow-sidebar [data-flow-id]');
    expect(items.length).toBeGreaterThanOrEqual(2);
    const ids = Array.from(items).map((n) => (n as HTMLElement).dataset.flowId);
    expect(ids).toContain('registration');
    expect(ids).toContain('first-checkin');
  });

  it('initial canvas renders the first flow nodes + edges', () => {
    const el = devFlows();
    const canvas = el.querySelector('.flow-canvas');
    expect(canvas).not.toBeNull();
    // ≥1 node card and ≥1 SVG line.
    expect(canvas!.querySelectorAll('.flow-node').length).toBeGreaterThan(0);
    expect(canvas!.querySelectorAll('svg line').length).toBeGreaterThan(0);
  });

  it('clicking a sidebar item swaps the canvas to that flow', () => {
    const el = devFlows();
    document.body.appendChild(el);
    const second = el.querySelector<HTMLElement>('.flow-sidebar [data-flow-id="first-checkin"]');
    expect(second).not.toBeNull();
    second!.click();
    const title = el.querySelector('.flow-canvas-header h2');
    expect(title?.textContent).toContain('首次打卡');
    el.remove();
  });
});
```

- [ ] **Step 2: Implement the route**

```typescript
// src/routes/dev/flows.ts
/**
 * /dev/flows — Miro-style visualisation of every shipping user flow.
 *
 * Sidebar lists every flow registered in src/flows/. Selecting one
 * replaces the canvas content: nodes are absolute-positioned Cards;
 * arrows are inline-SVG <line>s pulled from edge.from/edge.to centres.
 * Coordinates are logical units multiplied by CELL_W / CELL_H so flow
 * authors can curate layouts without thinking in pixels.
 *
 * Dev-only: surfaced via DevPanel, not via the bottom tab bar.
 */
import { flows } from '@/flows';
import type { Flow } from '@/flows';
import createCard from '@/components/Card';

const CELL_W = 220;
const CELL_H = 140;
const NODE_W = 200;
const NODE_H = 110;
const PADDING = 24;

export default function devFlows(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'flow-viewer';

  if (flows.length === 0) {
    wrap.innerHTML = '<div class="flow-empty">No flows registered. Add one to src/flows/.</div>';
    return wrap;
  }

  // Sidebar.
  const sidebar = document.createElement('aside');
  sidebar.className = 'flow-sidebar';
  const heading = document.createElement('h3');
  heading.textContent = 'Flows';
  sidebar.append(heading);
  for (const f of flows) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'flow-sidebar-item';
    btn.dataset.flowId = f.id;
    btn.textContent = f.name;
    btn.addEventListener('click', () => selectFlow(f.id));
    sidebar.append(btn);
  }

  // Canvas.
  const main = document.createElement('main');
  main.className = 'flow-canvas';

  wrap.append(sidebar, main);

  function selectFlow(id: string): void {
    const flow = flows.find((f) => f.id === id);
    if (!flow) return;
    for (const btn of sidebar.querySelectorAll<HTMLButtonElement>('.flow-sidebar-item')) {
      btn.classList.toggle('selected', btn.dataset.flowId === id);
    }
    main.innerHTML = '';
    main.append(renderFlow(flow));
  }

  selectFlow(flows[0].id);
  return wrap;
}

function renderFlow(flow: Flow): HTMLElement {
  const root = document.createElement('div');
  root.className = 'flow-canvas-inner';

  const header = document.createElement('header');
  header.className = 'flow-canvas-header';
  const h = document.createElement('h2'); h.textContent = flow.name;
  const sub = document.createElement('p'); sub.textContent = flow.description;
  header.append(h, sub);
  root.append(header);

  // Compute board bounds.
  const maxX = Math.max(0, ...flow.nodes.map((n) => n.x));
  const maxY = Math.max(0, ...flow.nodes.map((n) => n.y));
  const boardW = PADDING * 2 + (maxX + 1) * CELL_W;
  const boardH = PADDING * 2 + (maxY + 1) * CELL_H;

  const board = document.createElement('div');
  board.className = 'flow-board';
  board.style.width = `${boardW}px`;
  board.style.height = `${boardH}px`;

  // SVG underlay for edges. Goes first so nodes sit on top.
  const svgNs = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNs, 'svg');
  svg.classList.add('flow-edges');
  svg.setAttribute('width', String(boardW));
  svg.setAttribute('height', String(boardH));

  // Single arrowhead marker, shared by every edge.
  const defs = document.createElementNS(svgNs, 'defs');
  const marker = document.createElementNS(svgNs, 'marker');
  marker.setAttribute('id', 'flow-arrow');
  marker.setAttribute('viewBox', '0 0 10 10');
  marker.setAttribute('refX', '8');
  marker.setAttribute('refY', '5');
  marker.setAttribute('markerWidth', '8');
  marker.setAttribute('markerHeight', '8');
  marker.setAttribute('orient', 'auto-start-reverse');
  const arrow = document.createElementNS(svgNs, 'path');
  arrow.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
  arrow.setAttribute('fill', '#5b6770');
  marker.append(arrow);
  defs.append(marker);
  svg.append(defs);

  const nodeById = new Map(flow.nodes.map((n) => [n.id, n]));
  for (const e of flow.edges) {
    const from = nodeById.get(e.from);
    const to = nodeById.get(e.to);
    if (!from || !to) continue;
    const fx = PADDING + from.x * CELL_W + NODE_W / 2;
    const fy = PADDING + from.y * CELL_H + NODE_H;
    const tx = PADDING + to.x * CELL_W + NODE_W / 2;
    const ty = PADDING + to.y * CELL_H;
    const line = document.createElementNS(svgNs, 'line');
    line.setAttribute('x1', String(fx));
    line.setAttribute('y1', String(fy));
    line.setAttribute('x2', String(tx));
    line.setAttribute('y2', String(ty));
    line.setAttribute('stroke', '#5b6770');
    line.setAttribute('stroke-width', '1.5');
    line.setAttribute('marker-end', 'url(#flow-arrow)');
    svg.append(line);
    // Trigger label at midpoint.
    const label = document.createElementNS(svgNs, 'text');
    label.setAttribute('x', String((fx + tx) / 2));
    label.setAttribute('y', String((fy + ty) / 2 - 4));
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('class', 'flow-edge-label');
    label.textContent = e.trigger;
    svg.append(label);
  }

  board.append(svg);

  // Node cards.
  for (const n of flow.nodes) {
    const x = PADDING + n.x * CELL_W;
    const y = PADDING + n.y * CELL_H;
    const content = document.createElement('div');
    content.className = 'flow-node-content';
    const title = document.createElement('strong'); title.textContent = n.title;
    const route = document.createElement('code'); route.textContent = n.routePath;
    content.append(title, route);
    if (n.description) {
      const desc = document.createElement('p'); desc.textContent = n.description;
      content.append(desc);
    }
    const card = createCard({ children: content, variant: 'raised' });
    card.classList.add('flow-node');
    card.dataset.nodeId = n.id;
    card.style.position = 'absolute';
    card.style.left = `${x}px`;
    card.style.top = `${y}px`;
    card.style.width = `${NODE_W}px`;
    card.style.height = `${NODE_H}px`;
    board.append(card);
  }

  root.append(board);
  return root;
}
```

- [ ] **Step 3: Register in `src/router.ts`** — add `'/dev/flows': () => import('@/routes/dev/flows').then((m) => m.default())` (or matching syntax to whatever the router does).

- [ ] **Step 4: Verify the test passes**

- [ ] **Step 5: Commit**

---

## Task B7: Surface link via DevPanel

**Files:**
- Modify: `src/components/DevPanel.ts`

- [ ] **Step 1: Add a row "/dev/flows — Flow viewer" inside the existing dev panel's link list. Keep style consistent with siblings.**

- [ ] **Step 2: Commit**

---

## Task B8: CSS for the flow viewer

**Files:**
- Modify: `src/styles/globals.css`

- [ ] **Step 1: Append .flow-viewer block**

```css
/* Flow viewer (/dev/flows). */
.flow-viewer {
  display: flex; height: calc(100vh - 80px);
  font-family: var(--font-sans);
}
.flow-sidebar {
  width: 220px; flex-shrink: 0;
  padding: var(--space-4);
  background: var(--color-neutral-light);
  display: flex; flex-direction: column; gap: var(--space-2);
  overflow-y: auto;
}
.flow-sidebar h3 { margin: 0 0 var(--space-2); color: var(--color-primary-dark); }
.flow-sidebar-item {
  background: transparent; border: 0; padding: var(--space-2) var(--space-3);
  text-align: left; border-radius: 8px; cursor: pointer;
  color: var(--color-foreground); font-weight: var(--font-weight-medium);
}
.flow-sidebar-item:hover { background: var(--color-neutral-light-active); }
.flow-sidebar-item.selected { background: var(--color-primary); color: #fff; }

.flow-canvas { flex: 1; overflow: auto; }
.flow-canvas-inner { padding: var(--space-4); display: flex; flex-direction: column; gap: var(--space-3); }
.flow-canvas-header h2 { margin: 0; color: var(--color-primary-dark); }
.flow-canvas-header p  { margin: 0; color: var(--color-foreground-alt); font-size: var(--text-mini-size); }

.flow-board { position: relative; }
.flow-edges { position: absolute; inset: 0; pointer-events: none; }
.flow-edge-label { font-size: 11px; fill: #5b6770; font-family: var(--font-sans); }

.flow-node {
  cursor: default;
  font-size: var(--text-caption-size);
}
.flow-node-content { display: flex; flex-direction: column; gap: 2px; }
.flow-node-content strong { color: var(--color-primary-dark); font-size: var(--text-mini-size); }
.flow-node-content code  { color: var(--color-neutral-darker); font-size: 10px; font-family: ui-monospace, SFMono-Regular, monospace; }
.flow-node-content p     { margin: 0; font-size: 11px; color: var(--color-foreground-alt); line-height: 1.4; }

.flow-empty { padding: var(--space-5); color: var(--color-neutral-darker); }
```

- [ ] **Step 2: Commit**

---

## Acceptance checklist

- [ ] `src/flows/_types.ts` exports Flow / FlowNode / FlowEdge.
- [ ] `src/flows/index.ts` auto-indexes flow files; exposes `flows`, `getFlow`.
- [ ] `registration.ts` + `first-checkin.ts` ship with curated coords + edges.
- [ ] Cross-flow invariants test passes (every edge references valid nodes, ≥1 root, unique ids).
- [ ] `/dev/flows` route renders sidebar + canvas + Card nodes + SVG arrows.
- [ ] Route is registered in `src/router.ts` and reachable via DevPanel.
- [ ] All previous tests still pass.
- [ ] `npm run build` succeeds.
