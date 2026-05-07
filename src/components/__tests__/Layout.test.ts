import { describe, it, expect, beforeEach } from 'vitest';
import { createLayout } from '../Layout';
import { $route } from '@/router';

describe('Layout', () => {
  beforeEach(() => {
    $route.set({ path: '/home', params: {} });
  });

  it('wraps child in .app-main and appends a .tabbar', () => {
    const child = document.createElement('div');
    child.id = 'test-child';
    const layout = createLayout(child);
    expect(layout.classList.contains('app-layout')).toBe(true);
    expect(layout.querySelector('.app-main #test-child')).toBe(child);
    expect(layout.querySelector('.tabbar')).not.toBeNull();
  });

  it('hides tab bar on /login', () => {
    $route.set({ path: '/login', params: {} });
    const layout = createLayout(document.createElement('div'));
    const bar = layout.querySelector('.tabbar') as HTMLElement;
    expect(bar.style.display).toBe('none');
  });

  it('shows tab bar on /home', () => {
    $route.set({ path: '/home', params: {} });
    const layout = createLayout(document.createElement('div'));
    const bar = layout.querySelector('.tabbar') as HTMLElement;
    expect(bar.style.display).toBe('');
  });

  it('hides tab bar on / (splash)', () => {
    $route.set({ path: '/', params: {} });
    const layout = createLayout(document.createElement('div'));
    const bar = layout.querySelector('.tabbar') as HTMLElement;
    expect(bar.style.display).toBe('none');
  });
});
