/**
 * Onboarding step 2 — Diet survey.
 *
 * Asks the user to pick a diet style. Tapping any option PATCHes the profile
 * with diet_type and advances to /onboarding/baseline. A skip button lets the
 * user move on without writing the field. PATCH errors soft-fail (we still
 * advance) so flaky network does not strand the user mid-onboarding.
 */
import { navigate } from '@/router';
import { $user } from '@/store/user';
import { updateProfile } from '@/api/profile';
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
      ${createProgress(2, 6).outerHTML}
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
      <div class="grow"></div>
      <button class="btn-skip" id="skip-btn">Skip</button>
    </div>
  `;

  wrap.querySelector('#back-btn')?.addEventListener('click', () => navigate('/onboarding/oath'));
  wrap.querySelector('#skip-btn')?.addEventListener('click', () => navigate('/onboarding/baseline'));

  wrap.querySelectorAll<HTMLButtonElement>('.choice').forEach(btn => {
    btn.addEventListener('click', async () => {
      const value = btn.dataset.value!;
      const u = $user.get();
      if (!u) { navigate('/login'); return; }
      try {
        await updateProfile(u.id, { diet_type: value });
        navigate('/onboarding/baseline');
      } catch {
        // soft fail; continue anyway
        navigate('/onboarding/baseline');
      }
    });
  });

  return wrap;
}
