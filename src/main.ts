/**
 * App entry — wire styles, route table, layout shell, and boot sequence.
 *
 * Every route is registered through wrap() so the loader output is composed
 * inside createLayout — that way the tab bar / chrome stays mounted across
 * navigations, with screens swapping inside <main>.
 *
 * Phases 6–12 will replace each `stub()` with a real screen module.
 */
import './styles/tokens.css';
import './styles/globals.css';
import { defRoute, startRouter } from './router';
import { createLayout } from './components/Layout';
import { bootstrapFromStorage } from './store/user';

type RouteLoader = () => Promise<{
  default: (params: Record<string, string>) => HTMLElement | Promise<HTMLElement>;
}>;

/** Stub-screen factory used until each phase fills in its real route. */
function stub(title: string): RouteLoader {
  return () =>
    Promise.resolve({
      default: () => {
        const el = document.createElement('div');
        el.style.padding = '24px';
        el.innerHTML = `<h1>${title}</h1><p>This route is a stub. Phases 6-12 will implement it.</p>`;
        return el;
      },
    });
}

/** Compose a route loader so its output is wrapped in createLayout(). */
function wrap(loader: RouteLoader): RouteLoader {
  return async () => ({
    default: async (params: Record<string, string>) => {
      const mod = await loader();
      const inner = await mod.default(params);
      return createLayout(inner);
    },
  });
}

defRoute('/', () => import('./routes/splash'));
defRoute('/login', wrap(() => import('./routes/login')));
defRoute('/register', wrap(() => import('./routes/register')));
defRoute('/onboarding/oath', wrap(() => import('./routes/onboarding/oath')));
defRoute('/onboarding/diet-survey', wrap(() => import('./routes/onboarding/diet-survey')));
defRoute('/onboarding/baseline', wrap(() => import('./routes/onboarding/baseline')));
defRoute('/onboarding/challenge-level', wrap(() => import('./routes/onboarding/challenge-level')));
defRoute('/onboarding/eat-times', wrap(() => import('./routes/onboarding/eat-times')));
defRoute('/onboarding/day1-hook', wrap(() => import('./routes/onboarding/day1-hook')));
defRoute('/home', wrap(() => import('./routes/home')));
defRoute('/map', wrap(() => import('./routes/map')));
defRoute('/map/restaurant/:id', wrap(() => import('./routes/restaurant-detail')));
defRoute('/map/restaurant/:id/review', wrap(() => import('./routes/restaurant-review')));
defRoute('/check-in', wrap(() => import('./routes/check-in/capture')));
defRoute('/check-in/scanning', wrap(() => import('./routes/check-in/scanning')));
defRoute('/check-in/result', wrap(() => import('./routes/check-in/result')));
defRoute('/check-in/success', wrap(() => import('./routes/check-in/success')));
defRoute('/tasks', wrap(() => import('./routes/tasks/index')));
defRoute('/tasks/quiz', wrap(() => import('./routes/tasks/quiz')));
defRoute('/tasks/makeup', wrap(() => import('./routes/tasks/makeup')));
defRoute('/profile', wrap(stub('Profile')));
defRoute('/profile/settings', wrap(stub('Settings')));
defRoute('/profile/reviews', wrap(stub('My Reviews')));
defRoute('/profile/baseline', wrap(stub('Baseline Editor')));
defRoute('/challenge/day-30', wrap(stub('Day 30 Finale')));

async function boot() {
  await bootstrapFromStorage();
  startRouter();
}
void boot();
