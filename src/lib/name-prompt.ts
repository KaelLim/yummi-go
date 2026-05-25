/**
 * Reusable "tell us your name" prompt.
 *
 * Guests sign up with an auto-generated `訪客 abcd` display name. The
 * social surfaces (map, reviews, verifications) attribute actions to the
 * display name, so any first-time social action should make the user pick
 * a real name first.
 *
 * `requireRealName(host)` is the single entry point. It resolves
 * immediately when the user already has a non-guest display name; otherwise
 * it mounts an overlay onto `host`, waits for the user to save or skip,
 * and then resolves. Callers await it before proceeding with the social
 * action (navigating to a review form, opening verify, etc.).
 */
import { $user, $profile } from '@/store/user';
import { updateDisplayName, getUserFull } from '@/api/profile';

export const GUEST_NAME_PREFIX = '訪客 ';

export function hasGuestName(displayName: string): boolean {
  return displayName.startsWith(GUEST_NAME_PREFIX);
}

export interface RequireRealNameOptions {
  /** Allow the user to dismiss without saving. Default true. */
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
      <div class="name-prompt-card">
        <h2 class="name-prompt-title text-h3" id="name-prompt-title">嗨，先取個名字吧</h2>
        <p class="name-prompt-sub text-mini">讓小綠在地圖上認得你</p>
        <input type="text" class="input" id="name-prompt-input" maxlength="20" autocomplete="off" />
        <p class="name-prompt-error" id="name-prompt-error" hidden></p>
        <div class="name-prompt-actions">
          ${allowSkip ? '<button type="button" class="btn text-btn-m btn-secondary btn-l text-btn-l" id="name-prompt-skip">先跳過</button>' : ''}
          <button type="button" class="btn text-btn-m btn-primary btn-l text-btn-l" id="name-prompt-save">儲存</button>
        </div>
      </div>
    `;

    const input = overlay.querySelector<HTMLInputElement>('#name-prompt-input')!;
    const errorEl = overlay.querySelector<HTMLElement>('#name-prompt-error')!;
    const saveBtn = overlay.querySelector<HTMLButtonElement>('#name-prompt-save')!;
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

    saveBtn.addEventListener('click', async () => {
      errorEl.hidden = true;
      const name = input.value.trim();
      if (!name) {
        showError('幫自己取個名字吧');
        return;
      }
      if (name.startsWith(GUEST_NAME_PREFIX)) {
        showError('換一個吧，這個是預設訪客名');
        return;
      }
      saveBtn.disabled = true;
      saveBtn.textContent = '儲存中…';
      try {
        await updateDisplayName(u.id, name);
        $user.set({ ...u, displayName: name });
        // Refresh $profile in the background so other screens see the
        // new name on their next render. Soft fail is fine — the local
        // session update is enough for the current screen.
        void getUserFull(u.id).then((full) => { if (full) $profile.set(full); });
        close();
      } catch (err) {
        console.error('[name-prompt] updateDisplayName failed:', err);
        showError('儲存失敗，請稍後再試');
        saveBtn.disabled = false;
        saveBtn.textContent = '儲存';
      }
    });

    host.appendChild(overlay);
    input.focus();
  });
}
