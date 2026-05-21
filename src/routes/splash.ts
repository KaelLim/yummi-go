/**
 * Splash / landing screen.
 *
 * Logged-in users: 1.2s logo hold → /home (returning-user fast path).
 * Guests: after the hold, the loader dots swap for a single Get Started CTA
 * that calls registerGuest() and routes to /onboarding/diet-survey.
 *
 * "Get Started" no longer just routes to onboarding — it provisions a
 * real users.id row with is_guest=1 first, so the user has an identity
 * (pet / XP wallet / check-ins) attached from step 1. Binding a Google
 * account later upgrades the same row; no data is lost in the swap.
 *
 * /login is no longer surfaced as a user-visible affordance (the footer
 * "已有帳號？登入" links on diet-survey/register were removed). The route
 * stays registered as a defensive target — auth-required screens still
 * `navigate('/login')` when they detect a missing session — but the
 * primary onboarding path is Get Started only.
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

  // Once Get Started is tapped, the auto-redirect must never fire — the
  // user has explicitly chosen the onboarding path, and any race where
  // the 1.2s timeout fires after setLoggedInUser would wrongly bounce
  // them to /home. Tracked via flag + clearTimeout for belt-and-suspenders.
  let getStartedTapped = false;
  const splashTimeoutId = setTimeout(() => {
    if (getStartedTapped) return;
    if ($isLoggedIn.get()) {
      navigate('/home');
      return;
    }
    const loader = wrap.querySelector<HTMLElement>('#splash-loader');
    if (loader) loader.hidden = true;
    actions.hidden = false;
  }, 1200);

  startBtn.addEventListener('click', async () => {
    getStartedTapped = true;
    clearTimeout(splashTimeoutId);
    startBtn.disabled = true;
    startBtn.textContent = '準備中…';
    try {
      const u = await registerGuest();
      setLoggedInUser(u);
      navigate('/onboarding/diet-survey');
    } catch (e) {
      console.error('[splash] registerGuest failed:', e);
      getStartedTapped = false;
      startBtn.disabled = false;
      startBtn.textContent = 'Get Started';
      errorEl.hidden = false;
      errorEl.textContent = '建立帳號失敗，請稍後再試或選擇登入。';
    }
  });

  return wrap;
}
