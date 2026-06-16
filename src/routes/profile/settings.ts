/**
 * Settings — meal-times + font size + locale + logout.
 *
 * The display-name (pet name) editor was removed in the 2026-06-16
 * tidy: that name is set during onboarding and intentionally not
 * editable afterwards. eat_times is JSON in user_profiles and is now
 * the only profile field this screen writes.
 */
import { navigate } from '@/router';
import { $user, $profile, clearUser } from '@/store/user';
import { updateProfile } from '@/api/profile';
import { $ui, setFontScale } from '@/store/ui';
import { bind } from '@/lib/lifecycle';
import { requestMealNotificationPermission } from '@/lib/meal-notifier';
import { $locale, setLocale, t } from '@/lib/i18n';

const MEALS = [
  { key: 'breakfast', emoji: '🌅', labelKey: 'eattimes.meal1', defaultTime: '08:00' },
  { key: 'lunch',     emoji: '☀️', labelKey: 'eattimes.meal2', defaultTime: '12:30' },
  { key: 'dinner',    emoji: '🌙', labelKey: 'eattimes.meal3', defaultTime: '19:00' },
];

const ORDINAL_KEYS = ['eattimes.meal1', 'eattimes.meal2', 'eattimes.meal3'];

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
      <button class="checkin-back" id="back-btn" data-i18n-aria="common.back">
        <span class="ms">arrow_back</span>
      </button>
      <span class="checkin-title" data-i18n="settings.title">${t('settings.title')}</span>
      <span></span>
    </header>
    <div class="settings-body">
      <section class="settings-section">
        <span class="settings-label" data-i18n="settings.mealReminders">${t('settings.mealReminders')}</span>
        <p class="onb-sub text-mini" data-i18n="eattimes.subProfile">${t('eattimes.subProfile')}</p>
        <div class="meal-list" id="meals"></div>
      </section>

      <section class="settings-section">
        <span class="settings-label" data-i18n="settings.notif">${t('settings.notif')}</span>
        <button class="btn text-btn-m btn-secondary btn-sm" id="ask-notif" data-i18n="settings.notifAsk">${t('settings.notifAsk')}</button>
        <span class="settings-hint" id="notif-status"></span>
      </section>

      <section class="settings-section">
        <span class="settings-label" data-i18n="settings.fontSize">${t('settings.fontSize')}</span>
        <div class="vegan-chips">
          <button class="vegan-chip font-chip" data-font="default" data-i18n="settings.fontDefault">${t('settings.fontDefault')}</button>
          <button class="vegan-chip font-chip" data-font="large" data-i18n="settings.fontLarge">${t('settings.fontLarge')}</button>
        </div>
      </section>

      <section class="settings-section">
        <span class="settings-label" data-i18n="settings.language">${t('settings.language')}</span>
        <div class="vegan-chips" id="locale-chips">
          <button class="vegan-chip locale-chip" data-locale="zh" data-i18n="settings.zh">${t('settings.zh')}</button>
          <button class="vegan-chip locale-chip" data-locale="en" data-i18n="settings.en">${t('settings.en')}</button>
        </div>
      </section>

      <div class="settings-success" id="ok" hidden data-i18n="settings.saveOk">${t('settings.saveOk')}</div>
      <div class="review-error" id="err" hidden></div>
      <button class="btn text-btn-m btn-primary btn-l text-btn-l" id="save" data-i18n="settings.saveBtn">${t('settings.saveBtn')}</button>
      <button class="btn text-btn-m btn-secondary btn-l text-btn-l" id="logout">
        <span class="ms">logout</span><span data-i18n="settings.logout">${t('settings.logout')}</span>
      </button>
      <footer class="settings-footer" id="settings-footer"></footer>
    </div>
  `;

  // Local meal state — kept in sync with $profile.eat_times. Times persist
  // across disable/re-enable cycles so re-adding a meal restores the
  // last-picked time rather than the default.
  const times: Record<string, string> = Object.fromEntries(MEALS.map((m) => [m.key, m.defaultTime]));
  const disabled = new Set<string>();

  function renderMealList(): void {
    const list = wrap.querySelector<HTMLElement>('#meals');
    if (!list) return;
    const activeKeys = MEALS.filter((m) => !disabled.has(m.key)).map((m) => m.key);
    const activeCount = activeKeys.length;
    function activeLabel(key: string): string {
      if (activeCount === 1) return t('eattimes.mealOnly');
      const idx = activeKeys.indexOf(key);
      return idx >= 0 ? t(ORDINAL_KEYS[idx] ?? '') : '';
    }
    list.innerHTML = MEALS.map((m) => {
      const isOff = disabled.has(m.key);
      if (isOff) {
        return `
          <div class="meal-row meal-row-off" data-key="${m.key}">
            <span class="meal-emoji" style="opacity:.35">${m.emoji}</span>
            <button class="btn-skip" data-action="enable" data-key="${m.key}" type="button">${t('eattimes.addBack')}</button>
          </div>
        `;
      }
      const removable = activeCount > 1;
      const label = activeLabel(m.key);
      return `
        <div class="meal-row" data-key="${m.key}">
          <span class="meal-emoji">${m.emoji}</span>
          <span class="meal-label">${label}</span>
          <input type="time" class="meal-input" data-key="${m.key}" value="${times[m.key]}" />
          ${removable
            ? `<button class="meal-remove" data-action="disable" data-key="${m.key}" type="button" aria-label="${label}"><span class="ms">close</span></button>`
            : ''}
        </div>
      `;
    }).join('');

    list.querySelectorAll<HTMLInputElement>('.meal-input').forEach((input) => {
      input.addEventListener('input', () => { times[input.dataset.key!] = input.value; });
    });
    list.querySelectorAll<HTMLButtonElement>('button[data-action]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.key!;
        if (btn.dataset.action === 'disable') disabled.add(key);
        else disabled.delete(key);
        renderMealList();
      });
    });
  }

  function hydrate() {
    const p = $profile.get();

    // Re-derive local meal state from the stored eat_times JSON so the
    // section paints with the user's actual schedule on mount.
    if (p?.eat_times) {
      try {
        const map = JSON.parse(p.eat_times) as Record<string, string>;
        disabled.clear();
        for (const m of MEALS) {
          if (map[m.key]) {
            times[m.key] = map[m.key];
          } else {
            disabled.add(m.key);
          }
        }
      } catch {
        /* malformed json — leave defaults */
      }
    }
    renderMealList();

    const scale = $ui.get().fontScale;
    wrap.querySelectorAll<HTMLButtonElement>('.font-chip').forEach((c) => {
      c.classList.toggle('selected', c.dataset.font === scale);
    });
  }

  bind(wrap, $profile, hydrate);
  bind(wrap, $ui, hydrate);

  wrap.querySelector('#back-btn')?.addEventListener('click', () => navigate('/profile'));

  wrap.querySelectorAll<HTMLButtonElement>('.font-chip').forEach((c) => {
    c.addEventListener('click', () => {
      const next = c.dataset.font as 'default' | 'large';
      setFontScale(next);
    });
  });

  // Locale picker — Phase A surface. Saves to localStorage via setLocale
  // and the $locale subscription on every i18n'd surface repaints.
  function reflectLocale(): void {
    const cur = $locale.get();
    wrap.querySelectorAll<HTMLButtonElement>('.locale-chip').forEach((c) => {
      c.classList.toggle('selected', c.dataset.locale === cur);
    });
    // Repaint every text label tagged with data-i18n.
    wrap.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
      const key = el.dataset.i18n;
      if (key) el.textContent = t(key);
    });
    // aria-label flavour for accessibility-only labels.
    wrap.querySelectorAll<HTMLElement>('[data-i18n-aria]').forEach((el) => {
      const key = el.dataset.i18nAria;
      if (key) el.setAttribute('aria-label', t(key));
    });
    // Footer has interpolated tokens ({ver}, {time}) so it lives in code.
    const footer = wrap.querySelector<HTMLElement>('#settings-footer');
    if (footer) {
      footer.textContent = t('settings.footer')
        .replace('{ver}', __APP_VERSION__)
        .replace('{time}', formatBuildTime());
    }
    // Meal list rows are rendered by code (with locale-aware ordinals);
    // re-render so 第一餐 / First meal swap on toggle.
    renderMealList();
    // Notification status string is also code-rendered.
    if (typeof reflectPermission === 'function') reflectPermission();
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
    // Persist only the active (non-disabled) meals so a user who's
    // disabled e.g. breakfast doesn't have it reinstated on save.
    const eatTimes: Record<string, string> = {};
    for (const m of MEALS) {
      if (!disabled.has(m.key)) eatTimes[m.key] = times[m.key];
    }

    save.disabled = true;
    save.textContent = t('common.saving');
    try {
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

  // Lazy-lookup queries so reflectPermission() can be safely called
  // from reflectLocale() during the initial paint, before the const
  // declarations would otherwise be in TDZ.
  function reflectPermission() {
    const status = wrap.querySelector<HTMLElement>('#notif-status');
    const ask = wrap.querySelector<HTMLButtonElement>('#ask-notif');
    if (typeof Notification === 'undefined') {
      if (status) status.textContent = t('settings.notifUnsupported');
      if (ask) ask.disabled = true;
    } else if (status) {
      status.textContent =
        Notification.permission === 'granted' ? t('settings.notifGranted') :
        Notification.permission === 'denied'  ? t('settings.notifDenied') :
        t('settings.notifUnset');
    }
  }
  reflectPermission();
  wrap.querySelector<HTMLButtonElement>('#ask-notif')?.addEventListener('click', async () => {
    await requestMealNotificationPermission();
    reflectPermission();
  });

  return wrap;
}
