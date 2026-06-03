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
import { t } from '@/lib/i18n';

const OPTIONS = [
  { value: 'facebook',  emoji: '📘', labelKey: 'tasks.known.fb' },
  { value: 'instagram', emoji: '📷', labelKey: 'tasks.known.ig' },
  { value: 'threads',   emoji: '🧵', labelKey: 'tasks.known.threads' },
  { value: 'friend',    emoji: '🤝', labelKey: 'tasks.known.friendShare' },
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
      <h1 class="onb-title text-h2">${t('tasks.known.titleFmt')}</h1>
      <p class="onb-sub text-mini">${t('tasks.known.subFmt').replace('{xp}', String(REWARD_XP))}</p>
      <div class="onb-options">
        ${OPTIONS.map((o) => `
          <button class="choice" data-value="${o.value}">
            <span class="ch-icon">${o.emoji}</span>
            <span class="ch-text">${t(o.labelKey)}</span>
            <span class="ms ch-arrow">arrow_forward</span>
          </button>
        `).join('')}
      </div>
      <button class="btn-skip" id="skip-btn">${t('tasks.known.skip')}</button>
    </div>
  `;

  wrap.querySelector('#back-btn')?.addEventListener('click', () => navigate('/home'));
  wrap.querySelector('#skip-btn')?.addEventListener('click', () => navigate('/home'));

  wrap.querySelectorAll<HTMLButtonElement>('.choice').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const value = btn.dataset.value!;
      const u = $user.get();
      if (!u) {
        navigate('/home');
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
      navigate('/home');
    });
  });

  return wrap;
}
