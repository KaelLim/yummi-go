/**
 * PWA install prompt — captures the browser's beforeinstallprompt event,
 * stows the deferred prompt, and surfaces a small toast on /home with an
 * "安裝 App" CTA. Dismiss persists in localStorage so the toast doesn't
 * re-appear after the user explicitly closed it.
 *
 * Mounted by main.ts at boot. Listens once for beforeinstallprompt; the
 * actual UI is injected into document.body when the user is on /home and
 * hasn't dismissed.
 */
import { $route } from '@/router';
import { storage } from '@/lib/storage';
import { t } from '@/lib/i18n';

const DISMISS_KEY = 'yummi.installDismissed';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function setupInstallPrompt(): void {
  let deferred: BeforeInstallPromptEvent | null = null;
  let toast: HTMLElement | null = null;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    maybeShow();
  });

  $route.subscribe(maybeShow);

  function maybeShow() {
    if (!deferred) return;
    if (storage.get<boolean>(DISMISS_KEY, false)) return;
    if (!isAppRoute($route.get().path)) {
      hideToast();
      return;
    }
    if (toast) return;
    toast = renderToast();
    document.body.appendChild(toast);
  }

  function hideToast() {
    if (toast) {
      toast.remove();
      toast = null;
    }
  }

  function renderToast(): HTMLElement {
    const el = document.createElement('div');
    el.className = 'install-toast';
    el.innerHTML = `
      <span class="install-toast-icon ms">install_mobile</span>
      <div class="install-toast-body">
        <strong>${t('install.title')}</strong>
        <span>${t('install.sub')}</span>
      </div>
      <button class="install-toast-cta" id="install-go">${t('install.cta')}</button>
      <button class="install-toast-x" id="install-x" aria-label="${t('install.dismiss')}">
        <span class="ms">close</span>
      </button>
    `;
    el.querySelector('#install-go')?.addEventListener('click', () => {
      void doInstall();
    });
    el.querySelector('#install-x')?.addEventListener('click', () => {
      storage.set(DISMISS_KEY, true);
      hideToast();
    });
    return el;
  }

  async function doInstall(): Promise<void> {
    if (!deferred) return;
    await deferred.prompt();
    try {
      await deferred.userChoice;
    } catch {
      /* user cancelled */
    }
    deferred = null;
    storage.set(DISMISS_KEY, true);
    hideToast();
  }
}

function isAppRoute(path: string): boolean {
  return (
    path.startsWith('/home') ||
    path.startsWith('/map') ||
    path.startsWith('/tasks') ||
    path.startsWith('/profile') ||
    path.startsWith('/check-in')
  );
}
