/**
 * Floating dev panel — only mounted when $ui.devMode is true (?dev in URL).
 *
 * Provides a quick way to:
 *  - swap timeMode between real / compressed / manual
 *  - drag a slider to jump to any of the 30 days (manual mode only)
 *  - flip theme light/dark
 *  - deep-link to the main 5 routes + day-30
 *
 * Lives outside the route tree; mounted next to the layout shell so it
 * stays put while routes swap.
 */
import {
  $ui,
  setTheme,
  setTimeMode,
  setManualDay,
  type TimeMode,
} from '@/store/ui';
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

  // Manual-day slider
  slider.addEventListener('input', () => {
    const day = Number(slider.value);
    setManualDay(day);
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
    slider.disabled = s.timeMode !== 'manual';
  });

  return wrap;
}
