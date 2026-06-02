import { describe, it, expect, beforeEach } from 'vitest';
import { createTabBar } from '../TabBar';
import { $locale } from '@/lib/i18n';

describe('TabBar', () => {
  // Pin locale to zh — the prototype's source language. Tests that
  // care about copy assert against zh strings; locale-aware behaviour
  // is exercised in lib/i18n's own tests.
  beforeEach(() => $locale.set('zh'));

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
