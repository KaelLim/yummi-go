/**
 * Login route — username + password form, posts to auth.login.
 *
 * On success, hydrates $user via setLoggedInUser and navigates to /home.
 * On failure, shows a friendly error and re-enables the submit button.
 */
import { login as authLogin } from '@/api/auth';
import { setLoggedInUser } from '@/store/user';
import { navigate } from '@/router';

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
      <h1 class="auth-title text-h1">歡迎回來</h1>
      <p class="auth-sub text-body">繼續你的蔬食冒險</p>

      <form class="auth-form" id="login-form">
        <label class="field">
          <span class="field-label text-mini">使用者名稱</span>
          <input class="input" type="text" name="username" autocomplete="username" required />
        </label>
        <label class="field">
          <span class="field-label text-mini">密碼</span>
          <input class="input" type="password" name="password" autocomplete="current-password" required />
        </label>
        <div class="auth-error" id="error-msg" hidden></div>
        <button class="btn text-btn-m btn-primary btn-l text-btn-l" type="submit" id="submit-btn">登入</button>
      </form>

      <p class="auth-foot">
        還沒有帳號？<a href="#/onboarding/oath" class="link">立即註冊</a>
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
    submitBtn.textContent = '登入中…';
    try {
      const user = await authLogin(username, password);
      setLoggedInUser(user);
      navigate('/home');
    } catch {
      errorBox.hidden = false;
      errorBox.textContent = '登入失敗：使用者名稱或密碼錯誤';
      submitBtn.disabled = false;
      submitBtn.textContent = '登入';
    }
  });

  return wrap;
}
