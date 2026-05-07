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
defRoute('/onboarding/baseline', wrap(stub('Baseline')));
defRoute('/onboarding/challenge-level', wrap(stub('Challenge Level')));
defRoute('/onboarding/eat-times', wrap(stub('Eat Times')));
defRoute('/onboarding/day1-hook', wrap(stub('Day 1 Hook')));
defRoute('/home', wrap(stub('Home')));
defRoute('/map', wrap(stub('Map')));
defRoute('/map/restaurant/:id', wrap(stub('Restaurant detail')));
defRoute('/map/restaurant/:id/review', wrap(stub('Review')));
defRoute('/check-in', wrap(stub('Check-in')));
defRoute('/check-in/scanning', wrap(stub('Scanning')));
defRoute('/check-in/result', wrap(stub('Result')));
defRoute('/check-in/success', wrap(stub('Success')));
defRoute('/tasks', wrap(stub('Tasks')));
defRoute('/tasks/quiz', wrap(stub('Quiz')));
defRoute('/tasks/makeup', wrap(stub('Makeup')));
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
