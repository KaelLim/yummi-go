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
import { MOCK_GOOGLE_ACCOUNTS, mockGoogleSignIn } from '@/lib/mock-google-auth';
import { $locale, setLocale, t } from '@/lib/i18n';

export default function splash(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'splash';
  wrap.innerHTML = `
    <div class="splash-logo">
      <div class="splash-logo-mark">🌿</div>
      <div class="splash-title text-title is-latin">Yummi Go</div>
    </div>
    <div class="splash-loader" id="splash-loader">
      <div class="dot"></div><div class="dot"></div><div class="dot"></div>
    </div>
    <div class="splash-actions" id="splash-actions" hidden>
      <p class="splash-error" id="guest-error" hidden></p>
      <div class="splash-locale" id="splash-locale" role="group" aria-label="Language">
        <button class="splash-locale-chip" data-locale="zh" type="button">繁中</button>
        <button class="splash-locale-chip" data-locale="en" type="button">EN</button>
      </div>
    </div>
  `;

  // Locale chips — pick a language before tapping a CTA. Needed on
  // the splash because the diet-survey + onboarding flow runs
  // before the user can reach /profile/settings; the toggle here
  // persists via setLocale so the chosen language carries through.
  function reflectLocale(): void {
    const cur = $locale.get();
    wrap.querySelectorAll<HTMLButtonElement>('.splash-locale-chip').forEach((c) => {
      c.classList.toggle('selected', c.dataset.locale === cur);
    });
    // Pre-actions-render CTAs may not exist yet on first call; the
    // button refs below handle their own re-label after creation.
    startBtnRef?.replaceChildren(document.createTextNode(t('splash.getStarted')));
    if (googleBtnRef) {
      googleBtnRef.innerHTML =
        '<span class="splash-google-mark" aria-hidden="true">G</span>' + t('splash.googleLogin');
    }
  }
  let startBtnRef: HTMLButtonElement | null = null;
  let googleBtnRef: HTMLButtonElement | null = null;
  wrap.querySelectorAll<HTMLButtonElement>('.splash-locale-chip').forEach((c) => {
    c.addEventListener('click', () => {
      const next = c.dataset.locale as 'zh' | 'en';
      setLocale(next);
    });
  });
  const unsubLocale = $locale.subscribe(reflectLocale);
  wrap.addEventListener('lifecycle:unmount', () => unsubLocale());

  const actions = wrap.querySelector<HTMLElement>('#splash-actions')!;
  const errorEl = wrap.querySelector<HTMLElement>('#guest-error')!;

  const startBtn = createButton({
    label: t('splash.getStarted'),
    variant: 'primary',
    size: 'lg',
  });
  startBtn.id = 'get-started';
  actions.insertBefore(startBtn, errorEl);
  startBtnRef = startBtn;

  // Second CTA: mock Google sign-in. Real Google OAuth is a Phase 2 PR;
  // see lib/mock-google-auth for the stub. Existing email → /home,
  // new email → onboarding/diet-survey.
  const googleBtn = createButton({
    label: t('splash.googleLogin'),
    variant: 'secondary',
    size: 'lg',
  });
  googleBtn.id = 'google-login';
  googleBtn.classList.add('splash-google-btn');
  googleBtn.innerHTML = '<span class="splash-google-mark" aria-hidden="true">G</span>' + googleBtn.innerHTML;
  actions.insertBefore(googleBtn, errorEl);
  googleBtnRef = googleBtn;
  // Now that both buttons exist, run an initial paint to highlight the
  // active locale chip and ensure all labels are in sync.
  reflectLocale();

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
    startBtn.textContent = t('splash.preparing');
    try {
      const u = await registerGuest();
      setLoggedInUser(u);
      navigate('/onboarding/diet-survey');
    } catch (e) {
      console.error('[splash] registerGuest failed:', e);
      getStartedTapped = false;
      startBtn.disabled = false;
      startBtn.textContent = t('splash.getStarted');
      errorEl.hidden = false;
      errorEl.textContent = t('splash.guestError');
    }
  });

  googleBtn.addEventListener('click', () => {
    getStartedTapped = true;
    clearTimeout(splashTimeoutId);
    openGooglePicker(wrap, async ({ email, displayName }) => {
      googleBtn.disabled = true;
      try {
        const result = await mockGoogleSignIn(email, displayName);
        setLoggedInUser(result.user);
        // Returning user → /home (they already finished onboarding).
        // New user → /onboarding/diet-survey so their profile gets set up.
        navigate(result.isReturning ? '/home' : '/onboarding/diet-survey');
      } catch (e) {
        console.error('[splash] mockGoogleSignIn failed:', e);
        getStartedTapped = false;
        googleBtn.disabled = false;
        errorEl.hidden = false;
        errorEl.textContent = t('splash.googleError');
      }
    });
  });

  return wrap;
}

/**
 * Centred Google-style account chooser overlay. Two pre-baked demo
 * accounts + a free-form email input. On confirm, calls back with the
 * picked email + displayName so the caller can drive mockGoogleSignIn.
 */
function openGooglePicker(
  host: HTMLElement,
  onPick: (args: { email: string; displayName: string }) => void,
): void {
  const overlay = document.createElement('div');
  overlay.className = 'google-picker-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.innerHTML = `
    <div class="google-picker-card">
      <header class="google-picker-head">
        <span class="google-picker-mark">G</span>
        <h2 class="google-picker-title">${t('google.pickAccount')}</h2>
      </header>
      <p class="google-picker-sub">${t('google.pickSub')}</p>
      <ul class="google-picker-accounts">
        ${MOCK_GOOGLE_ACCOUNTS.map(
          (a) => `
          <li>
            <button class="google-picker-account" type="button" data-email="${a.email}" data-name="${a.displayName}">
              <span class="google-picker-avatar" aria-hidden="true">${a.avatarEmoji}</span>
              <span class="google-picker-account-meta">
                <span class="google-picker-account-name">${a.displayName}</span>
                <span class="google-picker-account-email">${a.email}</span>
              </span>
            </button>
          </li>`,
        ).join('')}
        <li>
          <div class="google-picker-custom">
            <input type="email" class="input" id="google-picker-email" placeholder="${t('google.useOther')}" autocomplete="off" />
            <button class="btn text-btn-m btn-primary btn-sm text-mini" id="google-picker-go" type="button">${t('google.signIn')}</button>
          </div>
        </li>
      </ul>
      <button class="google-picker-cancel" type="button" id="google-picker-cancel">${t('google.cancel')}</button>
    </div>
  `;
  function close(): void { overlay.remove(); }
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  overlay.querySelector('#google-picker-cancel')?.addEventListener('click', close);
  overlay.querySelectorAll<HTMLButtonElement>('.google-picker-account').forEach((btn) => {
    btn.addEventListener('click', () => {
      const email = btn.dataset.email ?? '';
      const displayName = btn.dataset.name ?? '';
      close();
      onPick({ email, displayName });
    });
  });
  overlay.querySelector('#google-picker-go')?.addEventListener('click', () => {
    const input = overlay.querySelector<HTMLInputElement>('#google-picker-email');
    const email = (input?.value ?? '').trim();
    if (!email || !email.includes('@')) {
      input?.focus();
      return;
    }
    const displayName = email.split('@')[0] ?? email;
    close();
    onPick({ email, displayName });
  });
  host.appendChild(overlay);
}
