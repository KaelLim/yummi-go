/**
 * Onboarding step 6 — Day-1 hook.
 *
 * Closing scene of onboarding: a fog-shrouded egg waiting to be hatched.
 * The single CTA stamps `users.challenge_started_at` in drust (and mirrors
 * to $ui.challengeStartedAt for the in-flight session) and sends the user
 * straight to /check-in to make their first capture.
 */
import { navigate } from '@/router';
import { createProgress } from '@/components/Progress';
import { setChallengeStartedAt } from '@/store/ui';
import { $user } from '@/store/user';

export default function day1Hook(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'onb-screen day1';
  wrap.innerHTML = `
    <div class="onb-header">
      ${createProgress(6, 6).outerHTML}
    </div>
    <div class="day1-body">
      <div class="fog-overlay"></div>
      <div class="day1-egg">🥚</div>
      <div class="day1-content">
        <h1 class="day1-title">守護者氣息微弱…</h1>
        <p class="day1-text">
          灰霧濃重，蛋殼裡的精靈正等待你<br/>
          請立刻開始你的第一次打卡！
        </p>
        <button class="btn text-btn-m btn-primary btn-l text-btn-l" id="enter-btn">
          <span class="ms">photo_camera</span>
          開始打卡
        </button>
      </div>
    </div>
  `;

  wrap.querySelector('#enter-btn')?.addEventListener('click', () => {
    const u = $user.get();
    if (u) void setChallengeStartedAt(u.id);
    navigate('/check-in');
  });

  return wrap;
}
