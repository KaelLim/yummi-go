/**
 * Onboarding step 2 — Carbon baseline (eating habit).
 *
 * Two sliders only: 肉食 / 蔬食. Moving either auto-rebalances the
 * other so the pair always adds to 100% — no submit gate needed.
 * Internally we expand the meat ratio into the 4-kind Baseline shape
 * (lib/baseline-impact.MEAT_MIX) so the carbon-impact calculation
 * keeps its per-meat-type resolution. The serialized JSON is stored
 * in user_profiles.baseline.
 */
import { navigate } from '@/router';
import { $user } from '@/store/user';
import { updateProfile } from '@/api/profile';
import { patchDraft } from '@/store/onboarding-draft';
import { createProgress } from '@/components/Progress';
import { t } from '@/lib/i18n';
import { baselineFromMeatPct } from '@/lib/baseline-impact';

const DEFAULT_MEAT_PCT = 70;

export default function baseline(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'onb-screen';
  let meatPct = DEFAULT_MEAT_PCT;

  wrap.innerHTML = `
    <div class="onb-header">
      <div class="onb-back" id="back-btn"><span class="ms">arrow_back</span></div>
      ${createProgress({ current: 2, total: 5 }).outerHTML}
    </div>
    <div class="onb-body">
      <h1 class="onb-title text-h2">${t('onb.baseline.title')}</h1>
      <p class="onb-sub text-mini">${t('onb.baseline.sub')}</p>
      <div class="baseline-list" id="baseline-list">
        <div class="baseline-row" data-key="meat">
          <div class="baseline-label">
            <span class="baseline-emoji">🍖</span>
            <span class="baseline-name">${t('onb.baseline.meat')}</span>
            <span class="baseline-value" data-bind="meat-pct">${meatPct}%</span>
          </div>
          <input type="range" min="0" max="100" value="${meatPct}" class="baseline-slider" data-key="meat" />
        </div>
        <div class="baseline-row" data-key="plant">
          <div class="baseline-label">
            <span class="baseline-emoji">🌱</span>
            <span class="baseline-name">${t('onb.baseline.plant')}</span>
            <span class="baseline-value" data-bind="plant-pct">${100 - meatPct}%</span>
          </div>
          <input type="range" min="0" max="100" value="${100 - meatPct}" class="baseline-slider" data-key="plant" />
        </div>
      </div>
      <button class="btn text-btn-m btn-primary btn-l text-btn-l" id="continue-btn">${t('common.continue')}</button>
    </div>
  `;

  wrap.querySelector('#back-btn')?.addEventListener('click', () => navigate('/onboarding/diet-survey'));

  const meatSlider = wrap.querySelector<HTMLInputElement>('.baseline-slider[data-key="meat"]')!;
  const plantSlider = wrap.querySelector<HTMLInputElement>('.baseline-slider[data-key="plant"]')!;
  const meatPctEl = wrap.querySelector<HTMLElement>('[data-bind="meat-pct"]')!;
  const plantPctEl = wrap.querySelector<HTMLElement>('[data-bind="plant-pct"]')!;

  function setMeat(next: number): void {
    meatPct = Math.max(0, Math.min(100, Math.round(next)));
    meatSlider.value = String(meatPct);
    plantSlider.value = String(100 - meatPct);
    meatPctEl.textContent = meatPct + '%';
    plantPctEl.textContent = (100 - meatPct) + '%';
  }

  meatSlider.addEventListener('input', () => setMeat(Number(meatSlider.value)));
  plantSlider.addEventListener('input', () => setMeat(100 - Number(plantSlider.value)));

  wrap.querySelector('#continue-btn')?.addEventListener('click', async () => {
    const u = $user.get();
    const baselineJson = JSON.stringify(baselineFromMeatPct(meatPct));
    if (u) {
      try { await updateProfile(u.id, { baseline: baselineJson }); } catch { /* soft fail */ }
    } else {
      patchDraft({ baseline: baselineJson });
    }
    navigate('/onboarding/purpose');
  });

  return wrap;
}
