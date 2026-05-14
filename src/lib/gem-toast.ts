/**
 * Global gem-gain toast.
 *
 * Subscribes to $gems at boot and, whenever the balance rises (XP overflow,
 * milestone reward, dev panel, etc.), floats a "💎 +N" bubble onto the
 * screen for ~1.4s. Centralised here so the animation works regardless of
 * which route triggered the gain.
 *
 * The first $gems emission (hydration) is treated as the baseline — only
 * subsequent increases produce a toast.
 */
import { $gems } from '@/store/pet';

const TOAST_LIFETIME_MS = 1400;

let previousBalance: number | null = null;

export function setupGemToast(): void {
  $gems.subscribe((g) => {
    const next = g.balance;
    if (previousBalance === null) {
      previousBalance = next;
      return;
    }
    if (next > previousBalance) {
      showGemToast(next - previousBalance);
    }
    previousBalance = next;
  });
}

function showGemToast(delta: number): void {
  if (typeof document === 'undefined') return;
  const host = ensureHost();
  const toast = document.createElement('div');
  toast.className = 'gem-toast';
  toast.innerHTML = `<span class="ms">diamond</span><span>+${delta}</span>`;
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
