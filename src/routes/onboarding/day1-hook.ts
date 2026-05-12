/**
 * Onboarding step 8 — Day-1 hook.
 *
 * Final scene before pet naming: tinted egg keyed by diet_type, challenge
 * rule keyed by challenge_level, purpose one-liner keyed by purpose. Reads
 * the live profile if the user is already logged in (returning flow) or
 * the in-memory draft otherwise (first-time flow). The CTA advances to the
 * pet-name step — challenge_started_at is stamped later by the flush.
 */
import { navigate } from '@/router';
import { createProgress } from '@/components/Progress';
import { $profile } from '@/store/user';
import { $onboardingDraft } from '@/store/onboarding-draft';

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
  const d = $onboardingDraft.get();
  const dietType = p?.diet_type ?? d.diet_type;
  const challengeLevel = p?.challenge_level ?? d.challenge_level;
  const purpose = p?.purpose ?? d.purpose;
  const tint = (dietType && DIET_TINT[dietType]) ?? 'neutral';
  const ruleLine = LEVEL_RULES[challengeLevel ?? 0] ?? '依你選擇的步調挑戰 30 天。';
  const purposeLine = PURPOSE_LINES[purpose ?? ''] ?? '跟著精靈一起探索蔬食。';

  wrap.innerHTML = `
    <div class="onb-header">
      <div class="onb-back" id="back-btn"><span class="ms">arrow_back</span></div>
      ${createProgress(7, 8).outerHTML}
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
          蛋殼裡的精靈正等待你<br/>
          為這顆蛋取個名字，開始你的旅程
        </p>
        <button class="btn text-btn-m btn-primary btn-l text-btn-l" id="enter-btn">
          為蛋取名
          <span class="ms">arrow_forward</span>
        </button>
      </div>
    </div>
  `;

  wrap.querySelector('#back-btn')?.addEventListener('click', () => {
    navigate('/onboarding/known-from');
  });
  wrap.querySelector('#enter-btn')?.addEventListener('click', () => {
    navigate('/onboarding/pet-name');
  });

  return wrap;
}
