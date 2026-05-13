/**
 * Splash / landing screen.
 *
 * Logged-in users: 1.2s logo hold → /home (returning-user fast path).
 * Guests: after the hold, the loader dots swap for two CTAs:
 *   - Get Started      → registerGuest() → /onboarding/diet-survey
 *   - 已有帳號 — 登入  → /login
 *
 * "Get Started" no longer just routes to onboarding — it provisions a
 * real users.id row with is_guest=1 first, so the user has an identity
 * (pet / XP wallet / check-ins) attached from step 1. Binding a Google
 * account later upgrades the same row; no data is lost in the swap.
 *
 * Both CTAs come from the schema-driven `createButton` factory — this
 * route is the first end-to-end proof that the component registry works
 * in production code.
 */
import { $isLoggedIn, setLoggedInUser } from '@/store/user';
import { navigate } from '@/router';
import { registerGuest } from '@/api/auth';
import createButton from '@/components/Button';

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
      <p class="splash-error" id="guest-error" hidden></p>
    </div>
  `;

  const actions = wrap.querySelector<HTMLElement>('#splash-actions')!;
  const errorEl = wrap.querySelector<HTMLElement>('#guest-error')!;

  const startBtn = createButton({
    label: 'Get Started',
    variant: 'primary',
    size: 'lg',
  });
  startBtn.id = 'get-started';
  actions.insertBefore(startBtn, errorEl);

  const loginBtn = createButton({
    label: '已有帳號 — 登入',
    variant: 'secondary',
    size: 'lg',
    onClick: () => navigate('/login'),
  });
  loginBtn.id = 'goto-login';
  actions.insertBefore(loginBtn, errorEl);

  setTimeout(() => {
    if ($isLoggedIn.get()) {
      navigate('/home');
      return;
    }
    const loader = wrap.querySelector<HTMLElement>('#splash-loader');
    if (loader) loader.hidden = true;
    actions.hidden = false;
  }, 1200);

  startBtn.addEventListener('click', async () => {
    startBtn.disabled = true;
    startBtn.textContent = '準備中…';
    try {
      const u = await registerGuest();
      setLoggedInUser(u);
      navigate('/onboarding/diet-survey');
    } catch (e) {
      console.error('[splash] registerGuest failed:', e);
      startBtn.disabled = false;
      startBtn.textContent = 'Get Started';
      errorEl.hidden = false;
      errorEl.textContent = '建立帳號失敗，請稍後再試或選擇登入。';
    }
  });

  return wrap;
}
