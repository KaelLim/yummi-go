/**
 * Global milestone popup — fires the moment the user crosses 100 XP
 * fed-to-pet today. `store/pet.awardXp` calls `showMilestonePopup`
 * directly so flows that don't navigate after earning XP (quiz,
 * review, restaurant verify — all of which render an in-place
 * success state) still see the popup. A localStorage flag +
 * `$route` subscriber kick in as a safety net for any future path
 * that sets the flag without calling the function directly.
 *
 * The modal is appended to `document.body`, not into any route's
 * wrap, so it survives a route swap. The CTA removes the element.
 */
import { $route } from '@/router';
import { t } from '@/lib/i18n';

export const MILESTONE_PENDING_KEY = 'yummi:xp_milestone_pending';

interface MilestonePayload {
  bonus: number;
  overflow: number;
}

/** Subscribe to route changes and pop the milestone modal on the first
 *  transition that occurs while the flag is set. Skips the first
 *  emission (initial subscription) since that's the boot route, not a
 *  user navigation. */
export function installMilestoneRouter(): void {
  let primed = false;
  $route.subscribe(() => {
    if (!primed) {
      primed = true;
      return;
    }
    try {
      const raw = localStorage.getItem(MILESTONE_PENDING_KEY);
      if (!raw) return;
      const payload = JSON.parse(raw) as MilestonePayload;
      localStorage.removeItem(MILESTONE_PENDING_KEY);
      // Defer one tick so the new route has time to mount; the modal
      // then layers on top via fixed positioning + high z-index.
      queueMicrotask(() => showMilestonePopup(payload));
    } catch {
      /* malformed payload or private mode — silently skip */
    }
  });
}

export function showMilestonePopup(payload: MilestonePayload): void {
  // Don't double-mount if a previous popup is still on screen for some
  // reason (e.g. rapid back-to-back crossings — unlikely but cheap to
  // guard).
  const existing = document.getElementById('milestone-modal-host');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'milestone-modal';
  overlay.id = 'milestone-modal-host';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.innerHTML = `
    <div class="milestone-modal-card">
      <div class="milestone-icon" aria-hidden="true">🎉</div>
      <h2 class="milestone-title">${t('milestone.titleDone')}</h2>
      <p class="milestone-body">${t('milestone.body')}</p>
      <div class="milestone-breakdown">
        <div class="milestone-row">
          <span class="milestone-row-label">${t('milestone.rowBonus')}</span>
          <strong class="milestone-row-value">+${payload.bonus} 💎</strong>
        </div>
        <div class="milestone-row">
          <span class="milestone-row-label">${t('milestone.rowOverflow')}</span>
          <strong class="milestone-row-value">+${payload.overflow} 💎</strong>
        </div>
      </div>
      <button class="btn text-btn-m btn-primary btn-l text-btn-l" id="milestone-continue" type="button">
        ${t('milestone.gotIt')}
      </button>
    </div>
  `;
  overlay.querySelector<HTMLButtonElement>('#milestone-continue')?.addEventListener('click', () => {
    overlay.remove();
  });
  document.body.appendChild(overlay);
}
