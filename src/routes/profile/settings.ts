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

const MEALS = [
  { key: 'breakfast', label: '早餐', defaultTime: '08:00' },
  { key: 'lunch', label: '午餐', defaultTime: '12:30' },
  { key: 'dinner', label: '晚餐', defaultTime: '19:00' },
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
      <button class="checkin-back" id="back-btn" aria-label="返回">
        <span class="ms">arrow_back</span>
      </button>
      <span class="checkin-title">設定</span>
      <span></span>
    </header>
    <div class="settings-body">
      <section class="settings-section">
        <span class="settings-label">寵物名稱</span>
        <input class="input" id="display-name" type="text" />
      </section>

      <section class="settings-section">
        <span class="settings-label">用餐提醒</span>
        <div class="meal-list" id="meals">
          ${MEALS.map(
            (m) => `
            <div class="meal-row">
              <span class="meal-label">${m.label}</span>
              <input type="time" class="meal-input" data-key="${m.key}" value="${m.defaultTime}" />
            </div>`,
          ).join('')}
        </div>
      </section>

      <section class="settings-section">
        <span class="settings-label">推播提醒</span>
        <button class="btn text-btn-m btn-secondary btn-sm" id="ask-notif">允許用餐前 10 分鐘提醒</button>
        <span class="settings-hint" id="notif-status"></span>
      </section>

      <section class="settings-section">
        <span class="settings-label">主題</span>
        <div class="vegan-chips">
          <button class="vegan-chip theme-chip" data-theme="light">淺色</button>
          <button class="vegan-chip theme-chip" data-theme="dark">深色</button>
        </div>
      </section>

      <div class="settings-success" id="ok" hidden>已儲存</div>
      <div class="review-error" id="err" hidden></div>
      <button class="btn text-btn-m btn-primary btn-l text-btn-l" id="save">儲存變更</button>
      <button class="btn text-btn-m btn-secondary btn-l text-btn-l" id="logout">
        <span class="ms">logout</span>登出
      </button>
      <footer class="settings-footer">
        Yummi Go v${__APP_VERSION__} · 建置於 ${formatBuildTime()}
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
      const t = c.dataset.theme as 'light' | 'dark';
      setTheme(t);
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
      err.textContent = '名稱不能空白';
      return;
    }
    const eatTimes: Record<string, string> = {};
    wrap.querySelectorAll<HTMLInputElement>('.meal-input').forEach((inp) => {
      eatTimes[inp.dataset.key!] = inp.value;
    });

    save.disabled = true;
    save.textContent = '儲存中…';
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
      save.textContent = '儲存變更';
    }
  }

  wrap.querySelector('#logout')?.addEventListener('click', () => {
    if (window.confirm('確定要登出嗎？')) {
      clearUser();
      navigate('/login');
    }
  });

  const askBtn = wrap.querySelector<HTMLButtonElement>('#ask-notif');
  const statusEl = wrap.querySelector<HTMLElement>('#notif-status');
  function reflectPermission() {
    if (typeof Notification === 'undefined') {
      if (statusEl) statusEl.textContent = '此瀏覽器不支援';
      if (askBtn) askBtn.disabled = true;
    } else if (statusEl) {
      statusEl.textContent =
        Notification.permission === 'granted' ? '已開啟' :
        Notification.permission === 'denied'  ? '已封鎖（請至瀏覽器設定開啟）' :
        '尚未設定';
    }
  }
  reflectPermission();
  askBtn?.addEventListener('click', async () => {
    await requestMealNotificationPermission();
    reflectPermission();
  });

  return wrap;
}
