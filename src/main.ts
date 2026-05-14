/**
 * App entry — wire styles, route table, layout shell, and boot sequence.
 *
 * Every route is registered through wrap() so the loader output is composed
 * inside createLayout — that way the tab bar / chrome stays mounted across
 * navigations, with screens swapping inside <main>.
 */
import './styles/tokens.css';
import './styles/globals.css';
import { defRoute, startRouter } from './router';
import { createLayout } from './components/Layout';
import { setupInstallPrompt } from './components/InstallPrompt';
import { bootstrapFromStorage } from './store/user';
import { $ui } from './store/ui';
import { setupDaySync } from './store/day-sync';
import { setupMealNotifier } from './lib/meal-notifier';

// Reflect the active theme onto <html data-theme="..."> so CSS can pivot
// the colour tokens. Subscribed once at boot — the atom's initial-value
// fire takes care of the first paint.
$ui.subscribe((s) => {
  document.documentElement.dataset.theme = s.theme;
});

type RouteLoader = () => Promise<{
  default: (params: Record<string, string>) => HTMLElement | Promise<HTMLElement>;
}>;

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
defRoute('/onboarding/diet-survey', wrap(() => import('./routes/onboarding/diet-survey')));
defRoute('/onboarding/baseline', wrap(() => import('./routes/onboarding/baseline')));
defRoute('/onboarding/purpose', wrap(() => import('./routes/onboarding/purpose')));
defRoute('/onboarding/challenge-level', wrap(() => import('./routes/onboarding/challenge-level')));
defRoute('/onboarding/eat-times', wrap(() => import('./routes/onboarding/eat-times')));
defRoute('/onboarding/day1-hook', wrap(() => import('./routes/onboarding/day1-hook')));
defRoute('/onboarding/pet-name', wrap(() => import('./routes/onboarding/pet-name')));
defRoute('/home', wrap(() => import('./routes/home')));
defRoute('/map', wrap(() => import('./routes/map')));
defRoute('/map/restaurant/:id', wrap(() => import('./routes/restaurant-detail')));
defRoute('/map/restaurant/:id/review', wrap(() => import('./routes/restaurant-review')));
defRoute('/check-in', wrap(() => import('./routes/check-in/capture')));
defRoute('/check-in/scanning', wrap(() => import('./routes/check-in/scanning')));
defRoute('/check-in/result', wrap(() => import('./routes/check-in/result')));
defRoute('/check-in/fail', wrap(() => import('./routes/check-in/fail')));
defRoute('/check-in/success', wrap(() => import('./routes/check-in/success')));
defRoute('/tasks', wrap(() => import('./routes/tasks/index')));
defRoute('/tasks/quiz', wrap(() => import('./routes/tasks/quiz')));
defRoute('/tasks/makeup', wrap(() => import('./routes/tasks/makeup')));
defRoute('/tasks/known-from', wrap(() => import('./routes/tasks/known-from')));
defRoute('/profile', wrap(() => import('./routes/profile/index')));
defRoute('/profile/settings', wrap(() => import('./routes/profile/settings')));
defRoute('/profile/reviews', wrap(() => import('./routes/profile/reviews')));
defRoute('/profile/baseline', wrap(() => import('./routes/profile/baseline')));
defRoute('/challenge/day-30', wrap(() => import('./routes/day-30')));
// Dev tools render their own full-viewport chrome — bypass the app layout.
defRoute('/dev/flows', () => import('./routes/dev/flows'));

async function boot() {
  await bootstrapFromStorage();
  setupDaySync();
  setupInstallPrompt();
  setupMealNotifier();          // NEW
  startRouter();
}
void boot();
