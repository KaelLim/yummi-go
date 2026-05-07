/**
 * Splash screen — animated logo + auto-redirect.
 *
 * Bootstraps the user session from localStorage, then redirects:
 *   - to /home if a session was restored
 *   - to /login otherwise
 *
 * A 1.2s minimum hold ensures the splash is visible even on a fast restore.
 */
import { bootstrapFromStorage } from '@/store/user';
import { navigate } from '@/router';

export default async function splash(): Promise<HTMLElement> {
  const wrap = document.createElement('div');
  wrap.className = 'splash';
  wrap.innerHTML = `
    <div class="splash-logo">
      <div class="splash-logo-mark">🌿</div>
      <div class="splash-title">Yummi Go</div>
      <div class="splash-tagline">吃出更好的自己 · 養好你的寵物</div>
    </div>
    <div class="splash-loader">
      <div class="dot"></div><div class="dot"></div><div class="dot"></div>
    </div>
  `;

  // Bootstrap session, then redirect after a 1.2s minimum (so users see the splash).
  const startedAt = Date.now();
  const restored = await bootstrapFromStorage();
  const elapsed = Date.now() - startedAt;
  await new Promise((r) => setTimeout(r, Math.max(0, 1200 - elapsed)));
  navigate(restored ? '/home' : '/login');

  return wrap;
}
