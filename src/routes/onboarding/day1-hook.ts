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
import { t } from '@/lib/i18n';

const PURPOSE_LINE_KEYS: Record<string, string> = {
  body: 'onb.day1.purpose.body',
  environment: 'onb.day1.purpose.env',
  vow: 'onb.day1.purpose.vow',
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
  const purposeKey = PURPOSE_LINE_KEYS[purpose ?? ''] ?? 'onb.day1.purpose.default';
  const purposeLine = t(purposeKey);

  wrap.innerHTML = `
    <div class="onb-header">
      <div class="onb-back" id="back-btn"><span class="ms">arrow_back</span></div>
      ${createProgress({ current: 4, total: 5 }).outerHTML}
    </div>
    <div class="day1-body">
      <div class="fog-overlay"></div>
      <div class="day1-egg" data-tint="${tint}">🥚</div>
      <div class="day1-content">
        <h1 class="day1-title">${t('onb.day1.title')}</h1>
        <ul class="day1-rules">
          <li>${t('onb.day1.rule.days')}</li>
          <li>🎯 ${purposeLine}</li>
        </ul>
        <p class="day1-text">${t('onb.day1.text')}</p>
        <button class="btn text-btn-m btn-primary btn-l text-btn-l" id="enter-btn">
          ${t('onb.day1.cta')}
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
