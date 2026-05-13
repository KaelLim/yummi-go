/**
 * Onboarding step 9 — Pet name.
 *
 * Last screen before /register. Stores the chosen name into the draft so
 * it can be passed as `display_name` when the account is finally created.
 * Returning users (already logged in) skip the draft path entirely — drust
 * already holds their display_name and going through this screen again
 * doesn't make sense, so we send them home.
 *
 * The initial value is randomised on every mount from the
 * pet_name_suggestions collection (drust live, hardcoded fallback if the
 * fetch fails). The refresh button next to the input lets the user roll
 * a new suggestion without leaving the page — same source list, just
 * picks a different entry from the cached result.
 */
import { navigate } from '@/router';
import { $user } from '@/store/user';
import { $onboardingDraft, patchDraft } from '@/store/onboarding-draft';
import { createProgress } from '@/components/Progress';
import { listPetNameSuggestions } from '@/api/content';

const STATIC_FALLBACK = '小綠';

function pickRandomName(names: string[], avoid: string | null = null): string {
  if (names.length === 0) return STATIC_FALLBACK;
  // Prefer a name different from the one currently shown so back-to-back
  // refreshes visibly change the input. Falls through if the list has
  // only one entry.
  const pool = avoid !== null ? names.filter((n) => n !== avoid) : names;
  const source = pool.length > 0 ? pool : names;
  return source[Math.floor(Math.random() * source.length)];
}

export default function petName(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'onb-screen';
  const draft = $onboardingDraft.get();

  wrap.innerHTML = `
    <div class="onb-header">
      <div class="onb-back" id="back-btn"><span class="ms">arrow_back</span></div>
      ${createProgress(5, 6).outerHTML}
    </div>
    <div class="onb-body">
      <div class="day1-egg" data-tint="neutral" style="font-size:64px;margin:0 auto;">🥚</div>
      <h1 class="onb-title text-h2">為你的守護者取名</h1>
      <p class="onb-sub text-mini">這個名字會跟著你走完 30 天的挑戰</p>
      <label class="field">
        <span class="field-label text-mini">寵物名稱</span>
        <div class="field-row">
          <input class="input" id="pet-name-input" type="text" maxlength="20" value="${escapeHtml(
            draft.pet_name ?? STATIC_FALLBACK,
          )}" />
          <button class="btn-icon" id="pet-name-refresh" type="button" aria-label="再抽一個名字" title="再抽一個">
            <span class="ms">refresh</span>
          </button>
        </div>
      </label>
      <div class="auth-error" id="pet-name-error" hidden></div>
      <button class="btn text-btn-m btn-primary btn-l text-btn-l" id="continue-btn">下一步</button>
    </div>
  `;

  const input = wrap.querySelector<HTMLInputElement>('#pet-name-input')!;
  const error = wrap.querySelector<HTMLElement>('#pet-name-error')!;
  const refreshBtn = wrap.querySelector<HTMLButtonElement>('#pet-name-refresh')!;

  // Cache the fetched suggestions so the refresh button doesn't re-hit
  // drust on every click. Populated by the in-flight fetch below.
  let cachedNames: string[] = [];
  let pendingFetch: Promise<void> | null = null;

  function loadSuggestions(): Promise<void> {
    if (pendingFetch) return pendingFetch;
    pendingFetch = listPetNameSuggestions()
      .then((rows) => {
        cachedNames = rows.map((r) => r.name);
      })
      .catch(() => {
        // listPetNameSuggestions already swallows + falls back; this catch
        // is defensive in case future refactors let an error escape.
      })
      .finally(() => {
        pendingFetch = null;
      });
    return pendingFetch;
  }

  // First load: replace the placeholder unless the user already has a draft.
  if (!draft.pet_name) {
    void loadSuggestions().then(() => {
      if (input.value !== STATIC_FALLBACK && input.value !== '') return;
      input.value = pickRandomName(cachedNames);
    });
  }

  refreshBtn.addEventListener('click', () => {
    refreshBtn.classList.add('is-spinning');
    setTimeout(() => refreshBtn.classList.remove('is-spinning'), 400);
    if (cachedNames.length === 0) {
      void loadSuggestions().then(() => {
        input.value = pickRandomName(cachedNames, input.value);
      });
      return;
    }
    input.value = pickRandomName(cachedNames, input.value);
  });

  wrap.querySelector('#back-btn')?.addEventListener('click', () =>
    navigate('/onboarding/day1-hook'),
  );

  wrap.querySelector('#continue-btn')?.addEventListener('click', () => {
    const name = input.value.trim();
    if (!name) {
      error.hidden = false;
      error.textContent = '請為你的守護者取個名字';
      return;
    }
    if (!$user.get()) patchDraft({ pet_name: name });
    navigate('/onboarding/eat-times');
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
