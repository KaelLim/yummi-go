/**
 * Splash / landing screen.
 *
 * Logged-in users: 1.2s logo hold → /home (returning-user fast path).
 * Guests: after the same hold, the loader dots swap for two CTAs:
 *   - Get Started → /onboarding/diet-survey (new user)
 *   - 已有帳號 / Login → /login (returning user)
 * The CTA reveal is the same visual that used to auto-route into
 * onboarding — guests now choose explicitly instead of being shoved in.
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
    <div class="splash-loader" id="splash-loader">
      <div class="dot"></div><div class="dot"></div><div class="dot"></div>
    </div>
    <div class="splash-actions" id="splash-actions" hidden>
      <button class="btn text-btn-m btn-primary btn-l text-btn-l" id="get-started">
        Get Started
      </button>
      <button class="btn text-btn-m btn-secondary btn-l text-btn-l" id="goto-login">
        已有帳號 — 登入
      </button>
    </div>
  `;

  setTimeout(() => {
    if ($isLoggedIn.get()) {
      navigate('/home');
      return;
    }
    const loader = wrap.querySelector<HTMLElement>('#splash-loader');
    const actions = wrap.querySelector<HTMLElement>('#splash-actions');
    if (loader) loader.hidden = true;
    if (actions) actions.hidden = false;
  }, 1200);

  wrap.querySelector('#get-started')?.addEventListener('click', () =>
    navigate('/onboarding/diet-survey'),
  );
  wrap.querySelector('#goto-login')?.addEventListener('click', () =>
    navigate('/login'),
  );

  return wrap;
}
