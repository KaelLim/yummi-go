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
import {
  $pet,
  addStrike,
  awardXp,
  clearStrikes,
  poisonRemainingMs,
} from '@/store/pet';
import { resetTodayProgress } from '@/store/today';
import { addGems, addFragments, resetGems, resetMakeup } from '@/api/wallet';
import { resetPet } from '@/api/pet';
import { deleteAllCheckIns } from '@/api/check-ins';
import { getUserFull } from '@/api/profile';
import { setPetFromRow } from '@/store/pet';
import { navigate } from '@/router';
import { bind } from '@/lib/lifecycle';
import { showGemGain } from '@/lib/gem-toast';

const ROUTES: Array<{ label: string; path: string }> = [
  { label: '首頁', path: '/home' },
  { label: '地圖', path: '/map' },
  { label: '打卡', path: '/check-in' },
  { label: '任務', path: '/tasks' },
  { label: '我的', path: '/profile' },
  { label: 'Day-30', path: '/challenge/day-30' },
  { label: 'Flows', path: '/dev/flows' },
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

      <section class="dev-section">
        <div class="dev-label-row">
          <span class="dev-label">違規警告 (3 strikes)</span>
          <span class="dev-readout" data-bind="strikes">0 / 3</span>
        </div>
        <div class="dev-chips" id="strike-chips">
          <button class="dev-chip" data-strike="add">+1 Strike</button>
          <button class="dev-chip" data-strike="pardon">特赦 / 解毒</button>
        </div>
      </section>

      <div class="dev-status" id="dev-status" hidden></div>

      <section class="dev-section">
        <span class="dev-label">重置</span>
        <div class="dev-chips" id="reset-chips">
          <button class="dev-chip" data-reset="today">今日進度</button>
          <button class="dev-chip" data-reset="pet">寵物 LV1</button>
          <button class="dev-chip" data-reset="wallet">錢包歸零</button>
          <button class="dev-chip dev-chip-danger" data-reset="checkins">清空打卡</button>
          <button class="dev-chip dev-chip-danger" data-reset="all">全部重置</button>
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

  // Reset chips
  wrap.querySelectorAll<HTMLButtonElement>('#reset-chips .dev-chip').forEach((c) => {
    c.addEventListener('click', () => {
      const which = c.dataset.reset!;
      void doReset(which);
    });
  });

  // Strike chips — drives the 寵物食物中毒 demo
  wrap.querySelectorAll<HTMLButtonElement>('#strike-chips .dev-chip').forEach((c) => {
    c.addEventListener('click', () => {
      const u = $user.get();
      if (!u) {
        flash('請先登入', true);
        return;
      }
      if (c.dataset.strike === 'add') {
        void addStrike(u.id).then((total) => {
          if (total >= 3) flash('已觸發中毒：mood=critical 24 小時', true);
          else flash(`Strike ${total}/3`, false);
        });
      } else {
        void clearStrikes(u.id).then(() => flash('已特赦並解毒', false));
      }
    });
  });

  // Two-stage confirm: first click arms the chip (red flash + countdown),
  // a second click within 4 seconds executes. Avoids native window.confirm
  // which blocks the runtime and is awkward for automated test flows.
  let armed: { which: string; timer: number } | null = null;

  function armOrFire(which: string): boolean {
    const needsConfirm = which === 'pet' || which === 'wallet' || which === 'checkins' || which === 'all';
    if (!needsConfirm) return true;
    if (armed && armed.which === which) {
      window.clearTimeout(armed.timer);
      armed = null;
      return true;
    }
    if (armed) window.clearTimeout(armed.timer);
    armed = {
      which,
      timer: window.setTimeout(() => {
        armed = null;
        flash('已取消重置', false);
      }, 4000),
    };
    flash(`${labelForReset(which)}：再次點擊確認（4 秒內）`, true);
    return false;
  }

  async function doReset(which: string): Promise<void> {
    if (!armOrFire(which)) return;
    const u = $user.get();
    if (!u && which !== 'today') {
      flash('請先登入', true);
      return;
    }
    flash('處理中…', false);
    try {
      if (which === 'today') {
        resetTodayProgress();
      } else if (which === 'pet' && u) {
        const next = await resetPet(u.id);
        setPetFromRow(next);
      } else if (which === 'wallet' && u) {
        await resetGems(u.id);
        await resetMakeup(u.id);
      } else if (which === 'checkins' && u) {
        const n = await deleteAllCheckIns(u.id);
        flash(`已刪除 ${n} 筆打卡`, false);
      } else if (which === 'all' && u) {
        const next = await resetPet(u.id);
        setPetFromRow(next);
        await resetGems(u.id);
        await resetMakeup(u.id);
        const n = await deleteAllCheckIns(u.id);
        resetTodayProgress();
        flash(`完全重置（刪 ${n} 筆打卡）`, false);
      }
      if (u) {
        const refreshed = await getUserFull(u.id);
        if (refreshed) $profile.set(refreshed);
      }
      if (!['checkins', 'all'].includes(which)) {
        flash(`重置完成：${labelForReset(which)}`, false);
      }
    } catch (err) {
      flash((err as Error).message ?? '失敗', true);
    }
  }

  async function doGrant(kind: string, amount: number): Promise<void> {
    const u = $user.get();
    if (!u) {
      flash('請先登入', true);
      return;
    }
    flash('處理中…', false);
    try {
      if (kind === 'xp') {
        await awardXp(u.id, amount, 'devpanel');
      } else if (kind === 'gems') {
        await addGems(u.id, amount, 'devpanel_add');
        showGemGain(amount);
      } else if (kind === 'frags') {
        await addFragments(u.id, amount, 'devpanel');
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

  bind(wrap, $pet, (p) => {
    const strikes = p?.strikes ?? 0;
    const remaining = poisonRemainingMs(p);
    if (remaining > 0) {
      const hrs = Math.ceil(remaining / 3600_000);
      setText('[data-bind="strikes"]', `${strikes}/3 · 中毒 ${hrs}h`);
    } else {
      setText('[data-bind="strikes"]', `${strikes} / 3`);
    }
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

function labelForReset(which: string): string {
  if (which === 'today') return '今日進度';
  if (which === 'pet') return '寵物 LV1';
  if (which === 'wallet') return '錢包歸零';
  if (which === 'checkins') return '清空打卡';
  return '全部';
}
