/**
 * Register route — username + password form. Pet name and onboarding
 * answers are collected before reaching this screen and live in
 * $onboardingDraft.
 *
 * On success, hydrates $user via setLoggedInUser, flushes the draft onto
 * the new user's drust rows (oath / profile fields / challenge_started_at),
 * and routes to /check-in so the user lands on their first photo task.
 * UNIQUE-constraint failures show a localised "username taken" message;
 * other errors fall back to a generic retry message.
 */
import { register as authRegister } from '@/api/auth';
import { setLoggedInUser } from '@/store/user';
import { $onboardingDraft, flushDraftToDrust } from '@/store/onboarding-draft';
import { navigate } from '@/router';
import { t } from '@/lib/i18n';

export default function register(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'auth-screen';
  const draft = $onboardingDraft.get();
  const petName = draft.pet_name ?? '';

  wrap.innerHTML = `
    <div class="auth-header">
      <div class="auth-back" id="back-btn"><span class="ms">arrow_back</span></div>
    </div>
    <div class="auth-body">
      <h1 class="auth-title text-h1">${t('register.last')}</h1>
      <p class="auth-sub text-body">${petName ? t('register.subFor').replace('{name}', escapeHtml(petName)) : t('register.subGeneric')}</p>

      <form class="auth-form" id="reg-form">
        <label class="field">
          <span class="field-label text-mini">${t('register.username')}</span>
          <input class="input" type="text" name="username" autocomplete="username" required minlength="3" />
        </label>
        <label class="field">
          <span class="field-label text-mini">${t('register.password')}</span>
          <input class="input" type="password" name="password" autocomplete="new-password" required minlength="6" />
        </label>
        <div class="auth-error" id="reg-error" hidden></div>
        <button class="btn text-btn-m btn-primary btn-l text-btn-l" type="submit" id="reg-submit">${t('register.confirm')}</button>
      </form>

    </div>
  `;

  wrap.querySelector('#back-btn')?.addEventListener('click', () => navigate('/onboarding/pet-name'));

  const form = wrap.querySelector('#reg-form') as HTMLFormElement;
  const errorBox = wrap.querySelector('#reg-error') as HTMLDivElement;
  const submitBtn = wrap.querySelector('#reg-submit') as HTMLButtonElement;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorBox.hidden = true;
    const fd = new FormData(form);
    const username = String(fd.get('username') ?? '').trim();
    const password = String(fd.get('password') ?? '');
    if (!username || !password) return;

    // Pet name should already be in the draft from /onboarding/pet-name. If
    // the user reached register directly (deep link / dev), fall back to the
    // username so display_name is never empty.
    const displayName = ($onboardingDraft.get().pet_name ?? '').trim() || username;

    submitBtn.disabled = true;
    submitBtn.textContent = t('register.creating');
    try {
      const user = await authRegister(username, password, displayName);
      setLoggedInUser(user);
      await flushDraftToDrust(user.id);
      navigate('/check-in');
    } catch (err: unknown) {
      console.error('[register] full error:', err);
      errorBox.hidden = false;
      const e = err as { message?: string; status?: number } | null;
      const msg = String(e?.message ?? '');
      const status = e?.status;
      if (msg.includes('UNIQUE')) {
        errorBox.textContent = t('register.uniqueErr');
      } else {
        errorBox.textContent = t('register.fail')
          .replace('{status}', String(status ?? '?'))
          .replace('{msg}', msg.slice(0, 200) || t('register.unknown'));
      }
      submitBtn.disabled = false;
      submitBtn.textContent = t('register.confirm');
    }
  });

  return wrap;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;'
      : c === '<' ? '&lt;'
      : c === '>' ? '&gt;'
      : c === '"' ? '&quot;'
      : '&#39;',
  );
}
