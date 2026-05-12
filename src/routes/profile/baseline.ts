/**
 * Baseline editor — same sliders as onboarding/baseline, but reads the
 * existing user_profiles.baseline JSON, lets the user re-tune, and writes
 * back. The CO2 estimate updates live so the user sees the impact of
 * adjusting their assumed meat ratios.
 */
import { navigate } from '@/router';
import { $user, $profile } from '@/store/user';
import { updateProfile, getUserFull } from '@/api/profile';
import { impactSavedKg, type Baseline } from '@/lib/baseline-impact';

const TYPES: Array<{ key: keyof Baseline; emoji: string; label: string }> = [
  { key: 'beef', emoji: '🐄', label: '牛肉' },
  { key: 'pork', emoji: '🐖', label: '豬肉' },
  { key: 'lamb', emoji: '🐑', label: '羊肉' },
  { key: 'chicken', emoji: '🐓', label: '雞肉' },
];

export default function baselineEditor(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'baseline-screen';

  // Vegan / vegetarian users don't have a meat baseline — bounce them back.
  const diet = $profile.get()?.diet_type;
  if (diet === 'vegan' || diet === 'vegetarian') {
    queueMicrotask(() => navigate('/profile'));
    return wrap;
  }

  const initial: Baseline = parseBaseline($profile.get()?.baseline) ?? {
    beef: 0.2,
    pork: 0.3,
    lamb: 0.0,
    chicken: 0.5,
  };
  const state: Baseline = { ...initial };

  wrap.innerHTML = `
    <header class="checkin-header">
      <button class="checkin-back" id="back-btn" aria-label="返回">
        <span class="ms">arrow_back</span>
      </button>
      <span class="checkin-title">基準飲食</span>
      <span></span>
    </header>
    <div class="checkin-body">
      <p class="onb-sub text-mini">調整每種肉的比例，會影響挑戰結束時的減碳估算。</p>
      <div class="baseline-list" id="baseline-list">
        ${TYPES.map(
          (t) => `
          <div class="baseline-row" data-key="${t.key}">
            <div class="baseline-label">
              <span class="baseline-emoji">${t.emoji}</span>
              <span class="baseline-name">${t.label}</span>
              <span class="baseline-value" data-value="${t.key}">${Math.round(state[t.key] * 100)}%</span>
            </div>
            <input type="range" min="0" max="100" value="${Math.round(state[t.key] * 100)}" class="baseline-slider" data-slider="${t.key}" />
          </div>`,
        ).join('')}
      </div>
      <div class="baseline-impact" id="impact-card">
        <span class="ms">eco</span>
        <span>每 4kg 飲食量約可減碳 <strong id="impact-value">0.0</strong> kg CO₂e</span>
      </div>
      <div class="review-error" id="error" hidden></div>
    </div>
    <div class="checkin-footer">
      <button class="btn text-btn-m btn-primary btn-l text-btn-l" id="save">儲存</button>
    </div>
  `;

  function refreshImpact() {
    const v = impactSavedKg(4, state).toFixed(1);
    const el = wrap.querySelector<HTMLElement>('#impact-value');
    if (el) el.textContent = v;
  }
  refreshImpact();

  wrap.querySelectorAll<HTMLInputElement>('.baseline-slider').forEach((slider) => {
    slider.addEventListener('input', () => {
      const key = slider.dataset.slider as keyof Baseline;
      state[key] = Number(slider.value) / 100;
      const valueEl = wrap.querySelector<HTMLElement>(`[data-value="${key}"]`);
      if (valueEl) valueEl.textContent = Math.round(state[key] * 100) + '%';
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
      await updateProfile(u.id, { baseline: JSON.stringify(state) });
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
