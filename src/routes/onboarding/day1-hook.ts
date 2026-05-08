/**
 * Onboarding step 8 — Day-1 hook.
 *
 * Final scene: tinted egg keyed by diet_type, challenge rule keyed by
 * challenge_level, purpose one-liner keyed by user_profiles.purpose. The
 * CTA stamps users.challenge_started_at via drust and routes to /check-in.
 */
import { navigate } from '@/router';
import { createProgress } from '@/components/Progress';
import { setChallengeStartedAt } from '@/store/ui';
import { $user, $profile } from '@/store/user';

const LEVEL_RULES: Record<number, string> = {
  1: '每天 1 餐無肉就算達標',
  2: '三餐無肉，3 次容錯機會',
  3: '三餐無肉，零容錯，極限意志力',
};

const PURPOSE_LINES: Record<string, string> = {
  body: '為了照顧自己的身體，從一餐開始。',
  environment: '每替代一公斤肉，地球少燒 60 kg CO₂。',
  vow: '每一餐都是寫給未來的承諾。',
};

const DIET_TINT: Record<string, string> = {
  vegan: 'vegan',
  vegetarian: 'vegetarian',
  flexitarian: 'flexitarian',
  omnivore: 'omnivore',
};

export default function day1Hook(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'onb-screen day1';
  const p = $profile.get();
  const tint = (p?.diet_type && DIET_TINT[p.diet_type]) ?? 'neutral';
  const ruleLine = LEVEL_RULES[p?.challenge_level ?? 0] ?? '依你選擇的步調挑戰 30 天。';
  const purposeLine = PURPOSE_LINES[p?.purpose ?? ''] ?? '跟著精靈一起探索蔬食。';

  wrap.innerHTML = `
    <div class="onb-header">
      ${createProgress(8, 8).outerHTML}
    </div>
    <div class="day1-body">
      <div class="fog-overlay"></div>
      <div class="day1-egg" data-tint="${tint}">🥚</div>
      <div class="day1-content">
        <h1 class="day1-title">你獲得了一顆守護者蛋</h1>
        <ul class="day1-rules">
          <li>📅 30 天連續挑戰</li>
          <li>🥗 ${ruleLine}</li>
          <li>🎯 ${purposeLine}</li>
        </ul>
        <p class="day1-text">
          灰霧濃重，蛋殼裡的精靈正等待你<br/>
          請立即開始你的第一次打卡！
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
