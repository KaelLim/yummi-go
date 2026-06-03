/**
 * 基本飲食 editor — combines a diet-type picker (vegan / vegetarian /
 * flexitarian / omnivore) with the meat-ratio sliders.
 *
 * Diet picker is always visible. The meat sliders only render when the
 * currently-picked diet is omnivore or flexitarian — vegan and
 * vegetarian users don't have a meat baseline to tune, so showing the
 * sliders would be misleading. Save persists `diet_type` always and
 * `baseline` only when the sliders are showing.
 */
import { navigate } from '@/router';
import { $user, $profile } from '@/store/user';
import { updateProfile, getUserFull } from '@/api/profile';
import { impactSavedKg, type Baseline } from '@/lib/baseline-impact';
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

const BASELINE_KEYS: Array<keyof Baseline> = ['beef', 'pork', 'lamb', 'chicken', 'plant'];

const MEAT_TYPES: Array<{ key: keyof Baseline; emoji: string; labelKey: string }> = [
  { key: 'beef',    emoji: '🐄', labelKey: 'onb.baseline.meatBeef' },
  { key: 'pork',    emoji: '🐖', labelKey: 'onb.baseline.meatPork' },
  { key: 'lamb',    emoji: '🐑', labelKey: 'onb.baseline.meatLamb' },
  { key: 'chicken', emoji: '🐓', labelKey: 'onb.baseline.meatChicken' },
  { key: 'plant',   emoji: '🌱', labelKey: 'onb.baseline.plant' },
];

const DEFAULT_BASELINE: Baseline = { beef: 0.15, pork: 0.25, lamb: 0.05, chicken: 0.35, plant: 0.2 };

export default function baselineEditor(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'baseline-screen';

  const profile = $profile.get();
  let diet: string = profile?.diet_type ?? 'omnivore';
  const baseline: Baseline = parseBaseline(profile?.baseline) ?? { ...DEFAULT_BASELINE };

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
          ${MEAT_TYPES.map((m) => `
            <div class="baseline-row" data-key="${m.key}">
              <div class="baseline-label">
                <span class="baseline-emoji">${m.emoji}</span>
                <span class="baseline-name">${t(m.labelKey)}</span>
                <span class="baseline-value" data-value="${m.key}">${Math.round((baseline[m.key] ?? 0) * 100)}%</span>
              </div>
              <input type="range" min="0" max="100" value="${Math.round((baseline[m.key] ?? 0) * 100)}" class="baseline-slider" data-slider="${m.key}" />
            </div>
          `).join('')}
        </div>
        <div class="baseline-total" id="total-row">
          <span>${t('onb.baseline.total')}</span>
          <span id="total-pct">0%</span>
        </div>
        <p class="baseline-hint" id="total-hint">${t('profile.baseline.gate')}</p>
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

  function showsMeatSliders(): boolean {
    return diet === 'omnivore' || diet === 'flexitarian';
  }

  function refreshMeatVisibility(): void {
    meatSection.hidden = !showsMeatSliders();
  }

  function refreshImpact(): void {
    const v = impactSavedKg(4, baseline).toFixed(1);
    const el = wrap.querySelector<HTMLElement>('#impact-value');
    if (el) el.textContent = v;
  }

  function totalIntPct(): number {
    return BASELINE_KEYS.reduce((a, k) => a + Math.round((baseline[k] ?? 0) * 100), 0);
  }

  function refreshTotal(): void {
    const total = totalIntPct();
    const totalEl = wrap.querySelector<HTMLElement>('#total-pct');
    if (totalEl) totalEl.textContent = total + '%';
    const totalRow = wrap.querySelector('#total-row');
    totalRow?.classList.toggle('is-ok',   total === 100);
    totalRow?.classList.toggle('is-over', total > 100);
    const hint = wrap.querySelector('#total-hint');
    if (hint) {
      hint.textContent = total === 100
        ? t('onb.baseline.hint.ok')
        : total > 100
          ? t('onb.baseline.hint.over').replace('{n}', String(total - 100))
          : t('onb.baseline.hint.short').replace('{n}', String(100 - total));
    }
    // Disable save when sliders are showing and total isn't 100%. Diet-only
    // saves (vegan/vegetarian) skip this gate — no sliders to be wrong.
    const btn = wrap.querySelector<HTMLButtonElement>('#save');
    if (btn) btn.disabled = showsMeatSliders() && total !== 100;
  }

  refreshMeatVisibility();
  refreshImpact();
  refreshTotal();

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
      refreshTotal(); // re-evaluate save-button enabled state after diet change
    });
  });

  wrap.querySelectorAll<HTMLInputElement>('.baseline-slider').forEach((slider) => {
    slider.addEventListener('input', () => {
      const key = slider.dataset.slider as keyof Baseline;
      baseline[key] = Number(slider.value) / 100;
      const valueEl = wrap.querySelector<HTMLElement>(`[data-value="${key}"]`);
      if (valueEl) valueEl.textContent = Math.round(baseline[key] * 100) + '%';
      refreshImpact();
      refreshTotal();
    });
  });

  wrap.querySelector('#back-btn')?.addEventListener('click', () => navigate('/profile'));

  const errorEl = wrap.querySelector<HTMLElement>('#error')!;
  const saveBtn = wrap.querySelector<HTMLButtonElement>('#save')!;
  saveBtn.addEventListener('click', () => {
    void doSave();
  });

  async function doSave(): Promise<void> {
    errorEl.hidden = true;
    const u = $user.get();
    if (!u) {
      navigate('/login');
      return;
    }
    if (showsMeatSliders() && totalIntPct() !== 100) {
      errorEl.hidden = false;
      errorEl.textContent = t('profile.baseline.errAmt');
      return;
    }
    saveBtn.disabled = true;
    saveBtn.textContent = t('common.saving');
    try {
      const patch: { diet_type: string; baseline?: string } = { diet_type: diet };
      if (showsMeatSliders()) {
        patch.baseline = JSON.stringify(baseline);
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
    // Back-compat: older baselines pre-date the 蔬食 slider. Derive the
    // plant ratio from "remainder of 100%" when absent so the new 5th
    // row pre-fills sensibly on first edit.
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
