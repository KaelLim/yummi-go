/**
 * Onboarding step 5 — Daily meal times.
 *
 * Three meals (breakfast / lunch / dinner) with time pickers. Each row can
 * be turned off with ✕ (users who skip a meal) and re-added later with +.
 * At least one meal must stay active so the notifier has something to fire
 * on; the ✕ on the only remaining active row is hidden. The JSON written
 * to user_profiles.eat_times contains only active meals — downstream code
 * (meal-notifier, computeMatchKey) iterates by key, so omission naturally
 * skips the disabled meals.
 */
import { navigate } from '@/router';
import { $user } from '@/store/user';
import { updateProfile } from '@/api/profile';
import { patchDraft } from '@/store/onboarding-draft';
import { createProgress } from '@/components/Progress';
import { requestMealNotificationPermission } from '@/lib/meal-notifier';

interface MealDef {
  key: string;
  emoji: string;
  label: string;
  defaultTime: string;
}

const MEALS: MealDef[] = [
  { key: 'breakfast', emoji: '🌅', label: '早餐', defaultTime: '08:00' },
  { key: 'lunch',     emoji: '☀️', label: '午餐', defaultTime: '12:30' },
  { key: 'dinner',    emoji: '🌙', label: '晚餐', defaultTime: '19:00' },
];

export default function eatTimes(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'onb-screen';

  // Times are preserved across enable/disable cycles so a user who removes
  // and re-adds breakfast doesn't have to retype 08:00.
  const times: Record<string, string> = Object.fromEntries(
    MEALS.map((m) => [m.key, m.defaultTime]),
  );
  const disabled = new Set<string>();

  wrap.innerHTML = `
    <div class="onb-header">
      <div class="onb-back" id="back-btn"><span class="ms">arrow_back</span></div>
      ${createProgress(6, 6).outerHTML}
    </div>
    <div class="onb-body">
      <h1 class="onb-title text-h2">用餐時間</h1>
      <p class="onb-sub text-mini">我們會在用餐前 10 分鐘提醒你打卡，不吃某餐可用 ✕ 移除</p>
      <div class="meal-list" id="meal-list"></div>
      <button class="btn text-btn-m btn-primary btn-l text-btn-l" id="continue-btn">繼續</button>
    </div>
  `;

  wrap.querySelector('#back-btn')?.addEventListener('click', () =>
    navigate('/onboarding/pet-name'),
  );

  function renderList(): void {
    const list = wrap.querySelector<HTMLElement>('#meal-list');
    if (!list) return;

    const activeCount = MEALS.length - disabled.size;

    list.innerHTML = MEALS.map((m) => {
      const isOff = disabled.has(m.key);
      if (isOff) {
        return `
          <div class="meal-row meal-row-off" data-key="${m.key}">
            <span class="meal-emoji" style="opacity:.35">${m.emoji}</span>
            <span class="meal-label" style="opacity:.35">${m.label}</span>
            <button class="btn-skip" data-action="enable" data-key="${m.key}" type="button">+ 加回</button>
          </div>
        `;
      }
      // Show ✕ only when there's another meal still active. Disabling the
      // last meal would leave the notifier with nothing to fire on.
      const removable = activeCount > 1;
      return `
        <div class="meal-row" data-key="${m.key}">
          <span class="meal-emoji">${m.emoji}</span>
          <span class="meal-label">${m.label}</span>
          <input type="time" class="meal-input" data-key="${m.key}" value="${times[m.key]}" />
          ${
            removable
              ? `<button class="meal-remove" data-action="disable" data-key="${m.key}" type="button" aria-label="移除${m.label}"><span class="ms">close</span></button>`
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

  wrap.querySelector('#continue-btn')?.addEventListener('click', async () => {
    const u = $user.get();
    const activeTimes: Record<string, string> = {};
    for (const m of MEALS) {
      if (!disabled.has(m.key)) activeTimes[m.key] = times[m.key];
    }
    const eatTimesJson = JSON.stringify(activeTimes);
    if (u) {
      try {
        await updateProfile(u.id, { eat_times: eatTimesJson });
      } catch {
        /* soft fail */
      }
    } else {
      patchDraft({ eat_times: eatTimesJson });
    }
    void requestMealNotificationPermission();
    // Last onboarding step: logged-in users (returning visitors) jump
    // straight to /home; guests hand off to /register to create an
    // account, which then drains the draft onto the new user row.
    navigate(u ? '/home' : '/register');
  });

  return wrap;
}
