/**
 * Floating dev panel — only mounted when $ui.devMode is true (?dev in URL
 * or `npm run dev`).
 *
 * Provides a quick way to:
 *  - swap timeMode between real / compressed / manual
 *  - drag a slider to jump to any of the 30 days
 *  - flip theme light/dark
 *  - deep-link to the main 5 routes + day-30
 *  - mint XP / gems / fragments straight into the active user (skips the
 *    grind so we can demo levelling, gem swap, makeup-card synthesis)
 *
 * Mutations route through the same API helpers production code uses, then
 * refresh $profile via getUserFull so every bound view paints the new
 * totals.
 */
import {
  $ui,
  setTheme,
  setTimeMode,
  setManualDay,
  type TimeMode,
} from '@/store/ui';
import { $user, $profile } from '@/store/user';
import { awardXp } from '@/store/pet';
import { addGems, addFragments } from '@/api/wallet';
import { getUserFull } from '@/api/profile';
import { navigate } from '@/router';
import { bind } from '@/lib/lifecycle';

const ROUTES: Array<{ label: string; path: string }> = [
  { label: '首頁', path: '/home' },
  { label: '地圖', path: '/map' },
  { label: '打卡', path: '/check-in' },
  { label: '任務', path: '/tasks' },
  { label: '我的', path: '/profile' },
  { label: 'Day-30', path: '/challenge/day-30' },
];

const XP_AMOUNTS = [30, 100, 500];
const GEM_AMOUNTS = [50, 200, 1000];
const FRAG_AMOUNTS = [1, 4];

