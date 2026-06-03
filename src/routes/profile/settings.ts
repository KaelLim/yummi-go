/**
 * Settings — display name + meal-times + theme + logout.
 *
 * display_name lives on users (not user_profiles), so we PATCH users by
 * the user id. eat_times is JSON in user_profiles. Theme persists via
 * store/ui (already wired). Logout clears the local session and routes
 * back to /login.
 */
import { navigate } from '@/router';
import { $user, $profile, clearUser, setLoggedInUser } from '@/store/user';
import { drust } from '@/api/drust';
import { updateProfile } from '@/api/profile';
import { $ui, setTheme } from '@/store/ui';
import { bind } from '@/lib/lifecycle';
import { requestMealNotificationPermission } from '@/lib/meal-notifier';
import { $locale, setLocale, t } from '@/lib/i18n';

const MEALS = [
  { key: 'breakfast', labelKey: 'eattimes.meal1', defaultTime: '08:00' },
  { key: 'lunch',     labelKey: 'eattimes.meal2', defaultTime: '12:30' },
  { key: 'dinner',    labelKey: 'eattimes.meal3', defaultTime: '19:00' },
];

function formatBuildTime(): string {
  try {
    const d = new Date(__BUILD_TIME__);
    return d.toLocaleString('zh-TW');
  } catch {
    return __BUILD_TIME__;
  }
}

