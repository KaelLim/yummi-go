/**
 * Onboarding step 3 — Carbon baseline (meat ratios).
 *
 * Four sliders (beef / pork / lamb / chicken) capture the user's pre-challenge
 * meat habits as fractions of total intake. The remainder is implicitly
 * vegetarian. The serialized JSON is stored in user_profiles.baseline and is
 * later used by lib/baseline-impact to compute carbon savings.
 */
import { navigate } from '@/router';
import { $user } from '@/store/user';
import { updateProfile } from '@/api/profile';
import { patchDraft } from '@/store/onboarding-draft';
import { createProgress } from '@/components/Progress';

const TYPES = [
  { key: 'beef',    emoji: '🐄', label: '牛肉' },
  { key: 'pork',    emoji: '🐖', label: '豬肉' },
  { key: 'lamb',    emoji: '🐑', label: '羊肉' },
  { key: 'chicken', emoji: '🐓', label: '雞肉' },
];

export default function baseline(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'onb-screen';
  const state: Record<string, number> = { beef: 0.2, pork: 0.3, lamb: 0.0, chicken: 0.5 };

  function totalPct() { return Object.values(state).reduce((a, b) => a + b, 0); }

  wrap.innerHTML = `
    <div class="onb-header">
      <div class="onb-back" id="back-btn"><span class="ms">arrow_back</span></div>
      ${createProgress(3, 9).outerHTML}
    </div>
    <div class="onb-body">
      <h1 class="onb-title text-h2">原本的肉類飲食</h1>
      <p class="onb-sub text-mini">這是用來計算你的減碳成果。可滑動調整每種肉的比例。</p>
      <div class="baseline-list" id="baseline-list">
        ${TYPES.map(t => `
          <div class="baseline-row" data-key="${t.key}">
            <div class="baseline-label">
              <span class="baseline-emoji">${t.emoji}</span>
              <span class="baseline-name">${t.label}</span>
              <span class="baseline-value">${Math.round(state[t.key] * 100)}%</span>
            </div>
            <input type="range" min="0" max="100" value="${Math.round(state[t.key] * 100)}" class="baseline-slider" data-key="${t.key}" />
          </div>
        `).join('')}
      </div>
      <div class="baseline-total">總計：<span id="total-pct">${Math.round(totalPct() * 100)}%</span> <span class="muted">(其他為素食)</span></div>
      <div class="grow"></div>
      <button class="btn text-btn-m btn-primary btn-l text-btn-l" id="continue-btn">繼續</button>
    </div>
  `;

  wrap.querySelector('#back-btn')?.addEventListener('click', () => navigate('/onboarding/diet-survey'));

  wrap.querySelectorAll<HTMLInputElement>('.baseline-slider').forEach(slider => {
    slider.addEventListener('input', () => {
      const key = slider.dataset.key!;
      state[key] = Number(slider.value) / 100;
      const row = wrap.querySelector(`.baseline-row[data-key="${key}"]`);
      const valueEl = row?.querySelector('.baseline-value');
      if (valueEl) valueEl.textContent = Math.round(state[key] * 100) + '%';
      const totalEl = wrap.querySelector('#total-pct');
      if (totalEl) totalEl.textContent = Math.round(totalPct() * 100) + '%';
    });
  });

  wrap.querySelector('#continue-btn')?.addEventListener('click', async () => {
    const u = $user.get();
    const baselineJson = JSON.stringify(state);
    if (u) {
      try { await updateProfile(u.id, { baseline: baselineJson }); } catch { /* soft fail */ }
    } else {
      patchDraft({ baseline: baselineJson });
    }
    navigate('/onboarding/purpose');
  });

  return wrap;
}
