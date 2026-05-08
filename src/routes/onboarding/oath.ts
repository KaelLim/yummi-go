/**
 * Onboarding step 1 — Green Oath signing screen.
 *
 * Shows the world-building copy ("灰霧 / 喚醒者 / 真實能量") and a checkbox.
 * The continue button stays disabled until the checkbox is checked. On
 * confirm, calls signOath() to stamp the user row and navigates onward.
 */
import { navigate } from '@/router';
import { $user } from '@/store/user';
import { signOath } from '@/api/profile';
import { createProgress } from '@/components/Progress';

export default function oath(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'onb-screen';
  wrap.innerHTML = `
    <div class="onb-header">
      ${createProgress(1, 6).outerHTML}
    </div>
    <div class="onb-body">
      <h1 class="onb-title text-h2">綠色承諾</h1>
      <div class="oath-card">
        <div class="oath-icon">🌿</div>
        <p class="oath-text">
          這個世界被「灰霧」籠罩，
          需要你成為「喚醒者」，
          透過真實能量喚醒沉睡的生態精靈。
        </p>
        <p class="oath-text strong">
          我承諾尋找真實能量，<br/>來喚醒守護者。
        </p>
      </div>
      <label class="oath-checkbox">
        <input type="checkbox" id="oath-cb" />
        <span class="oath-cb-label">我同意這個承諾</span>
      </label>
      <div class="grow"></div>
      <button class="btn text-btn-m btn-primary btn-l text-btn-l" id="continue-btn" disabled>繼續</button>
    </div>
  `;

  const cb = wrap.querySelector('#oath-cb') as HTMLInputElement;
  const btn = wrap.querySelector('#continue-btn') as HTMLButtonElement;
  cb.addEventListener('change', () => { btn.disabled = !cb.checked; });

  btn.addEventListener('click', async () => {
    const u = $user.get();
    if (!u) { navigate('/login'); return; }
    btn.disabled = true;
    btn.textContent = '確認中…';
    try {
      await signOath(u.id);
      navigate('/onboarding/diet-survey');
    } catch {
      btn.disabled = false;
      btn.textContent = '繼續';
      alert('同步失敗，請稍後再試');
    }
  });

  return wrap;
}
