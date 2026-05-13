/**
 * Post-first-check-in step — Daily meal times.
 *
 * Pulled out of the onboarding chain so the user only sets meal times
 * after they've experienced a real check-in (challenge-level → here →
 * /home is the post-first-check-in pair). No progress dots — this isn't
 * presented as part of an N-of-M flow anymore.
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
import { $user, $profile } from '@/store/user';
import { updateProfile, getUserFull } from '@/api/profile';
import { patchDraft } from '@/store/onboarding-draft';
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
    </div>
    <div class="onb-body">
      <h1 class="onb-title text-h2">用餐時間</h1>
      <p class="onb-sub text-mini">設定後我們會在用餐前 10 分鐘提醒你打卡，不吃某餐可用 ✕ 移除</p>
      <div class="meal-list" id="meal-list"></div>
      <button class="btn text-btn-m btn-primary btn-l text-btn-l" id="continue-btn">完成設定</button>
    </div>
  `;

  wrap.querySelector('#back-btn')?.addEventListener('click', () =>
    navigate('/home'),
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
      // Refresh $profile so home / meal-notifier read the new schedule
      // immediately instead of waiting for the next bootstrap.
      void getUserFull(u.id).then((full) => { if (full) $profile.set(full); });
    } else {
      patchDraft({ eat_times: eatTimesJson });
    }
    void requestMealNotificationPermission();
    // Post-check-in step: the user is already logged in (this screen only
    // shows after a real check-in). The `/register` fallback stays as a
    // defensive path in case someone reaches here without $user — that
    // path then drains the draft on register.
    navigate(u ? '/home' : '/register');
  });

  return wrap;
}
