/**
 * Global gem-gain toast.
 *
 * `showGemGain(amount)` floats a "💎 +N" pill from the top of the viewport
 * for ~1.4s. Called explicitly from gain sites (XP overflow, mission
 * rewards, dev panel) so hydration / re-renders never produce phantom
 * toasts.
 */

import { gemIcon } from '@/lib/currency-icons';

const TOAST_LIFETIME_MS = 1400;

export function showGemGain(amount: number): void {
  if (typeof document === 'undefined') return;
  if (!amount || amount <= 0) return;
  const host = ensureHost();
  const toast = document.createElement('div');
  toast.className = 'gem-toast';
  toast.innerHTML = `${gemIcon(20)}<span>+${amount}</span>`;
  host.appendChild(toast);
  window.setTimeout(() => toast.remove(), TOAST_LIFETIME_MS);
}

function ensureHost(): HTMLElement {
  let host = document.getElementById('gem-toast-host');
  if (host) return host;
  host = document.createElement('div');
  host.id = 'gem-toast-host';
  document.body.appendChild(host);
  return host;
}
