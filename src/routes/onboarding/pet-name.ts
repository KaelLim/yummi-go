/**
 * Onboarding step 9 — Pet name.
 *
 * Last screen before /register. Stores the chosen name into the draft so
 * it can be passed as `display_name` when the account is finally created.
 * Returning users (already logged in) skip the draft path entirely — drust
 * already holds their display_name and going through this screen again
 * doesn't make sense, so we send them home.
 */
import { navigate } from '@/router';
import { $user } from '@/store/user';
import { $onboardingDraft, patchDraft } from '@/store/onboarding-draft';
import { createProgress } from '@/components/Progress';

const DEFAULT_NAME = '小綠';

export default function petName(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'onb-screen';
  const draft = $onboardingDraft.get();
  const initial = draft.pet_name ?? DEFAULT_NAME;

  wrap.innerHTML = `
    <div class="onb-header">
      <div class="onb-back" id="back-btn"><span class="ms">arrow_back</span></div>
      ${createProgress(8, 8).outerHTML}
    </div>
    <div class="onb-body">
      <div class="day1-egg" data-tint="neutral" style="font-size:64px;margin:0 auto;">🥚</div>
      <h1 class="onb-title text-h2">為你的守護者取名</h1>
      <p class="onb-sub text-mini">這個名字會跟著你走完 30 天的挑戰</p>
      <label class="field">
        <span class="field-label text-mini">寵物名稱</span>
        <input class="input" id="pet-name-input" type="text" maxlength="20" value="${escapeHtml(initial)}" />
      </label>
      <div class="auth-error" id="pet-name-error" hidden></div>
      <div class="grow"></div>
      <button class="btn text-btn-m btn-primary btn-l text-btn-l" id="continue-btn">下一步</button>
    </div>
  `;

  wrap.querySelector('#back-btn')?.addEventListener('click', () => navigate('/onboarding/day1-hook'));

  const input = wrap.querySelector<HTMLInputElement>('#pet-name-input')!;
  const error = wrap.querySelector<HTMLElement>('#pet-name-error')!;

  wrap.querySelector('#continue-btn')?.addEventListener('click', () => {
    const u = $user.get();
    if (u) { navigate('/home'); return; }
    const name = input.value.trim();
    if (!name) {
      error.hidden = false;
      error.textContent = '請為你的守護者取個名字';
      return;
    }
    patchDraft({ pet_name: name });
    navigate('/register');
  });

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
