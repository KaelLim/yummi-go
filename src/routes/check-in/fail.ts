/**
 * Check-in "next-meal encouragement" screen — shown when the user
 * confirms 是 to "這是肉嗎" (i.e., they're eating meat this meal).
 *
 * Framing is supportive, not failure-coded: we still log meal_fail:{slot}
 * into daily_progress so /profile can surface 容錯次數, but the user-
 * facing copy treats this as "save it for next meal" rather than "you
 * messed up". 換個方式打卡 returns to /check-in (re-shoot, e.g. only
 * the veg side dish); 下次再來 jumps home.
 */
import { navigate } from '@/router';
import { resetCheckin, $checkin } from '@/store/checkin';
import { markMissionDone } from '@/store/today';

const MEAL_SLOT: Record<number, string> = {
  1: 'breakfast',
  2: 'lunch',
  3: 'dinner',
};

const NEXT_MEAL_LABEL: Record<number, string> = {
  1: '午餐',
  2: '晚餐',
  3: '明天早餐',
};

export default function fail(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'checkin-screen checkin-fail';
  const mealIdx = $checkin.get().mealIndex;
  const nextMeal = NEXT_MEAL_LABEL[mealIdx] ?? '下一餐';

  wrap.innerHTML = `
    <div class="fail-body">
      <div class="fail-emoji" aria-hidden="true">🌱✨</div>
      <h1 class="fail-title">${nextMeal}一起加油！</h1>
      <p class="fail-text">
        這餐有肉沒關係，挑戰是慢慢累積的。<br/>
        小綠相信你 ${nextMeal} 可以挑戰無肉打卡 💪
      </p>
      <div class="fail-actions">
        <button class="btn text-btn-m btn-secondary btn-l text-btn-l" id="try-again">換個方式打卡</button>
        <button class="btn text-btn-m btn-primary btn-l text-btn-l" id="go-home">下次再來</button>
      </div>
    </div>
  `;

  const slot = MEAL_SLOT[mealIdx] ?? 'lunch';
  markMissionDone(`meal_fail:${slot}`, 0);

  wrap.querySelector('#try-again')?.addEventListener('click', () => {
    resetCheckin();
    navigate('/check-in');
  });
  wrap.querySelector('#go-home')?.addEventListener('click', () => {
    resetCheckin();
    navigate('/home');
  });

  return wrap;
}