export default function settings(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'settings-screen';

  wrap.innerHTML = `
    <header class="checkin-header">
      <button class="checkin-back" id="back-btn" aria-label="${t('common.back')}">
        <span class="ms">arrow_back</span>
      </button>
      <span class="checkin-title">${t('settings.title')}</span>
      <span></span>
    </header>
    <div class="settings-body">
      <section class="settings-section">
        <span class="settings-label">${t('settings.petName')}</span>
        <input class="input" id="display-name" type="text" />
      </section>

      <section class="settings-section">
        <span class="settings-label">${t('settings.mealReminders')}</span>
        <div class="meal-list" id="meals">
          ${MEALS.map(
            (m) => `
            <div class="meal-row">
              <span class="meal-label">${t(m.labelKey)}</span>
              <input type="time" class="meal-input" data-key="${m.key}" value="${m.defaultTime}" />
            </div>`,
          ).join('')}
        </div>
      </section>

      <section class="settings-section">
        <span class="settings-label">${t('settings.notif')}</span>
        <button class="btn text-btn-m btn-secondary btn-sm" id="ask-notif">${t('settings.notifAsk')}</button>
        <span class="settings-hint" id="notif-status"></span>
      </section>

      <section class="settings-section">
        <span class="settings-label">${t('settings.theme')}</span>
        <div class="vegan-chips">
          <button class="vegan-chip theme-chip" data-theme="light">${t('settings.themeLight')}</button>
          <button class="vegan-chip theme-chip" data-theme="dark">${t('settings.themeDark')}</button>
        </div>
      </section>

      <section class="settings-section">
        <span class="settings-label" data-i18n="settings.language">${t('settings.language')}</span>
        <div class="vegan-chips" id="locale-chips">
          <button class="vegan-chip locale-chip" data-locale="zh" data-i18n="settings.zh">${t('settings.zh')}</button>
          <button class="vegan-chip locale-chip" data-locale="en" data-i18n="settings.en">${t('settings.en')}</button>
        </div>
      </section>

      <div class="settings-success" id="ok" hidden>${t('settings.saveOk')}</div>
      <div class="review-error" id="err" hidden></div>
      <button class="btn text-btn-m btn-primary btn-l text-btn-l" id="save">${t('settings.saveBtn')}</button>
      <button class="btn text-btn-m btn-secondary btn-l text-btn-l" id="logout">
        <span class="ms">logout</span>${t('settings.logout')}
      </button>
      <footer class="settings-footer">
        ${t('settings.footer').replace('{ver}', __APP_VERSION__).replace('{time}', formatBuildTime())}
      </footer>
    </div>
  `;

  function hydrate() {
    const u = $user.get();
    const p = $profile.get();
    (wrap.querySelector('#display-name') as HTMLInputElement).value = u?.displayName ?? '';

    if (p?.eat_times) {
      try {
        const map = JSON.parse(p.eat_times) as Record<string, string>;
        for (const m of MEALS) {
          const inp = wrap.querySelector<HTMLInputElement>(`.meal-input[data-key="${m.key}"]`);
          if (inp && map[m.key]) inp.value = map[m.key];
        }
      } catch {
        /* malformed json — leave defaults */
      }
    }

    const theme = $ui.get().theme;
    wrap.querySelectorAll<HTMLButtonElement>('.theme-chip').forEach((c) => {
      c.classList.toggle('selected', c.dataset.theme === theme);
    });
  }

  bind(wrap, $user, hydrate);
  bind(wrap, $profile, hydrate);
  bind(wrap, $ui, hydrate);

  wrap.querySelector('#back-btn')?.addEventListener('click', () => navigate('/profile'));

  wrap.querySelectorAll<HTMLButtonElement>('.theme-chip').forEach((c) => {
    c.addEventListener('click', () => {
      const next = c.dataset.theme as 'light' | 'dark';
      setTheme(next);
    });
  });

  // Locale picker — Phase A surface. Saves to localStorage via setLocale
  // and the $locale subscription on every i18n'd surface repaints.
  function reflectLocale(): void {
    const cur = $locale.get();
    wrap.querySelectorAll<HTMLButtonElement>('.locale-chip').forEach((c) => {
      c.classList.toggle('selected', c.dataset.locale === cur);
    });
    wrap.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
      const key = el.dataset.i18n;
      if (key) el.textContent = t(key);
    });
  }
  reflectLocale();
  bind(wrap, $locale, reflectLocale);
  wrap.querySelectorAll<HTMLButtonElement>('.locale-chip').forEach((c) => {
    c.addEventListener('click', () => {
      const next = c.dataset.locale as 'zh' | 'en';
      setLocale(next);
    });
  });

  const ok = wrap.querySelector<HTMLElement>('#ok')!;
  const err = wrap.querySelector<HTMLElement>('#err')!;
  const save = wrap.querySelector<HTMLButtonElement>('#save')!;

  save.addEventListener('click', () => {
    void doSave();
  });

  async function doSave() {
    ok.hidden = true;
    err.hidden = true;
    const u = $user.get();
    if (!u) {
      navigate('/login');
      return;
    }
    const newName = (wrap.querySelector('#display-name') as HTMLInputElement).value.trim();
    if (!newName) {
      err.hidden = false;
      err.textContent = t('settings.errName');
      return;
    }
    const eatTimes: Record<string, string> = {};
    wrap.querySelectorAll<HTMLInputElement>('.meal-input').forEach((inp) => {
      eatTimes[inp.dataset.key!] = inp.value;
    });

    save.disabled = true;
    save.textContent = t('common.saving');
    try {
      if (newName !== u.displayName) {
        await drust.update('users', u.id, { display_name: newName });
        setLoggedInUser({ ...u, displayName: newName });
      }
      await updateProfile(u.id, { eat_times: JSON.stringify(eatTimes) });
      ok.hidden = false;
    } catch (e) {
      err.hidden = false;
      err.textContent = (e as Error).message ?? '儲存失敗';
    } finally {
      save.disabled = false;
      save.textContent = t('settings.saveBtn');
    }
  }

  wrap.querySelector('#logout')?.addEventListener('click', () => {
    if (window.confirm(t('settings.logoutConfirm'))) {
      clearUser();
      // Land on splash so the user can decide between "Get Started" (new
      // guest account) and footer-link login — same surface as a fresh
      // install. /login direct-entry felt heavy-handed for guests.
      navigate('/');
    }
  });

  const askBtn = wrap.querySelector<HTMLButtonElement>('#ask-notif');
  const statusEl = wrap.querySelector<HTMLElement>('#notif-status');
  function reflectPermission() {
    if (typeof Notification === 'undefined') {
      if (statusEl) statusEl.textContent = t('settings.notifUnsupported');
      if (askBtn) askBtn.disabled = true;
    } else if (statusEl) {
      statusEl.textContent =
        Notification.permission === 'granted' ? t('settings.notifGranted') :
        Notification.permission === 'denied'  ? t('settings.notifDenied') :
        t('settings.notifUnset');
    }
  }
  reflectPermission();
  askBtn?.addEventListener('click', async () => {
    await requestMealNotificationPermission();
    reflectPermission();
  });

  return wrap;
}