export function createDevPanel(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'dev-panel-host';
  wrap.innerHTML = `
    <button class="dev-fab" id="fab" aria-label="開發者面板">
      <span class="ms">build</span>
    </button>
    <div class="dev-sheet" id="sheet" hidden>
      <header class="dev-sheet-head">
        <strong>Dev Panel</strong>
        <button class="checkin-back" id="close-btn" aria-label="關閉">
          <span class="ms">close</span>
        </button>
      </header>
      <section class="dev-section">
        <span class="dev-label">時間模式</span>
        <div class="dev-chips" id="time-mode-chips">
          <button class="dev-chip" data-mode="real">真實</button>
          <button class="dev-chip" data-mode="compressed">壓縮 30s/天</button>
          <button class="dev-chip" data-mode="manual">手動</button>
        </div>
      </section>
      <section class="dev-section">
        <div class="dev-label-row">
          <span class="dev-label">手動日數</span>
          <strong class="dev-day-readout" id="day-readout">D1</strong>
        </div>
        <input type="range" min="1" max="30" value="1" class="baseline-slider" id="day-slider" />
      </section>
      <section class="dev-section">
        <span class="dev-label">主題</span>
        <div class="dev-chips">
          <button class="dev-chip" data-theme="light">淺</button>
          <button class="dev-chip" data-theme="dark">深</button>
        </div>
      </section>

      <section class="dev-section">
        <div class="dev-label-row">
          <span class="dev-label">XP / 經驗值</span>
          <span class="dev-readout" data-bind="xp">LV.1 · 0 XP</span>
        </div>
        <div class="dev-chips" data-grant="xp">
          ${XP_AMOUNTS.map((n) => `<button class="dev-chip" data-amount="${n}">+${n}</button>`).join('')}
        </div>
      </section>

      <section class="dev-section">
        <div class="dev-label-row">
          <span class="dev-label">寶石</span>
          <span class="dev-readout" data-bind="gems">0</span>
        </div>
        <div class="dev-chips" data-grant="gems">
          ${GEM_AMOUNTS.map((n) => `<button class="dev-chip" data-amount="${n}">+${n}</button>`).join('')}
        </div>
      </section>

      <section class="dev-section">
        <div class="dev-label-row">
          <span class="dev-label">碎片 / 補簽卡</span>
          <span class="dev-readout" data-bind="frags">0 碎片 · 0 卡</span>
        </div>
        <div class="dev-chips" data-grant="frags">
          ${FRAG_AMOUNTS.map((n) => `<button class="dev-chip" data-amount="${n}">+${n}</button>`).join('')}
        </div>
      </section>

      <div class="dev-status" id="dev-status" hidden></div>

      <section class="dev-section">
        <span class="dev-label">快速跳頁</span>
        <div class="dev-chips" id="route-chips">
          ${ROUTES.map(
            (r) => `<button class="dev-chip" data-route="${r.path}">${r.label}</button>`,
          ).join('')}
        </div>
      </section>
    </div>
  `;

  const fab = wrap.querySelector<HTMLButtonElement>('#fab')!;
  const sheet = wrap.querySelector<HTMLElement>('#sheet')!;
  const slider = wrap.querySelector<HTMLInputElement>('#day-slider')!;
  const readout = wrap.querySelector<HTMLElement>('#day-readout')!;
  const status = wrap.querySelector<HTMLElement>('#dev-status')!;

  fab.addEventListener('click', () => {
    sheet.hidden = !sheet.hidden;
    fab.classList.toggle('open', !sheet.hidden);
  });
  wrap.querySelector('#close-btn')?.addEventListener('click', () => {
    sheet.hidden = true;
    fab.classList.remove('open');
  });

  // Time-mode chips
  wrap.querySelectorAll<HTMLButtonElement>('#time-mode-chips .dev-chip').forEach((c) => {
    c.addEventListener('click', () => {
      setTimeMode(c.dataset.mode as TimeMode);
    });
  });

  // Manual-day slider — also flips into 手動 mode if the user drags from
  // real/compressed, so the value isn't silently ignored downstream.
  slider.addEventListener('input', () => {
    const day = Number(slider.value);
    setManualDay(day);
    if ($ui.get().timeMode !== 'manual') setTimeMode('manual');
  });

  // Theme chips
  wrap.querySelectorAll<HTMLButtonElement>('[data-theme]').forEach((c) => {
    c.addEventListener('click', () => {
      setTheme(c.dataset.theme as 'light' | 'dark');
    });
  });

  // Route chips
  wrap.querySelectorAll<HTMLButtonElement>('#route-chips .dev-chip').forEach((c) => {
    c.addEventListener('click', () => {
      sheet.hidden = true;
      fab.classList.remove('open');
      navigate(c.dataset.route!);
    });
  });

  // Grant chips (XP / gems / fragments)
  wrap.querySelectorAll<HTMLButtonElement>('[data-grant] .dev-chip').forEach((c) => {
    c.addEventListener('click', () => {
      const grant = (c.parentElement as HTMLElement).dataset.grant!;
      const amount = Number(c.dataset.amount);
      void doGrant(grant, amount);
    });
  });

  async function doGrant(kind: string, amount: number): Promise<void> {
    const u = $user.get();
    if (!u) {
      flash('請先登入', true);
      return;
    }
    flash('處理中…', false);
    try {
      if (kind === 'xp') {
        await awardXp(u.id, amount);
      } else if (kind === 'gems') {
        await addGems(u.id, amount);
      } else if (kind === 'frags') {
        await addFragments(u.id, amount);
      }
      const refreshed = await getUserFull(u.id);
      if (refreshed) $profile.set(refreshed);
      flash(`+${amount} ${labelFor(kind)} 已加入`, false);
    } catch (err) {
      flash((err as Error).message ?? '失敗', true);
    }
  }

  function flash(msg: string, isError: boolean): void {
    status.hidden = false;
    status.textContent = msg;
    status.classList.toggle('error', isError);
    window.clearTimeout((status as HTMLElement & { _t?: number })._t);
    (status as HTMLElement & { _t?: number })._t = window.setTimeout(() => {
      status.hidden = true;
    }, 1800);
  }

  // Reflect store state
  bind(wrap, $ui, (s) => {
    wrap.querySelectorAll<HTMLButtonElement>('#time-mode-chips .dev-chip').forEach((c) => {
      c.classList.toggle('selected', c.dataset.mode === s.timeMode);
    });
    wrap.querySelectorAll<HTMLButtonElement>('[data-theme]').forEach((c) => {
      c.classList.toggle('selected', c.dataset.theme === s.theme);
    });
    if (slider.value !== String(s.manualDay)) slider.value = String(s.manualDay);
    readout.textContent = 'D' + s.manualDay;
  });

  bind(wrap, $profile, (p) => {
    setText('[data-bind="xp"]', p ? `LV.${p.level} · ${p.current_xp} XP` : 'LV.? · 0 XP');
    setText('[data-bind="gems"]', String(p?.gems ?? 0));
    setText('[data-bind="frags"]', `${p?.fragment_count ?? 0} 碎片 · ${p?.card_count ?? 0} 卡`);
  });

  function setText(sel: string, value: string) {
    const el = wrap.querySelector<HTMLElement>(sel);
    if (el) el.textContent = value;
  }

  return wrap;
}

function labelFor(kind: string): string {
  if (kind === 'xp') return 'XP';
  if (kind === 'gems') return '寶石';
  return '碎片';
}
