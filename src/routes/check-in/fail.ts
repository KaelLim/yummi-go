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
import { t } from '@/lib/i18n';

const MEAL_SLOT: Record<number, string> = {
  1: 'breakfast',
  2: 'lunch',
  3: 'dinner',
};

const NEXT_MEAL_KEY: Record<number, string> = {
  1: 'checkin.nextMeal2',
  2: 'checkin.nextMeal3',
  3: 'checkin.nextMealTmrw',
};

export default function fail(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'checkin-screen checkin-fail';
  const mealIdx = $checkin.get().mealIndex;
  const nextMeal = NEXT_MEAL_KEY[mealIdx]
    ? t(NEXT_MEAL_KEY[mealIdx])
    : t('checkin.nextMealDefault');

  wrap.innerHTML = `
    <div class="fail-body">
      <div class="fail-emoji" aria-hidden="true">🌱✨</div>
      <h1 class="fail-title">${t('checkin.failHeading').replace('{next}', nextMeal)}</h1>
      <p class="fail-text">${t('checkin.failExplain').replace(/\{next\}/g, nextMeal)}</p>
      <div class="fail-actions">
        <button class="btn text-btn-m btn-secondary btn-l text-btn-l" id="try-again">${t('checkin.failTryAgain')}</button>
        <button class="btn text-btn-m btn-primary btn-l text-btn-l" id="go-home">${t('checkin.failHome')}</button>
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
