/**
 * App layout shell — wraps a screen element in <main> + bottom <TabBar>.
 *
 * Auth/onboarding routes hide the tab bar by checking the current path
 * against HIDE_TAB_PATHS. The shell subscribes to $route so chrome refreshes
 * on every navigation without remounting the layout. Subscriptions
 * auto-cleanup via lifecycle.bind so a fast nav-thrash doesn't accumulate
 * stale listeners.
 *
 * When ?dev is in the URL ($ui.devMode), a floating DevPanel is mounted
 * alongside the layout for quick time-mode / theme / route jumps.
 */
import { $route } from '@/router';
import { $ui } from '@/store/ui';
import { bind } from '@/lib/lifecycle';
import { createTabBar } from './TabBar';
import { createDevPanel } from './DevPanel';

const HIDE_TAB_PATHS = ['/login', '/register', '/onboarding'];

export function createLayout(child: HTMLElement): HTMLElement {
  const layout = document.createElement('div');
  layout.className = 'app-layout';

  const main = document.createElement('main');
  main.className = 'app-main';
  main.appendChild(child);

  const tabBar = createTabBar();

  layout.appendChild(main);
  layout.appendChild(tabBar);

  if ($ui.get().devMode) {
    layout.appendChild(createDevPanel());
  }

  bind(layout, $route, () => {
    const path = $route.get().path;
    const hide = path === '/' || HIDE_TAB_PATHS.some((p) => path.startsWith(p));
    tabBar.style.display = hide ? 'none' : '';
  });

  return layout;
}
