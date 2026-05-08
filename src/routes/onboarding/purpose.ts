/**
 * Onboarding step 4 — Challenge purpose.
 *
 * Body management / Environment protection / Make a vow / Skip.
 * Tap → updateProfile({ purpose }) → /onboarding/challenge-level.
 */
import { navigate } from '@/router';
import { $user } from '@/store/user';
import { updateProfile } from '@/api/profile';
import { createProgress } from '@/components/Progress';

const OPTIONS = [
  { value: 'body',         emoji: '🏃', label: 'Body management 健康管理' },
  { value: 'environment',  emoji: '🌱', label: 'Environment protection 環保' },
  { value: 'vow',          emoji: '🙏', label: 'Make a vow 發願' },
];

export default function purpose(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'onb-screen';
  wrap.innerHTML = `
    <div class="onb-header">
      <div class="onb-back" id="back-btn"><span class="ms">arrow_back</span></div>
      ${createProgress(4, 8).outerHTML}
    </div>
    <div class="onb-body">
      <h1 class="onb-title text-h2">參加挑戰的目的</h1>
      <p class="onb-sub text-mini">挑戰的方向會影響每日的提示文字</p>
      <div class="onb-options">
        ${OPTIONS.map((o) => `
          <button class="choice" data-value="${o.value}">
            <span class="ch-icon">${o.emoji}</span>
            <span class="ch-text">${o.label}</span>
            <span class="ms ch-arrow">arrow_forward</span>
          </button>
        `).join('')}
      </div>
      <div class="grow"></div>
      <button class="btn-skip" id="skip-btn">Skip</button>
    </div>
  `;

  wrap.querySelector('#back-btn')?.addEventListener('click', () => navigate('/onboarding/baseline'));
  wrap.querySelector('#skip-btn')?.addEventListener('click', () => navigate('/onboarding/challenge-level'));

  wrap.querySelectorAll<HTMLButtonElement>('.choice').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const value = btn.dataset.value!;
      const u = $user.get();
      if (u) {
        try { await updateProfile(u.id, { purpose: value }); } catch { /* soft fail */ }
      }
      navigate('/onboarding/challenge-level');
    });
  });

  return wrap;
}
