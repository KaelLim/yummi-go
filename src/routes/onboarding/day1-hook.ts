/**
 * Onboarding step 4 — Day-1 hook (the "you got an egg" celebration).
 *
 * Placed right after purpose so the user gets the egg-acquisition moment
 * once they have a clear motivation (diet + baseline + purpose are set).
 * Egg is tinted by diet_type, copy is keyed by purpose. challenge_level
 * is intentionally absent here — it's picked after the user's first
 * check-in, not during onboarding.
 *
 * CTA leads to /onboarding/eat-times (next setup step). The actual pet
 * naming happens later at /onboarding/pet-name once the user has
 * configured eating times.
 */
import { navigate } from '@/router';
import { createProgress } from '@/components/Progress';
import { $profile } from '@/store/user';
import { $onboardingDraft } from '@/store/onboarding-draft';

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
  const purpose = p?.purpose ?? d.purpose;
  const tint = (dietType && DIET_TINT[dietType]) ?? 'neutral';
  const purposeLine = PURPOSE_LINES[purpose ?? ''] ?? '跟著精靈一起探索蔬食。';

  wrap.innerHTML = `
    <div class="onb-header">
      <div class="onb-back" id="back-btn"><span class="ms">arrow_back</span></div>
      ${createProgress(4, 5).outerHTML}
    </div>
    <div class="day1-body">
      <div class="fog-overlay"></div>
      <div class="day1-egg" data-tint="${tint}">🥚</div>
      <div class="day1-content">
        <h1 class="day1-title">你獲得了一顆守護者蛋</h1>
        <ul class="day1-rules">
          <li>📅 30 天連續挑戰</li>
          <li>🎯 ${purposeLine}</li>
        </ul>
        <p class="day1-text">
          蛋殼裡的精靈正等待你<br/>
          先完成接下來的設定，再為這顆蛋取個名字
        </p>
        <button class="btn text-btn-m btn-primary btn-l text-btn-l" id="enter-btn">
          繼續設定
          <span class="ms">arrow_forward</span>
        </button>
      </div>
    </div>
  `;

  wrap.querySelector('#back-btn')?.addEventListener('click', () => {
    navigate('/onboarding/purpose');
  });
  wrap.querySelector('#enter-btn')?.addEventListener('click', () => {
    navigate('/onboarding/pet-name');
  });

  return wrap;
}
