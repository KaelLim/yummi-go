import { describe, it, expect } from 'vitest';
import { createTabBar } from '../TabBar';

describe('TabBar', () => {
  it('renders a .tabbar element with 5 .tab buttons', () => {
    const bar = createTabBar();
    expect(bar.classList.contains('tabbar')).toBe(true);
    const tabs = bar.querySelectorAll('button.tab');
    expect(tabs.length).toBe(5);
  });

  it('marks the center check-in tab', () => {
    const bar = createTabBar();
    const center = bar.querySelector('button.tab.center');
    expect(center).not.toBeNull();
    expect(center!.textContent).toContain('打卡');
  });
});
