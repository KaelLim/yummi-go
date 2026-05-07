/**
 * Minimal hash-based SPA router.
 *
 * Routes register a regex-compiled pattern (e.g. `/map/restaurant/:id`) and a
 * lazy loader that returns a module whose default export creates the screen
 * element. resolve() finds the first matching pattern, awaits the loader, and
 * mounts the returned element into #app.
 *
 * navigate() updates location.hash to trigger hashchange; if the target hash
 * already matches, we resolve manually since hashchange won't fire.
 */
import { atom } from 'nanostores';

export interface Route {
  path: string;
  params: Record<string, string>;
}

export const $route = atom<Route>({ path: '/', params: {} });

interface RouteDefinition {
  pattern: RegExp;
  loader: () => Promise<{
    default: (params: Record<string, string>) => HTMLElement | Promise<HTMLElement>;
  }>;
  paramNames: string[];
}

const routes: RouteDefinition[] = [];

export function defRoute(pattern: string, loader: RouteDefinition['loader']): void {
  const paramNames: string[] = [];
  const regexStr =
    '^' +
    pattern.replace(/:([a-zA-Z_]+)/g, (_, name) => {
      paramNames.push(name);
      return '([^/]+)';
    }) +
    '$';
  routes.push({ pattern: new RegExp(regexStr), loader, paramNames });
}

export function navigate(path: string): void {
  if (!path.startsWith('/')) path = '/' + path;
  if (location.hash !== '#' + path) {
    location.hash = '#' + path;
  } else {
    void resolve();
  }
}

async function resolve(): Promise<void> {
  const path = location.hash.slice(1) || '/';
  for (const r of routes) {
    const m = path.match(r.pattern);
    if (m) {
      const params: Record<string, string> = {};
      r.paramNames.forEach((n, i) => {
        params[n] = decodeURIComponent(m[i + 1] ?? '');
      });
      $route.set({ path, params });
      try {
        const mod = await r.loader();
        const root = document.getElementById('app');
        if (!root) return;
        root.innerHTML = '';
        const node = await mod.default(params);
        root.appendChild(node);
      } catch (err) {
        console.error('Route load failed:', err);
      }
      return;
    }
  }
  console.warn('Route not found:', path);
}

export function startRouter(): void {
  window.addEventListener('hashchange', () => {
    void resolve();
  });
  void resolve();
}

/** Test-only: clear all registered routes. */
export function _resetRoutes(): void {
  routes.length = 0;
}
