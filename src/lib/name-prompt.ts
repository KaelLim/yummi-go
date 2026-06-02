/**
 * Google bind-to-account prompt (formerly the "tell us your name" prompt).
 *
 * Guests sign up with an auto-generated `訪客 abcd` display name and a
 * throwaway `guest_<hex>` username. The social surfaces (reviews,
 * verifications) need a real attributable identity — so when a guest
 * tries to leave a review, this prompt asks them to bind a Google
 * account first.
 *
 * Behaviour: opens a Google-style account picker (same UX shape as the
 * splash login) and on confirm switches the in-memory session to the
 * google_<email> row via mockGoogleSignIn (real OAuth is a Phase-2 PR).
 *
 * Scope: this prompt fires ONLY before leaving a review. The map mount
 * and the gray-pin verify CTA no longer trigger it — guests can browse
 * and tap around without being asked to bind.
 *
 * `requireRealName(host)` is kept as the entry-point name so existing
 * callers don't have to rename; the implementation is now a Google
 * bind, not a display-name picker.
 */
import { $user, $profile } from '@/store/user';
import { setLoggedInUser } from '@/store/user';
import { getUserFull } from '@/api/profile';
import { mockGoogleSignIn, MOCK_GOOGLE_ACCOUNTS } from '@/lib/mock-google-auth';
import { t } from '@/lib/i18n';

export const GUEST_NAME_PREFIX = '訪客 ';

export function hasGuestName(displayName: string): boolean {
  return displayName.startsWith(GUEST_NAME_PREFIX);
}

export interface RequireRealNameOptions {
  /** Allow the user to dismiss without binding. Default true. */
  allowSkip?: boolean;
}

export async function requireRealName(
  host: HTMLElement,
  opts: RequireRealNameOptions = {},
): Promise<void> {
  const u = $user.get();
  if (!u) return;
  if (!hasGuestName(u.displayName)) return;
  const allowSkip = opts.allowSkip !== false;

  return new Promise<void>((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'name-prompt name-prompt-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'name-prompt-title');
    overlay.innerHTML = `
      <div class="name-prompt-card google-bind-card">
        <header class="google-bind-head">
          <span class="google-picker-mark" aria-hidden="true">G</span>
          <h2 class="name-prompt-title text-h3" id="name-prompt-title">${t('bind.title')}</h2>
        </header>
        <p class="name-prompt-sub text-mini">${t('bind.sub')}</p>
        <ul class="google-picker-accounts">
          ${MOCK_GOOGLE_ACCOUNTS.map(
            (a) => `
            <li>
              <button class="google-picker-account" type="button" data-email="${a.email}" data-name="${a.displayName}">
                <span class="google-picker-avatar" aria-hidden="true">${a.avatarEmoji}</span>
                <span class="google-picker-account-meta">
                  <span class="google-picker-account-name">${a.displayName}</span>
                  <span class="google-picker-account-email">${a.email}</span>
                </span>
              </button>
            </li>`,
          ).join('')}
          <li>
            <div class="google-picker-custom">
              <input type="email" class="input" id="name-prompt-input" placeholder="${t('bind.useOther')}" autocomplete="off" />
              <button type="button" class="btn text-btn-m btn-primary btn-sm text-mini" id="name-prompt-go">${t('bind.confirm')}</button>
            </div>
          </li>
        </ul>
        <p class="name-prompt-error" id="name-prompt-error" hidden></p>
        <div class="name-prompt-actions">
          ${allowSkip ? `<button type="button" class="google-picker-cancel" id="name-prompt-skip">${t('bind.skip')}</button>` : ''}
        </div>
      </div>
    `;

    const input = overlay.querySelector<HTMLInputElement>('#name-prompt-input')!;
    const errorEl = overlay.querySelector<HTMLElement>('#name-prompt-error')!;
    const goBtn = overlay.querySelector<HTMLButtonElement>('#name-prompt-go')!;
    const skipBtn = overlay.querySelector<HTMLButtonElement>('#name-prompt-skip');

    function close(): void {
      overlay.remove();
      resolve();
    }

    function showError(msg: string): void {
      errorEl.hidden = false;
      errorEl.textContent = msg;
    }

    skipBtn?.addEventListener('click', close);

    async function bind(email: string, displayName: string): Promise<void> {
      errorEl.hidden = true;
      try {
        const result = await mockGoogleSignIn(email, displayName);
        // Swap the in-memory session to the Google-bound row. The guest
        // user's prior pet / XP rows stay in drust but the active
        // identity is now the bound account.
        setLoggedInUser(result.user);
        const full = await getUserFull(result.user.id);
        if (full) $profile.set(full);
        close();
      } catch (err) {
        console.error('[name-prompt] mockGoogleSignIn failed:', err);
        showError(t('bind.failed'));
      }
    }

    overlay.querySelectorAll<HTMLButtonElement>('.google-picker-account').forEach((btn) => {
      btn.addEventListener('click', () => {
        const email = btn.dataset.email ?? '';
        const displayName = btn.dataset.name ?? '';
        void bind(email, displayName);
      });
    });

    goBtn.addEventListener('click', () => {
      const email = input.value.trim();
      if (!email || !email.includes('@')) {
        input.focus();
        showError(t('bind.emailError'));
        return;
      }
      const displayName = email.split('@')[0] ?? email;
      void bind(email, displayName);
    });

    host.appendChild(overlay);
    input.focus();
  });
}
