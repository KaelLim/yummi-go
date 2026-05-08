/**
 * Onboarding step 7 — Acquisition source.
 *
 * Facebook / Instagram / Threads / 親友分享 / Skip.
 * Tap → updateProfile({ known_from }) → /onboarding/day1-hook.
 */
import { navigate } from '@/router';
import { $user } from '@/store/user';
import { updateProfile } from '@/api/profile';
import { createProgress } from '@/components/Progress';

const OPTIONS = [
  { value: 'facebook',  emoji: '📘', label: 'Facebook' },
  { value: 'instagram', emoji: '📷', label: 'Instagram' },
  { value: 'threads',   emoji: '🧵', label: 'Threads' },
  { value: 'friend',    emoji: '🤝', label: '親友分享' },
];

export default function knownFrom(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'onb-screen';
  wrap.innerHTML = `
    <div class="onb-header">
      <div class="onb-back" id="back-btn"><span class="ms">arrow_back</span></div>
      ${createProgress(7, 8).outerHTML}
    </div>
    <div class="onb-body">
      <h1 class="onb-title text-h2">如何得知這個 App？</h1>
      <p class="onb-sub text-mini">幫我們知道你從哪裡來</p>
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

  wrap.querySelector('#back-btn')?.addEventListener('click', () => navigate('/onboarding/eat-times'));
  wrap.querySelector('#skip-btn')?.addEventListener('click', () => navigate('/onboarding/day1-hook'));

  wrap.querySelectorAll<HTMLButtonElement>('.choice').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const value = btn.dataset.value!;
      const u = $user.get();
      if (u) {
        try { await updateProfile(u.id, { known_from: value }); } catch { /* soft fail */ }
      }
      navigate('/onboarding/day1-hook');
    });
  });

  return wrap;
}
