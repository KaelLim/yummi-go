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
import { navigate } from '@/router';

const CELL_W = 260;
const CELL_H = 180;
const NODE_W = 220;
const NODE_H = 120;
const PADDING = 24;
const SVG_NS = 'http://www.w3.org/2000/svg';
/** Where the label sits along an edge (0 = at source, 1 = at target). */
const LABEL_T = 0.4;

export default function devFlows(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'flow-viewer';

  if (flows.length === 0) {
    wrap.innerHTML = '<div class="flow-empty">No flows registered. Add one to src/flows/.</div>';
    return wrap;
  }

  const sidebar = document.createElement('aside');
  sidebar.className = 'flow-sidebar';

  // Header: back button + title. Since /dev/flows bypasses the app layout
  // there's no TabBar to navigate away from — supply our own exit.
  const head = document.createElement('div');
  head.className = 'flow-sidebar-head';
  const backBtn = document.createElement('button');
  backBtn.type = 'button';
  backBtn.className = 'flow-back-btn';
  backBtn.id = 'flow-back';
  backBtn.setAttribute('aria-label', '返回');
  backBtn.innerHTML = '<span class="ms">arrow_back</span>';
  backBtn.addEventListener('click', () => {
    if (history.length > 1) history.back();
    else navigate('/home');
  });
  const heading = document.createElement('h3');
  heading.textContent = 'Flows';
  head.append(backBtn, heading);
  sidebar.append(head);

  for (const f of flows) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'flow-sidebar-item';
    btn.dataset.flowId = f.id;
    btn.textContent = f.name;
    btn.addEventListener('click', () => selectFlow(f.id));
    sidebar.append(btn);
  }

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

  const maxX = Math.max(0, ...flow.nodes.map((n) => n.x));
  const maxY = Math.max(0, ...flow.nodes.map((n) => n.y));
  const boardW = PADDING * 2 + (maxX + 1) * CELL_W;
  const boardH = PADDING * 2 + (maxY + 1) * CELL_H;

  const board = document.createElement('div');
  board.className = 'flow-board';
  board.style.width = `${boardW}px`;
  board.style.height = `${boardH}px`;

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.classList.add('flow-edges');
  svg.setAttribute('width', String(boardW));
  svg.setAttribute('height', String(boardH));

  const defs = document.createElementNS(SVG_NS, 'defs');
  const marker = document.createElementNS(SVG_NS, 'marker');
  marker.setAttribute('id', 'flow-arrow');
  marker.setAttribute('viewBox', '0 0 10 10');
  marker.setAttribute('refX', '8');
  marker.setAttribute('refY', '5');
  marker.setAttribute('markerWidth', '8');
  marker.setAttribute('markerHeight', '8');
  marker.setAttribute('orient', 'auto-start-reverse');
  const arrow = document.createElementNS(SVG_NS, 'path');
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
    const line = document.createElementNS(SVG_NS, 'line');
    line.setAttribute('x1', String(fx));
    line.setAttribute('y1', String(fy));
    line.setAttribute('x2', String(tx));
    line.setAttribute('y2', String(ty));
    line.setAttribute('stroke', '#5b6770');
    line.setAttribute('stroke-width', '1.5');
    line.setAttribute('marker-end', 'url(#flow-arrow)');
    svg.append(line);

    // Label sits at LABEL_T along the edge (closer to source than midpoint)
    // so it stays away from the target node's top edge.
    const lx = fx + (tx - fx) * LABEL_T;
    const ly = fy + (ty - fy) * LABEL_T - 4;
    const label = document.createElementNS(SVG_NS, 'text');
    label.setAttribute('x', String(lx));
    label.setAttribute('y', String(ly));
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('class', 'flow-edge-label');
    label.textContent = e.trigger;
    svg.append(label);
  }

  board.append(svg);

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
