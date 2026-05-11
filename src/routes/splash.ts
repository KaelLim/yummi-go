/**
 * Splash screen — animated logo + auto-redirect.
 *
 * The element is returned synchronously so the loader animation is visible
 * immediately. After a 1.2s hold, redirects:
 *   - to /home if $user is hydrated (bootstrap already ran in main.ts boot)
 *   - to /onboarding/diet-survey otherwise (new users go through the full
 *     setup before being asked to create an account; returning users hit
 *     /login via the link on the diet-survey + register screens)
 */
import { $isLoggedIn } from '@/store/user';
import { navigate } from '@/router';

export default function splash(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'splash';
  wrap.innerHTML = `
    <div class="splash-logo">
      <div class="splash-logo-mark">🌿</div>
      <div class="splash-title text-title is-latin">Yummi Go</div>
      <div class="splash-tagline">吃出更好的自己 · 養好你的寵物</div>
    </div>
    <div class="splash-loader">
      <div class="dot"></div><div class="dot"></div><div class="dot"></div>
    </div>
  `;

  setTimeout(() => {
    navigate($isLoggedIn.get() ? '/home' : '/onboarding/diet-survey');
  }, 1200);

  return wrap;
}
