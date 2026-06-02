/**
 * /profile/eat-times — same delete/add-back UI as the onboarding step,
 * reachable from the profile hub so users can adjust their meal schedule
 * any time. Pre-populates from the current profile's `eat_times` JSON
 * (keys present === active, keys absent === disabled). On save → /profile.
 *
 * Sharing logic with onboarding/eat-times would be tidier as a component,
 * but the surface area is small enough that a focused copy reads more
 * clearly than yet-another-shared-helper. If they diverge meaningfully,
 * extract then.
 */
import { navigate } from '@/router';
import { $user, $profile } from '@/store/user';
import { updateProfile, getUserFull } from '@/api/profile';

interface MealDef {
  key: string;
  emoji: string;
  label: string;
  defaultTime: string;
}

const MEALS: MealDef[] = [
  { key: 'breakfast', emoji: '🌅', label: '第一餐', defaultTime: '08:00' },
  { key: 'lunch',     emoji: '☀️', label: '第二餐', defaultTime: '12:30' },
  { key: 'dinner',    emoji: '🌙', label: '第三餐', defaultTime: '19:00' },
];

function parseStored(raw: string | null | undefined): Record<string, string> | null {
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw) as Record<string, string>;
    return obj && typeof obj === 'object' ? obj : null;
  } catch {
    return null;
  }
}

export default function eatTimesEditor(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'baseline-screen';

  const stored = parseStored($profile.get()?.eat_times);
  // Times persist across enable/disable cycles so re-adding a removed
  // meal restores the user's last picked time rather than the default.
  const times: Record<string, string> = Object.fromEntries(
    MEALS.map((m) => [m.key, stored?.[m.key] ?? m.defaultTime]),
  );
  const disabled = new Set<string>();
  if (stored) {
    for (const m of MEALS) if (!(m.key in stored)) disabled.add(m.key);
  }

  wrap.innerHTML = `
    <header class="checkin-header">
      <button class="checkin-back" id="back-btn" aria-label="返回">
        <span class="ms">arrow_back</span>
      </button>
      <span class="checkin-title">用餐時間</span>
      <span></span>
    </header>
    <div class="checkin-body">
      <section class="baseline-section">
        <p class="onb-sub text-mini">設定後我們會在用餐前 10 分鐘提醒你打卡，不吃某餐可用 ✕ 移除，之後也能再加回來。</p>
        <div class="meal-list" id="meal-list"></div>
      </section>
      <div class="review-error" id="error" hidden></div>
    </div>
    <div class="checkin-footer">
      <button class="btn text-btn-m btn-primary btn-l text-btn-l" id="save">儲存</button>
    </div>
  `;

  function renderList(): void {
    const list = wrap.querySelector<HTMLElement>('#meal-list');
    if (!list) return;
    const activeKeys = MEALS.filter((m) => !disabled.has(m.key)).map((m) => m.key);
    const activeCount = activeKeys.length;
    const ORDINALS = ['第一餐', '第二餐', '第三餐'];
    function activeLabel(key: string): string {
      if (activeCount === 1) return '一餐';
      const idx = activeKeys.indexOf(key);
      return ORDINALS[idx] ?? '';
    }
    list.innerHTML = MEALS.map((m) => {
      const isOff = disabled.has(m.key);
      if (isOff) {
        return `
          <div class="meal-row meal-row-off" data-key="${m.key}">
            <span class="meal-emoji" style="opacity:.35">${m.emoji}</span>
            <button class="btn-skip" data-action="enable" data-key="${m.key}" type="button">+ 加回</button>
          </div>
        `;
      }
      const removable = activeCount > 1;
      const label = activeLabel(m.key);
      return `
        <div class="meal-row" data-key="${m.key}">
          <span class="meal-emoji">${m.emoji}</span>
          <span class="meal-label">${label}</span>
          <input type="time" class="meal-input" data-key="${m.key}" value="${times[m.key]}" />
          ${
            removable
              ? `<button class="meal-remove" data-action="disable" data-key="${m.key}" type="button" aria-label="移除${label}"><span class="ms">close</span></button>`
              : ''
          }
        </div>
      `;
    }).join('');

    list.querySelectorAll<HTMLInputElement>('.meal-input').forEach((input) => {
      input.addEventListener('input', () => {
        times[input.dataset.key!] = input.value;
      });
    });

    list.querySelectorAll<HTMLButtonElement>('button[data-action]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.key!;
        if (btn.dataset.action === 'disable') disabled.add(key);
        else disabled.delete(key);
        renderList();
      });
    });
  }

  renderList();

  wrap.querySelector('#back-btn')?.addEventListener('click', () => navigate('/profile'));

  const errorEl = wrap.querySelector<HTMLElement>('#error')!;
  const saveBtn = wrap.querySelector<HTMLButtonElement>('#save')!;
  saveBtn.addEventListener('click', () => { void doSave(); });

  async function doSave(): Promise<void> {
    errorEl.hidden = true;
    const u = $user.get();
    if (!u) { navigate('/login'); return; }
    const activeTimes: Record<string, string> = {};
    for (const m of MEALS) {
      if (!disabled.has(m.key)) activeTimes[m.key] = times[m.key];
    }
    saveBtn.disabled = true;
    saveBtn.textContent = '儲存中…';
    try {
      await updateProfile(u.id, { eat_times: JSON.stringify(activeTimes) });
      const full = await getUserFull(u.id);
      if (full) $profile.set(full);
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
