/**
 * Onboarding step 2 — Carbon baseline (meat ratios).
 *
 * Four sliders (beef / pork / lamb / chicken) capture the user's pre-challenge
 * meat habits as fractions of total intake. The remainder is implicitly
 * vegetarian. Sliders move freely during input — the 100% constraint is
 * only enforced at submit time (continue button), so the user can rebalance
 * intuitively without sliders feeling "stuck" at a cap. The serialized
 * JSON is stored in user_profiles.baseline and later read by
 * lib/baseline-impact to compute carbon savings.
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
  // 蔬食 is the explicit plant share so flexitarians can see their
  // non-meat ratio directly instead of inferring it from "100 - meats".
  // Sum across all 5 must equal 100% to advance.
  { key: 'plant',   emoji: '🌱', label: '蔬食' },
];

export default function baseline(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'onb-screen';
  const state: Record<string, number> = { beef: 0.15, pork: 0.25, lamb: 0.05, chicken: 0.35, plant: 0.2 };

  function totalPct() { return Object.values(state).reduce((a, b) => a + b, 0); }

  wrap.innerHTML = `
    <div class="onb-header">
      <div class="onb-back" id="back-btn"><span class="ms">arrow_back</span></div>
      ${createProgress({ current: 2, total: 5 }).outerHTML}
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
      <div class="baseline-total" id="total-row">
        <span>總計</span>
        <span id="total-pct">${Math.round(totalPct() * 100)}%</span>
      </div>
      <p class="baseline-hint" id="total-hint">合計需為 100% 才能繼續</p>
      <button class="btn text-btn-m btn-primary btn-l text-btn-l" id="continue-btn">繼續</button>
    </div>
  `;

  wrap.querySelector('#back-btn')?.addEventListener('click', () => navigate('/onboarding/diet-survey'));

  function totalIntPct(): number {
    // Sum rounded ints so what the user sees in the UI matches the
    // validation — avoids "displays 100% but rejects on submit due to
    // 0.999999" floating-point drift.
    return Object.values(state).reduce((a, v) => a + Math.round(v * 100), 0);
  }

  function paint(key: string): void {
    const row = wrap.querySelector(`.baseline-row[data-key="${key}"]`);
    const valueEl = row?.querySelector('.baseline-value');
    if (valueEl) valueEl.textContent = Math.round(state[key] * 100) + '%';
    const total = totalIntPct();
    const totalEl = wrap.querySelector('#total-pct');
    if (totalEl) totalEl.textContent = total + '%';
    // Visual cue: green when valid, red when over, neutral otherwise.
    // Continue button reflects the same state so users see the gate.
    const totalRow = wrap.querySelector('#total-row');
    totalRow?.classList.toggle('is-ok',   total === 100);
    totalRow?.classList.toggle('is-over', total > 100);
    const hint = wrap.querySelector('#total-hint');
    if (hint) {
      hint.textContent = total === 100
        ? '✓ 合計 100%'
        : total > 100
          ? `超出 ${total - 100}%，請調整滑桿`
          : `還差 ${100 - total}%`;
    }
    const btn = wrap.querySelector<HTMLButtonElement>('#continue-btn');
    if (btn) btn.disabled = total !== 100;
  }

  wrap.querySelectorAll<HTMLInputElement>('.baseline-slider').forEach(slider => {
    slider.addEventListener('input', () => {
      const key = slider.dataset.key!;
      // No headroom cap — sliders move freely. Total is validated at
      // submit time, so users can rebalance without bars feeling stuck.
      state[key] = Number(slider.value) / 100;
      paint(key);
    });
  });

  // Initial paint so the continue button's enabled state matches the
  // default 100% sum (and the visual cue lights up green).
  paint('beef');

  wrap.querySelector('#continue-btn')?.addEventListener('click', async () => {
    if (totalIntPct() !== 100) return; // disabled-button safety net
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
