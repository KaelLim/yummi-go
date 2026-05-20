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

interface DietOption {
  value: string;
  emoji: string;
  label: string;
}

const DIET_OPTIONS: DietOption[] = [
  { value: 'vegan',        emoji: '🌱', label: 'Vegan 純素' },
  { value: 'vegetarian',   emoji: '🥚', label: 'Vegetarian 蛋奶素' },
  { value: 'flexitarian',  emoji: '🥗', label: 'Flexitarian 有時不吃肉' },
  { value: 'omnivore',     emoji: '🍖', label: 'Omnivore 無肉不歡' },
];

const MEAT_TYPES: Array<{ key: keyof Baseline; emoji: string; label: string }> = [
  { key: 'beef', emoji: '🐄', label: '牛肉' },
  { key: 'pork', emoji: '🐖', label: '豬肉' },
  { key: 'lamb', emoji: '🐑', label: '羊肉' },
  { key: 'chicken', emoji: '🐓', label: '雞肉' },
];

const DEFAULT_BASELINE: Baseline = { beef: 0.2, pork: 0.3, lamb: 0.0, chicken: 0.5 };

export default function baselineEditor(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'baseline-screen';

  const profile = $profile.get();
  let diet: string = profile?.diet_type ?? 'omnivore';
  const baseline: Baseline = parseBaseline(profile?.baseline) ?? { ...DEFAULT_BASELINE };

  wrap.innerHTML = `
    <header class="checkin-header">
      <button class="checkin-back" id="back-btn" aria-label="返回">
        <span class="ms">arrow_back</span>
      </button>
      <span class="checkin-title">基本飲食</span>
      <span></span>
    </header>
    <div class="checkin-body">
      <section class="baseline-section">
        <h2 class="baseline-section-title">你的飲食習慣</h2>
        <p class="onb-sub text-mini">隨時可以重新選擇 — 每日提示與減碳估算會跟著調整。</p>
        <div class="onb-options" id="diet-options">
          ${DIET_OPTIONS.map((o) => `
            <button class="choice diet-choice${o.value === diet ? ' is-selected' : ''}" data-diet="${o.value}" type="button">
              <span class="ch-icon">${o.emoji}</span>
              <span class="ch-text">${o.label}</span>
              <span class="ms ch-arrow">${o.value === diet ? 'check' : 'arrow_forward'}</span>
            </button>
          `).join('')}
        </div>
      </section>

      <section class="baseline-section" id="meat-section">
        <h2 class="baseline-section-title">原本的肉類飲食</h2>
        <p class="onb-sub text-mini">調整每種肉的比例，會影響減碳估算。</p>
        <div class="baseline-list" id="baseline-list">
          ${MEAT_TYPES.map((t) => `
            <div class="baseline-row" data-key="${t.key}">
              <div class="baseline-label">
                <span class="baseline-emoji">${t.emoji}</span>
                <span class="baseline-name">${t.label}</span>
                <span class="baseline-value" data-value="${t.key}">${Math.round(baseline[t.key] * 100)}%</span>
              </div>
              <input type="range" min="0" max="100" value="${Math.round(baseline[t.key] * 100)}" class="baseline-slider" data-slider="${t.key}" />
            </div>
          `).join('')}
        </div>
        <div class="baseline-impact" id="impact-card">
          <span class="ms">eco</span>
          <span>每 4kg 飲食量約可減碳 <strong id="impact-value">0.0</strong> kg CO₂e</span>
        </div>
      </section>

      <div class="review-error" id="error" hidden></div>
    </div>
    <div class="checkin-footer">
      <button class="btn text-btn-m btn-primary btn-l text-btn-l" id="save">儲存</button>
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

  wrap.querySelectorAll<HTMLInputElement>('.baseline-slider').forEach((slider) => {
    slider.addEventListener('input', () => {
      const key = slider.dataset.slider as keyof Baseline;
      baseline[key] = Number(slider.value) / 100;
      const valueEl = wrap.querySelector<HTMLElement>(`[data-value="${key}"]`);
      if (valueEl) valueEl.textContent = Math.round(baseline[key] * 100) + '%';
      refreshImpact();
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
    saveBtn.disabled = true;
    saveBtn.textContent = '儲存中…';
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
      saveBtn.textContent = '儲存';
    }
  }

  return wrap;
}

function parseBaseline(raw: string | null | undefined): Baseline | null {
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw) as Partial<Baseline>;
    return {
      beef: clamp01(Number(obj.beef ?? 0)),
      pork: clamp01(Number(obj.pork ?? 0)),
      lamb: clamp01(Number(obj.lamb ?? 0)),
      chicken: clamp01(Number(obj.chicken ?? 0)),
    };
  } catch {
    return null;
  }
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}
