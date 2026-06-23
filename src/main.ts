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
import { installMilestoneRouter } from './lib/milestone-popup';

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
defRoute('/onboarding/eat-times', wrap(() => import('./routes/onboarding/eat-times')));
defRoute('/onboarding/day1-hook', wrap(() => import('./routes/onboarding/day1-hook')));
defRoute('/onboarding/pet-name', wrap(() => import('./routes/onboarding/pet-name')));
defRoute('/onboarding/start-checkin', wrap(() => import('./routes/onboarding/start-checkin')));
defRoute('/home', wrap(() => import('./routes/home')));
defRoute('/map', wrap(() => import('./routes/map')));
defRoute('/map/restaurant/:id', wrap(() => import('./routes/restaurant-detail')));
defRoute('/map/restaurant/:id/review', wrap(() => import('./routes/restaurant-review')));
defRoute('/map/restaurant/:id/verify', wrap(() => import('./routes/restaurant-verify')));
defRoute('/check-in', wrap(() => import('./routes/check-in/capture')));
defRoute('/check-in/scanning', wrap(() => import('./routes/check-in/scanning')));
defRoute('/check-in/result', wrap(() => import('./routes/check-in/result')));
defRoute('/check-in/fail', wrap(() => import('./routes/check-in/fail')));
defRoute('/check-in/success', wrap(() => import('./routes/check-in/success')));
defRoute('/store', wrap(() => import('./routes/store')));
defRoute('/store/banner/:id', wrap(() => import('./routes/store-banner-detail')));
// /tasks index page removed in the 2026-05-19 pivot — missions now live on
// home. /tasks/makeup is also gone: its card-swap model was replaced by the
// direct-Gem makeup flow inside /profile/calendar. The remaining leaf
// routes below still resolve so deep links keep working; each one returns
// to /home (not /tasks) after completion.
defRoute('/tasks/quiz', wrap(() => import('./routes/tasks/quiz')));
defRoute('/tasks/known-from', wrap(() => import('./routes/tasks/known-from')));
defRoute('/profile', wrap(() => import('./routes/profile/index')));
defRoute('/profile/settings', wrap(() => import('./routes/profile/settings')));
defRoute('/profile/reviews', wrap(() => import('./routes/profile/reviews')));
defRoute('/profile/baseline', wrap(() => import('./routes/profile/baseline')));
defRoute('/profile/calendar', wrap(() => import('./routes/profile/calendar')));
defRoute('/profile/pet-collection', wrap(() => import('./routes/profile/pet-collection')));
defRoute('/challenge/day-30', wrap(() => import('./routes/day-30')));
// Dev tools render their own full-viewport chrome — bypass the app layout.
defRoute('/dev/flows', () => import('./routes/dev/flows'));

async function boot() {
  await bootstrapFromStorage();
  setupDaySync();
  setupInstallPrompt();
  setupMealNotifier();          // NEW
  // Font-size global toggle — class on <html> so the CSS variables in
  // tokens.css can bump up under .font-scale-large. Subscribed once
  // here so every route picks up the change without re-mounting.
  const applyFontScale = (scale: string) => {
    document.documentElement.classList.toggle('font-scale-large', scale === 'large');
  };
  applyFontScale($ui.get().fontScale);
  $ui.subscribe((u) => applyFontScale(u.fontScale));
  // Subscribe to route changes BEFORE startRouter() so the very first
  // resolve doesn't count as a transition — the milestone handler skips
  // its first emission for exactly that reason.
  installMilestoneRouter();
  startRouter();
}
void boot();
