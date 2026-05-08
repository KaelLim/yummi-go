/**
 * Check-in failure screen — shown when the user confirms 是 to "這是肉嗎".
 *
 * Records meal_fail:{slot} into daily_progress so /profile can later
 * surface 容錯次數. Try Again returns to /check-in (resetting the draft);
 * 回首頁 backs out entirely.
 */
import { navigate } from '@/router';
import { resetCheckin, $checkin } from '@/store/checkin';
import { markMissionDone } from '@/store/today';

const MEAL_SLOT: Record<number, string> = {
  1: 'breakfast',
  2: 'lunch',
  3: 'dinner',
};

export default function fail(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'checkin-screen checkin-fail';
  wrap.innerHTML = `
    <div class="fail-body">
      <div class="fail-emoji" aria-hidden="true">🍖🚫</div>
      <h1 class="fail-title">蔬食餐不能有肉</h1>
      <p class="fail-text">嗚嗚嗚嗚嗚⋯⋯<br/>下一餐記得不能吃肉哦～</p>
      <div class="fail-actions">
        <button class="btn text-btn-m btn-secondary btn-l text-btn-l" id="try-again">Try Again</button>
        <button class="btn text-btn-m btn-primary btn-l text-btn-l" id="go-home">回首頁</button>
      </div>
    </div>
  `;

  const slot = MEAL_SLOT[$checkin.get().mealIndex] ?? 'lunch';
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
