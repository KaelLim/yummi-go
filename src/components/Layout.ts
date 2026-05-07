/**
 * App layout shell — wraps a screen element in <main> + bottom <TabBar>.
 *
 * Auth/onboarding routes hide the tab bar by checking the current path
 * against HIDE_TAB_PATHS. The shell subscribes to $route so chrome refreshes
 * on every navigation without remounting the layout.
 */
import { $route } from '@/router';
import { createTabBar } from './TabBar';

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

  function refreshChrome() {
    const path = $route.get().path;
    // Hide on splash (exact '/') and any auth/onboarding subtree.
    const hide = path === '/' || HIDE_TAB_PATHS.some((p) => path.startsWith(p));
    tabBar.style.display = hide ? 'none' : '';
  }
  refreshChrome();
  $route.subscribe(refreshChrome);

  return layout;
}
