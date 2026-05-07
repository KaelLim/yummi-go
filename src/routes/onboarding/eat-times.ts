/**
 * Onboarding step 5 — Daily meal times.
 *
 * Three <input type="time"> pickers (breakfast / lunch / dinner) seeded with
 * sensible defaults. Continue stores the JSON-encoded { breakfast, lunch,
 * dinner } map into user_profiles.eat_times so the notifier can fire 10
 * minutes before each meal.
 */
import { navigate } from '@/router';
import { $user } from '@/store/user';
import { updateProfile } from '@/api/profile';
import { createProgress } from '@/components/Progress';

const MEALS = [
  { key: 'breakfast', emoji: '🌅', label: '早餐', defaultTime: '08:00' },
  { key: 'lunch',     emoji: '☀️', label: '午餐', defaultTime: '12:30' },
  { key: 'dinner',    emoji: '🌙', label: '晚餐', defaultTime: '19:00' },
];

export default function eatTimes(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'onb-screen';
  wrap.innerHTML = `
    <div class="onb-header">
      <div class="onb-back" id="back-btn"><span class="ms">arrow_back</span></div>
      ${createProgress(5, 6).outerHTML}
    </div>
    <div class="onb-body">
      <h1 class="onb-title">用餐時間</h1>
      <p class="onb-sub">我們會在用餐前 10 分鐘提醒你打卡</p>
      <div class="meal-list">
        ${MEALS.map(m => `
          <div class="meal-row">
            <span class="meal-emoji">${m.emoji}</span>
            <span class="meal-label">${m.label}</span>
            <input type="time" class="meal-input" data-key="${m.key}" value="${m.defaultTime}" />
          </div>
        `).join('')}
      </div>
      <div class="grow"></div>
      <button class="btn btn-primary btn-l" id="continue-btn">繼續</button>
    </div>
  `;

  wrap.querySelector('#back-btn')?.addEventListener('click', () => navigate('/onboarding/challenge-level'));

  wrap.querySelector('#continue-btn')?.addEventListener('click', async () => {
    const u = $user.get();
    if (!u) { navigate('/login'); return; }
    const eatTimes: Record<string, string> = {};
    wrap.querySelectorAll<HTMLInputElement>('.meal-input').forEach(input => {
      eatTimes[input.dataset.key!] = input.value;
    });
    try { await updateProfile(u.id, { eat_times: JSON.stringify(eatTimes) }); } catch { /* soft fail */ }
    navigate('/onboarding/day1-hook');
  });

  return wrap;
}
