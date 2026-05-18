/**
 * Onboarding tail — First check-in prompt.
 *
 * Sits between pet-name and the actual /check-in capture. Reminds the user
 * that the freshly-named egg is hungry and the first check-in unlocks it.
 * Reuses day1-hook's egg/title/body classes so the visual reads as the
 * same celebration family.
 *
 * Primary CTA → /check-in. Skip link → /home for users who can't take a
 * meal photo right now (they can start a check-in later from the home
 * tab bar).
 */
import { navigate } from '@/router';
import { $user, $profile } from '@/store/user';
import { $onboardingDraft } from '@/store/onboarding-draft';

const DIET_TINT: Record<string, string> = {
  vegan: 'vegan',
  vegetarian: 'vegetarian',
  flexitarian: 'flexitarian',
  omnivore: 'omnivore',
};

export default function startCheckin(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'onb-screen day1';

  const u = $user.get();
  const p = $profile.get();
  const draft = $onboardingDraft.get();
  const dietType = p?.diet_type ?? draft.diet_type;
  const tint = (dietType && DIET_TINT[dietType]) ?? 'neutral';
  const petName = u?.displayName ?? draft.pet_name ?? '你的守護者';

  wrap.innerHTML = `
    <div class="onb-header">
      <div class="onb-back" id="back-btn"><span class="ms">arrow_back</span></div>
    </div>
    <div class="day1-body">
      <div class="day1-egg" data-tint="${tint}">🥚</div>
      <div class="day1-content">
        <h1 class="day1-title">${escapeHtml(petName)} 餓了！</h1>
        <p class="day1-text">
          完成第一次打卡，把今天的蔬食拍給 ${escapeHtml(petName)} 看 —<br/>
          孵化的能量就在你的下一餐裡。
        </p>
        <button class="btn text-btn-m btn-primary btn-l text-btn-l" id="start-btn">
          開始打卡
          <span class="ms">arrow_forward</span>
        </button>
        <button class="btn-skip" id="skip-btn" type="button">稍後再打卡</button>
      </div>
    </div>
  `;

  wrap.querySelector('#back-btn')?.addEventListener('click', () =>
    navigate('/onboarding/pet-name'),
  );
  wrap.querySelector('#start-btn')?.addEventListener('click', () =>
    navigate('/check-in'),
  );
  wrap.querySelector('#skip-btn')?.addEventListener('click', () =>
    navigate('/home'),
  );

  return wrap;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;'
      : c === '<' ? '&lt;'
      : c === '>' ? '&gt;'
      : c === '"' ? '&quot;'
      : '&#39;',
  );
}
