/**
 * Challenge difficulty picker — shown right after the user's FIRST
 * check-in (no longer part of the onboarding chain).
 *
 * The success page detects challenge_level === null and routes here
 * before /home, so the user gets to set their target difficulty once
 * they've actually tasted the flow. Re-entering later (e.g. from the
 * profile) is intentionally fine — tapping a level just patches
 * challenge_level and bounces to /home.
 */
import { navigate } from '@/router';
import { $user, $profile } from '@/store/user';
import { updateProfile, getUserFull } from '@/api/profile';

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
    </div>
    <div class="onb-body">
      <h1 class="onb-title text-h2">挑戰難度</h1>
      <p class="onb-sub text-mini">第一次打卡完成！選一個你能堅持 30 天的挑戰目標</p>
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

  wrap.querySelector('#back-btn')?.addEventListener('click', () => navigate('/home'));

  wrap.querySelectorAll<HTMLButtonElement>('.level-choice').forEach(btn => {
    btn.addEventListener('click', async () => {
      const value = Number(btn.dataset.value);
      const u = $user.get();
      if (u) {
        try { await updateProfile(u.id, { challenge_level: value }); } catch { /* soft fail */ }
        // Refresh $profile so home's tolerance pill + future check-in
        // success branch see the new level immediately.
        void getUserFull(u.id).then((full) => { if (full) $profile.set(full); });
      }
      navigate('/home');
    });
  });

  return wrap;
}
