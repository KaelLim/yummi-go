/**
 * Onboarding step 3 — Challenge purpose (required).
 *
 * Options are fetched from drust's `challenge_purposes` collection (admin
 * editable via MCP, no UI). The first render shows a loading row; once the
 * list resolves we paint the buttons. If drust is unreachable the helper
 * returns a hardcoded fallback so the user can never get stuck.
 */
import { navigate } from '@/router';
import { $user, $profile } from '@/store/user';
import { updateProfile, type UserProfile } from '@/api/profile';
import { listChallengePurposes, type ChallengePurpose } from '@/api/content';
import { patchDraft, $onboardingDraft } from '@/store/onboarding-draft';
import { createProgress } from '@/components/Progress';

export default function purpose(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'onb-screen';
  wrap.innerHTML = `
    <div class="onb-header">
      <div class="onb-back" id="back-btn"><span class="ms">arrow_back</span></div>
      ${createProgress(3, 6).outerHTML}
    </div>
    <div class="onb-body">
      <h1 class="onb-title text-h2">參加挑戰的目的</h1>
      <p class="onb-sub text-mini">挑戰的方向會影響每日的提示文字</p>
      <div class="onb-options" id="purpose-options">
        <div class="quiz-loading">
          <span class="ms">hourglass_top</span>
          <span>載入中…</span>
        </div>
      </div>
    </div>
  `;

  wrap.querySelector('#back-btn')?.addEventListener('click', () => {
    // Vegan / vegetarian users skipped the meat baseline step on the way in,
    // so going back should land on diet-survey instead.
    const diet = $profile.get()?.diet_type ?? $onboardingDraft.get().diet_type;
    const skipsBaseline = diet === 'vegan' || diet === 'vegetarian';
    navigate(skipsBaseline ? '/onboarding/diet-survey' : '/onboarding/baseline');
  });

  void (async () => {
    const purposes = await listChallengePurposes();
    renderOptions(wrap, purposes);
  })();

  return wrap;
}

function renderOptions(wrap: HTMLElement, purposes: ChallengePurpose[]): void {
  const list = wrap.querySelector<HTMLElement>('#purpose-options');
  if (!list) return;
  list.innerHTML = purposes
    .map(
      (p) => `
        <button class="choice" data-value="${escapeAttr(p.key)}">
          <span class="ch-icon">${escapeHtml(p.emoji ?? '')}</span>
          <span class="ch-text">${escapeHtml(p.label)}</span>
          <span class="ms ch-arrow">arrow_forward</span>
        </button>
      `,
    )
    .join('');

  list.querySelectorAll<HTMLButtonElement>('.choice').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const value = btn.dataset.value!;
      const u = $user.get();
      if (u) {
        try {
          await updateProfile(u.id, { purpose: value } as Partial<UserProfile>);
        } catch {
          /* soft fail */
        }
      } else {
        patchDraft({ purpose: value });
      }
      navigate('/onboarding/day1-hook');
    });
  });
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

function escapeAttr(s: string): string {
  return escapeHtml(s);
}
