/**
 * 基本飲食 editor — diet-type picker + a single 肉食/蔬食 pair of
 * sliders that auto-balance to 100%.
 *
 * The pair is only shown when the diet picker is `omnivore` or
 * `flexitarian` (vegan / vegetarian users have no meat baseline to
 * tune). Save persists `diet_type` always and `baseline` only when
 * the sliders are showing. Internally we expand the meat ratio
 * via baselineFromMeatPct() so the carbon-impact math keeps its
 * per-meat-kind resolution even though the UI is just two bars.
 */
import { navigate } from '@/router';
import { $user, $profile } from '@/store/user';
import { updateProfile, getUserFull } from '@/api/profile';
import {
  impactSavedKg,
  baselineFromMeatPct,
  meatPctFromBaseline,
  type Baseline,
} from '@/lib/baseline-impact';
import { t } from '@/lib/i18n';

interface DietOption {
  value: string;
  emoji: string;
  labelKey: string;
}

const DIET_OPTIONS: DietOption[] = [
  { value: 'vegan',        emoji: '🌱', labelKey: 'profile.diet.vegan' },
  { value: 'vegetarian',   emoji: '🥚', labelKey: 'profile.diet.vegetarian' },
  { value: 'flexitarian',  emoji: '🥗', labelKey: 'profile.diet.flexitarian' },
  { value: 'omnivore',     emoji: '🍖', labelKey: 'profile.diet.omnivore' },
];

const DEFAULT_MEAT_PCT = 70;

export default function baselineEditor(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'baseline-screen';

  const profile = $profile.get();
  let diet: string = profile?.diet_type ?? 'omnivore';
  const initialBaseline = parseBaseline(profile?.baseline);
  let meatPct: number = initialBaseline
    ? meatPctFromBaseline(initialBaseline)
    : DEFAULT_MEAT_PCT;

  wrap.innerHTML = `
    <header class="checkin-header">
      <button class="checkin-back" id="back-btn" aria-label="${t('common.back')}">
        <span class="ms">arrow_back</span>
      </button>
      <span class="checkin-title">${t('profile.baseline.title')}</span>
      <span></span>
    </header>
    <div class="checkin-body">
      <section class="baseline-section">
        <h2 class="baseline-section-title">${t('profile.baseline.dietTitle')}</h2>
        <p class="onb-sub text-mini">${t('profile.baseline.dietSub')}</p>
        <div class="onb-options" id="diet-options">
          ${DIET_OPTIONS.map((o) => `
            <button class="choice diet-choice${o.value === diet ? ' is-selected' : ''}" data-diet="${o.value}" type="button">
              <span class="ch-icon">${o.emoji}</span>
              <span class="ch-text">${t(o.labelKey)}</span>
              <span class="ms ch-arrow">${o.value === diet ? 'check' : 'arrow_forward'}</span>
            </button>
          `).join('')}
        </div>
      </section>

      <section class="baseline-section" id="meat-section">
        <h2 class="baseline-section-title">${t('profile.baseline.meatTitle')}</h2>
        <p class="onb-sub text-mini">${t('profile.baseline.meatSub')}</p>
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
        <div class="baseline-impact" id="impact-card">
          <span class="ms">eco</span>
          <span>${t('profile.baseline.impactPrefix')} <strong id="impact-value">0.0</strong> kg CO₂e</span>
        </div>
      </section>

      <div class="review-error" id="error" hidden></div>
    </div>
    <div class="checkin-footer">
      <button class="btn text-btn-m btn-primary btn-l text-btn-l" id="save">${t('common.save')}</button>
    </div>
  `;

  const meatSection = wrap.querySelector<HTMLElement>('#meat-section')!;
  const meatSlider = wrap.querySelector<HTMLInputElement>('.baseline-slider[data-key="meat"]')!;
  const plantSlider = wrap.querySelector<HTMLInputElement>('.baseline-slider[data-key="plant"]')!;
  const meatPctEl = wrap.querySelector<HTMLElement>('[data-bind="meat-pct"]')!;
  const plantPctEl = wrap.querySelector<HTMLElement>('[data-bind="plant-pct"]')!;

  function showsMeatSliders(): boolean {
    return diet === 'omnivore' || diet === 'flexitarian';
  }
  function refreshMeatVisibility(): void {
    meatSection.hidden = !showsMeatSliders();
  }
  function refreshImpact(): void {
    const v = impactSavedKg(4, baselineFromMeatPct(meatPct)).toFixed(1);
    const el = wrap.querySelector<HTMLElement>('#impact-value');
    if (el) el.textContent = v;
  }
  function setMeat(next: number): void {
    meatPct = Math.max(0, Math.min(100, Math.round(next)));
    meatSlider.value = String(meatPct);
    plantSlider.value = String(100 - meatPct);
    meatPctEl.textContent = meatPct + '%';
    plantPctEl.textContent = (100 - meatPct) + '%';
    refreshImpact();
  }

  refreshMeatVisibility();
  refreshImpact();

  wrap.querySelectorAll<HTMLButtonElement>('.diet-choice').forEach((btn) => {
    btn.addEventListener('click', () => {
      diet = btn.dataset.diet!;
      wrap.querySelectorAll<HTMLButtonElement>('.diet-choice').forEach((b) => {
        const selected = b.dataset.diet === diet;
        b.classList.toggle('is-selected', selected);
        const arrow = b.querySelector('.ch-arrow');
        if (arrow) arrow.textContent = selected ? 'check' : 'arrow_forward';
      });
      refreshMeatVisibility();
    });
  });

  meatSlider.addEventListener('input', () => setMeat(Number(meatSlider.value)));
  plantSlider.addEventListener('input', () => setMeat(100 - Number(plantSlider.value)));

  wrap.querySelector('#back-btn')?.addEventListener('click', () => navigate('/profile'));

  const errorEl = wrap.querySelector<HTMLElement>('#error')!;
  const saveBtn = wrap.querySelector<HTMLButtonElement>('#save')!;
  saveBtn.addEventListener('click', () => { void doSave(); });

  async function doSave(): Promise<void> {
    errorEl.hidden = true;
    const u = $user.get();
    if (!u) {
      navigate('/login');
      return;
    }
    saveBtn.disabled = true;
    saveBtn.textContent = t('common.saving');
    try {
      const patch: { diet_type: string; baseline?: string } = { diet_type: diet };
      if (showsMeatSliders()) {
        patch.baseline = JSON.stringify(baselineFromMeatPct(meatPct));
      }
      await updateProfile(u.id, patch);
      const refreshed = await getUserFull(u.id);
      if (refreshed) $profile.set(refreshed);
      navigate('/profile');
    } catch (e) {
      errorEl.hidden = false;
      errorEl.textContent = (e as Error).message ?? '儲存失敗';
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = t('common.save');
    }
  }

  return wrap;
}

function parseBaseline(raw: string | null | undefined): Baseline | null {
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw) as Partial<Baseline>;
    const beef    = clamp01(Number(obj.beef    ?? 0));
    const pork    = clamp01(Number(obj.pork    ?? 0));
    const lamb    = clamp01(Number(obj.lamb    ?? 0));
    const chicken = clamp01(Number(obj.chicken ?? 0));
    const plant = obj.plant !== undefined
      ? clamp01(Number(obj.plant))
      : Math.max(0, 1 - (beef + pork + lamb + chicken));
    return { beef, pork, lamb, chicken, plant };
  } catch {
    return null;
  }
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}
