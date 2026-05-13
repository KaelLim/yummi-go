/**
 * Acquisition-source task — moved out of onboarding.
 *
 * Surfaces only on /tasks while profile.known_from is null. Tapping
 * one of the chips patches the profile, credits 15 XP via the wallet,
 * marks the today mission slot so the home/quiz badges stay in sync,
 * and bounces back to /tasks. Skip just navigates away (no XP).
 */
import { navigate } from '@/router';
import { $user, $profile } from '@/store/user';
import { updateProfile, getUserFull } from '@/api/profile';
import { awardXp } from '@/store/pet';
import { markMissionDone } from '@/store/today';

const OPTIONS = [
  { value: 'facebook',  emoji: '📘', label: 'Facebook' },
  { value: 'instagram', emoji: '📷', label: 'Instagram' },
  { value: 'threads',   emoji: '🧵', label: 'Threads' },
  { value: 'friend',    emoji: '🤝', label: '親友分享' },
];

const REWARD_XP = 15;
const MISSION_KEY = 'known_from';

export default function knownFromTask(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'onb-screen';
  wrap.innerHTML = `
    <div class="onb-header">
      <div class="onb-back" id="back-btn"><span class="ms">arrow_back</span></div>
    </div>
    <div class="onb-body">
      <h1 class="onb-title text-h2">如何得知這個 App？</h1>
      <p class="onb-sub text-mini">幫我們知道你從哪裡來 — 完成可得 +${REWARD_XP} XP</p>
      <div class="onb-options">
        ${OPTIONS.map((o) => `
          <button class="choice" data-value="${o.value}">
            <span class="ch-icon">${o.emoji}</span>
            <span class="ch-text">${o.label}</span>
            <span class="ms ch-arrow">arrow_forward</span>
          </button>
        `).join('')}
      </div>
      <button class="btn-skip" id="skip-btn">Skip</button>
    </div>
  `;

  wrap.querySelector('#back-btn')?.addEventListener('click', () => navigate('/tasks'));
  wrap.querySelector('#skip-btn')?.addEventListener('click', () => navigate('/tasks'));

  wrap.querySelectorAll<HTMLButtonElement>('.choice').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const value = btn.dataset.value!;
      const u = $user.get();
      if (!u) {
        navigate('/tasks');
        return;
      }
      try {
        await updateProfile(u.id, { known_from: value });
        await awardXp(u.id, REWARD_XP, 'mission', null);
        markMissionDone(MISSION_KEY, REWARD_XP);
        const full = await getUserFull(u.id);
        if (full) $profile.set(full);
      } catch (err) {
        console.warn('[tasks/known-from] failed:', err);
      }
      navigate('/tasks');
    });
  });

  return wrap;
}
