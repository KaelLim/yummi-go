/**
 * Login route — username + password form, posts to auth.login.
 *
 * On success, hydrates $user via setLoggedInUser and navigates to /home.
 * On failure, shows a friendly error and re-enables the submit button.
 */
import { login as authLogin } from '@/api/auth';
import { setLoggedInUser } from '@/store/user';
import { navigate } from '@/router';
import { t } from '@/lib/i18n';

export default function login(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'auth-screen';
  wrap.innerHTML = `
    <div class="auth-header">
      <div class="auth-back" id="back-btn">
        <span class="ms">arrow_back</span>
      </div>
    </div>
    <div class="auth-body">
      <form class="auth-form" id="login-form">
        <label class="field">
          <span class="field-label text-mini">${t('login.username')}</span>
          <input class="input" type="text" name="username" autocomplete="username" required />
        </label>
        <label class="field">
          <span class="field-label text-mini">${t('login.password')}</span>
          <input class="input" type="password" name="password" autocomplete="current-password" required />
        </label>
        <div class="auth-error" id="error-msg" hidden></div>
        <button class="btn text-btn-m btn-primary btn-l text-btn-l" type="submit" id="submit-btn">${t('login.cta')}</button>
      </form>

      <p class="auth-foot">
        ${t('login.firstTime')}<a href="#/" class="link">${t('login.firstTimeCta')}</a>
      </p>
    </div>
  `;

  wrap.querySelector('#back-btn')?.addEventListener('click', () => navigate('/'));

  const form = wrap.querySelector('#login-form') as HTMLFormElement;
  const errorBox = wrap.querySelector('#error-msg') as HTMLDivElement;
  const submitBtn = wrap.querySelector('#submit-btn') as HTMLButtonElement;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorBox.hidden = true;
    const fd = new FormData(form);
    const username = String(fd.get('username') ?? '').trim();
    const password = String(fd.get('password') ?? '');
    if (!username || !password) return;

    submitBtn.disabled = true;
    submitBtn.textContent = t('login.loading');
    try {
      const user = await authLogin(username, password);
      setLoggedInUser(user);
      navigate('/home');
    } catch {
      errorBox.hidden = false;
      errorBox.textContent = t('login.fail');
      submitBtn.disabled = false;
      submitBtn.textContent = t('login.cta');
    }
  });

  return wrap;
}
