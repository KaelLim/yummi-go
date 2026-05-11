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
      <h1 class="auth-title text-h1">最後一步</h1>
      <p class="auth-sub text-body">${petName ? `為「${escapeHtml(petName)}」建立帳號` : '建立帳號以儲存你的進度'}</p>

      <form class="auth-form" id="reg-form">
        <label class="field">
          <span class="field-label text-mini">使用者名稱</span>
          <input class="input" type="text" name="username" autocomplete="username" required minlength="3" />
        </label>
        <label class="field">
          <span class="field-label text-mini">密碼</span>
          <input class="input" type="password" name="password" autocomplete="new-password" required minlength="6" />
        </label>
        <div class="auth-error" id="reg-error" hidden></div>
        <button class="btn text-btn-m btn-primary btn-l text-btn-l" type="submit" id="reg-submit">建立帳號</button>
      </form>

      <p class="auth-foot">
        已有帳號？<a href="#/login" class="link">登入</a>
      </p>
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
    submitBtn.textContent = '建立中…';
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
        errorBox.textContent = '使用者名稱已被使用';
      } else {
        errorBox.textContent = `註冊失敗 (${status ?? '?'}): ${msg.slice(0, 200) || '未知錯誤'}`;
      }
      submitBtn.disabled = false;
      submitBtn.textContent = '建立帳號';
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
