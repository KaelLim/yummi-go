/**
 * Onboarding step 2 — Diet survey.
 *
 * Asks the user to pick a diet style. Tapping any option PATCHes the profile
 * with diet_type and advances to /onboarding/baseline. Required step — no skip,
 * the user must pick before continuing. PATCH errors soft-fail (we still
 * advance) so flaky network does not strand the user mid-onboarding.
 */
import { navigate } from '@/router';
import { $user } from '@/store/user';
import { updateProfile } from '@/api/profile';
import { patchDraft } from '@/store/onboarding-draft';
import { createProgress } from '@/components/Progress';

const OPTIONS = [
  { value: 'vegan',        emoji: '🌱', label: 'Vegan 純素' },
  { value: 'vegetarian',   emoji: '🥚', label: 'Vegetarian 蛋奶素' },
  { value: 'flexitarian',  emoji: '🥗', label: 'Flexitarian 有時不吃肉' },
  { value: 'omnivore',     emoji: '🍖', label: 'Omnivore 無肉不歡' },
];

export default function dietSurvey(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'onb-screen';
  wrap.innerHTML = `
    <div class="onb-header">
      <div class="onb-back" id="back-btn"><span class="ms">arrow_back</span></div>
      ${createProgress(1, 5).outerHTML}
    </div>
    <div class="onb-body">
      <h1 class="onb-title text-h2">你的飲食習慣是？</h1>
      <p class="onb-sub text-mini">我們會根據你的飲食偏好推薦合適的挑戰</p>
      <div class="onb-options">
        ${OPTIONS.map(o => `
          <button class="choice" data-value="${o.value}">
            <span class="ch-icon">${o.emoji}</span>
            <span class="ch-text">${o.label}</span>
            <span class="ms ch-arrow">arrow_forward</span>
          </button>
        `).join('')}
      </div>
      <p class="auth-foot" style="text-align:center;">
        已有帳號？<a href="#/login" class="link">登入</a>
      </p>
    </div>
  `;

  wrap.querySelector('#back-btn')?.addEventListener('click', () => navigate('/'));

  wrap.querySelectorAll<HTMLButtonElement>('.choice').forEach(btn => {
    btn.addEventListener('click', async () => {
      const value = btn.dataset.value!;
      const u = $user.get();
      if (u) {
        try { await updateProfile(u.id, { diet_type: value }); } catch { /* soft fail */ }
      } else {
        patchDraft({ diet_type: value });
      }
      // Vegan / vegetarian users don't have a meat baseline to set —
      // skip straight to the purpose step.
      const skipsBaseline = value === 'vegan' || value === 'vegetarian';
      navigate(skipsBaseline ? '/onboarding/purpose' : '/onboarding/baseline');
    });
  });

  return wrap;
}
