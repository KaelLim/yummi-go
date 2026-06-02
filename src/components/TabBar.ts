/**
 * Bottom tab bar (5 tabs, center-elevated check-in).
 *
 * Subscribes to $route so the active tab visually highlights when the path
 * starts with the tab's href. Subscription auto-cleans up via lifecycle.bind
 * so navigating doesn't leak listeners against detached bar instances.
 */
import { $route, navigate } from '@/router';
import { bind } from '@/lib/lifecycle';
import { $locale, t } from '@/lib/i18n';

interface Tab {
  key: string;
  href: string;
  icon: string;
  /** i18n key for the label. Resolved at render time so locale toggles
   *  repaint the bar without re-instantiating it. */
  labelKey: string;
  center?: boolean;
}

const TABS: Tab[] = [
  { key: 'home',     href: '/home',             icon: 'home',           labelKey: 'tab.home' },
  { key: 'map',      href: '/map',              icon: 'map',            labelKey: 'tab.map' },
  { key: 'check-in', href: '/check-in',         icon: 'photo_camera',   labelKey: 'tab.checkin', center: true },
  { key: 'store',    href: '/store',            icon: 'diamond',        labelKey: 'tab.store' },
  { key: 'calendar', href: '/profile/calendar', icon: 'calendar_month', labelKey: 'tab.journey' },
];

export function createTabBar(): HTMLElement {
  const bar = document.createElement('div');
  bar.className = 'tabbar';

  function render() {
    const cur = $route.get().path;
    bar.innerHTML = '';
    for (const tab of TABS) {
      const item = document.createElement('button');
      const active = cur.startsWith(tab.href);
      item.className =
        'tab' + (active ? ' active' : '') + (tab.center ? ' center' : '');
      item.innerHTML =
        `<span class="ms" aria-hidden="true">${tab.icon}</span>` +
        `<span class="tab-label">${t(tab.labelKey)}</span>`;
      item.addEventListener('click', () => navigate(tab.href));
      bar.appendChild(item);
    }
  }

  bind(bar, $route, render);
  bind(bar, $locale, render);
  return bar;
}
