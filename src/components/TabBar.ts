/**
 * Bottom tab bar (5 tabs, center-elevated check-in).
 *
 * Subscribes to $route so the active tab visually highlights when the path
 * starts with the tab's href. Each click navigates via the router.
 */
import { $route, navigate } from '@/router';

interface Tab {
  key: string;
  href: string;
  icon: string;
  label: string;
  center?: boolean;
}

const TABS: Tab[] = [
  { key: 'home', href: '/home', icon: 'home', label: '首頁' },
  { key: 'map', href: '/map', icon: 'map', label: '地圖' },
  { key: 'check-in', href: '/check-in', icon: 'photo_camera', label: '打卡', center: true },
  { key: 'tasks', href: '/tasks', icon: 'task_alt', label: '任務' },
  { key: 'profile', href: '/profile', icon: 'person', label: '我的' },
];

export function createTabBar(): HTMLElement {
  const bar = document.createElement('div');
  bar.className = 'tabbar';

  function render() {
    const cur = $route.get().path;
    bar.innerHTML = '';
    for (const t of TABS) {
      const item = document.createElement('button');
      const active = cur.startsWith(t.href);
      item.className =
        'tab' + (active ? ' active' : '') + (t.center ? ' center' : '');
      item.innerHTML =
        `<span class="ms" aria-hidden="true">${t.icon}</span>` +
        `<span class="tab-label">${t.label}</span>`;
      item.addEventListener('click', () => navigate(t.href));
      bar.appendChild(item);
    }
  }

  render();
  $route.subscribe(() => render());
  return bar;
}
