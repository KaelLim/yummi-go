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
import { $route, navigate } from '@/router';
import { $ui } from '@/store/ui';
import { bind } from '@/lib/lifecycle';
import { createTabBar } from './TabBar';
import { createDevPanel } from './DevPanel';
import { $locale, t } from '@/lib/i18n';

const HIDE_TAB_PATHS = ['/login', '/register', '/onboarding'];
/**
 * Routes where the floating top-right 我的 shortcut shows. Limited to the
 * main tab pages so it doesn't collide with deep-page headers (e.g. the
 * detail page's 🚩 flag in the same screen corner).
 */
const PROFILE_FAB_PATHS = ['/home', '/map', '/store', '/profile/calendar'];

export function createLayout(child: HTMLElement): HTMLElement {
  const layout = document.createElement('div');
  layout.className = 'app-layout';

  const main = document.createElement('main');
  main.className = 'app-main';
  main.appendChild(child);

  const tabBar = createTabBar();

  // Floating top-right 我的 button. Lives on the layout (not on each
  // route) so a single click handler reaches /profile from every main
  // tab. Mounted unconditionally; the route binding below toggles
  // display.
  const profileFab = document.createElement('button');
  profileFab.className = 'profile-fab';
  profileFab.innerHTML = '<span class="ms">person</span>';
  profileFab.addEventListener('click', () => navigate('/profile'));
  // i18n: aria-label + tooltip repaint on locale toggle.
  bind(profileFab, $locale, () => {
    profileFab.setAttribute('aria-label', t('fab.profile'));
    profileFab.setAttribute('title', t('fab.profile'));
  });

  layout.appendChild(main);
  layout.appendChild(profileFab);
  layout.appendChild(tabBar);

  if ($ui.get().devMode) {
    layout.appendChild(createDevPanel());
  }

  bind(layout, $route, () => {
    const path = $route.get().path;
    const hideChrome = path === '/' || HIDE_TAB_PATHS.some((p) => path.startsWith(p));
    tabBar.style.display = hideChrome ? 'none' : '';
    const onMainTab =
      !hideChrome &&
      PROFILE_FAB_PATHS.some((p) => path === p || path.startsWith(p + '/'));
    profileFab.style.display = onMainTab ? '' : 'none';
  });

  return layout;
}
