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
