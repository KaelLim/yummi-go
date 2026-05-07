/**
 * Register route — username + display_name + password form, posts to auth.register.
 *
 * On success, hydrates $user via setLoggedInUser and navigates to
 * /onboarding/oath (new users go through onboarding rather than home).
 * UNIQUE-constraint failures show a localised "username taken" message;
 * other errors fall back to a generic retry message.
 */
import { register as authRegister } from '@/api/auth';
import { setLoggedInUser } from '@/store/user';
import { navigate } from '@/router';

export default function register(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'auth-screen';
  wrap.innerHTML = `
    <div class="auth-header">
      <div class="auth-back" id="back-btn"><span class="ms">arrow_back</span></div>
    </div>
    <div class="auth-body">
      <h1 class="auth-title">建立帳號</h1>
      <p class="auth-sub">開始你的 30 天蔬食挑戰</p>

      <form class="auth-form" id="reg-form">
        <label class="field">
          <span class="field-label">使用者名稱</span>
          <input class="input" type="text" name="username" required minlength="3" />
        </label>
        <label class="field">
          <span class="field-label">寵物名稱（顯示名）</span>
          <input class="input" type="text" name="display_name" required />
        </label>
        <label class="field">
          <span class="field-label">密碼</span>
          <input class="input" type="password" name="password" required minlength="6" />
        </label>
        <div class="auth-error" id="reg-error" hidden></div>
        <button class="btn btn-primary btn-l" type="submit" id="reg-submit">建立帳號</button>
      </form>

      <p class="auth-foot">
        已有帳號？<a href="#/login" class="link">登入</a>
      </p>
    </div>
  `;

  wrap.querySelector('#back-btn')?.addEventListener('click', () => navigate('/login'));

  const form = wrap.querySelector('#reg-form') as HTMLFormElement;
  const errorBox = wrap.querySelector('#reg-error') as HTMLDivElement;
  const submitBtn = wrap.querySelector('#reg-submit') as HTMLButtonElement;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorBox.hidden = true;
    const fd = new FormData(form);
    const username = String(fd.get('username') ?? '').trim();
    const password = String(fd.get('password') ?? '');
    const displayName = String(fd.get('display_name') ?? '').trim();
    if (!username || !password || !displayName) return;

    submitBtn.disabled = true;
    submitBtn.textContent = '建立中…';
    try {
      const user = await authRegister(username, password, displayName);
      setLoggedInUser(user);
      navigate('/onboarding/oath');
    } catch (err: unknown) {
      errorBox.hidden = false;
      const msg = String((err as { message?: string } | null)?.message ?? '');
      errorBox.textContent = msg.includes('UNIQUE')
        ? '使用者名稱已被使用'
        : '註冊失敗，請稍後再試';
      submitBtn.disabled = false;
      submitBtn.textContent = '建立帳號';
    }
  });

  return wrap;
}
