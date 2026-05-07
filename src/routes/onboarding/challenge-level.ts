/**
 * Onboarding step 4 — Challenge level (1/2/3).
 *
 * Tapping a level PATCHes challenge_level into the profile and advances.
 * Errors soft-fail to keep onboarding unblocked.
 */
import { navigate } from '@/router';
import { $user } from '@/store/user';
import { updateProfile } from '@/api/profile';
import { createProgress } from '@/components/Progress';

const LEVELS = [
  { value: 1, label: '等級一', desc: '每天有一餐無肉就達標', tag: '輕鬆挑戰' },
  { value: 2, label: '等級二', desc: '挑戰 30 天三餐無肉，給予 3 次容錯機會', tag: '推薦' },
  { value: 3, label: '等級三', desc: '挑戰 30 天三餐無肉，零容錯，極限意志力', tag: '硬核' },
];

export default function challengeLevel(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'onb-screen';
  wrap.innerHTML = `
    <div class="onb-header">
      <div class="onb-back" id="back-btn"><span class="ms">arrow_back</span></div>
      ${createProgress(4, 6).outerHTML}
    </div>
    <div class="onb-body">
      <h1 class="onb-title">挑戰難度</h1>
      <p class="onb-sub">選擇你能堅持 30 天的挑戰</p>
      <div class="onb-options">
        ${LEVELS.map(l => `
          <button class="choice level-choice" data-value="${l.value}">
            <span class="ch-text">
              <strong>${l.label}</strong>
              <span class="level-tag">${l.tag}</span>
              <small>${l.desc}</small>
            </span>
            <span class="ms ch-arrow">arrow_forward</span>
          </button>
        `).join('')}
      </div>
    </div>
  `;

  wrap.querySelector('#back-btn')?.addEventListener('click', () => navigate('/onboarding/baseline'));

  wrap.querySelectorAll<HTMLButtonElement>('.level-choice').forEach(btn => {
    btn.addEventListener('click', async () => {
      const value = Number(btn.dataset.value);
      const u = $user.get();
      if (!u) { navigate('/login'); return; }
      try { await updateProfile(u.id, { challenge_level: value }); } catch { /* soft fail */ }
      navigate('/onboarding/eat-times');
    });
  });

  return wrap;
}
