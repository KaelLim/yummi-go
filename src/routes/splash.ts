/**
 * Splash / landing screen.
 *
 * Logged-in users: 1.2s logo hold → /home (returning-user fast path).
 * Guests: after the hold, the loader dots swap for three CTAs:
 *   - Get Started      → /onboarding/diet-survey (new identified user)
 *   - 先試用 (訪客)    → registerGuest() → /onboarding/diet-survey
 *   - 已有帳號 — 登入  → /login
 * The guest path creates a real users.id row with is_guest=1; pet/XP/
 * check-ins all key off user_id so a later Google-bind upgrade keeps
 * the same row.
 */
import { $isLoggedIn, setLoggedInUser } from '@/store/user';
import { navigate } from '@/router';
import { registerGuest } from '@/api/auth';

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
      <button class="btn text-btn-m btn-secondary btn-l text-btn-l" id="continue-guest">
        先試用（訪客）
      </button>
      <button class="btn text-btn-m btn-secondary btn-l text-btn-l" id="goto-login">
        已有帳號 — 登入
      </button>
      <p class="splash-error" id="guest-error" hidden></p>
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

  const guestBtn = wrap.querySelector<HTMLButtonElement>('#continue-guest');
  guestBtn?.addEventListener('click', async () => {
    const err = wrap.querySelector<HTMLElement>('#guest-error');
    guestBtn.disabled = true;
    guestBtn.textContent = '建立訪客帳號…';
    try {
      const u = await registerGuest();
      setLoggedInUser(u);
      navigate('/onboarding/diet-survey');
    } catch (e) {
      console.error('[splash] registerGuest failed:', e);
      guestBtn.disabled = false;
      guestBtn.textContent = '先試用（訪客）';
      if (err) {
        err.hidden = false;
        err.textContent = '建立訪客帳號失敗，請稍後再試或選擇登入。';
      }
    }
  });

  return wrap;
}
