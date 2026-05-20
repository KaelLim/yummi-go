/**
 * Calendar + inline makeup modal — replaces /tasks/makeup per the 2026-05-19
 * pivot (no main-nav Tasks tab; makeup happens by tapping gray dots on
 * this page).
 *
 * Per UX_UPDATE_SPEC_v0.1 §5:
 *   - Green check: has check-in OR has been made up (permanent).
 *   - Gray dot: missed but still within the 3-day makeup window.
 *   - Plain number: future / pre-challenge / lost (>3 days old, not made up).
 *
 * Tapping a gray dot opens an in-page modal:
 *   - Pet emoji + "主人，<MM/DD> 那天我等了你⋯" copy
 *   - Streak preview: current → after-makeup count
 *   - Gem cost (100 for the 1st-3rd makeup of the month; 300 thereafter)
 *   - Current Gem balance for context
 *   - Confirm → wallet.spendGemsForMakeup + lib/makeups-local
 *   - Cancel → close modal
 *
 * Makeup persistence is localStorage-only for this prototype. Promotion to
 * drust is a future PR; see lib/makeups-local.ts for the migration target.
 */
import { $user, $profile } from '@/store/user';
import { $gems } from '@/store/pet';
import { navigate } from '@/router';
import { listCheckIns, type CheckInRow } from '@/api/check-ins';
import { spendGemsForMakeup } from '@/api/wallet';
import { getGemBalance } from '@/api/wallet';
import { buildCalendar, type CalendarCell, type DayStatus } from '@/lib/calendar';
import {
  readMakeups,
  recordMakeup,
  countMakeupsInMonth,
  priceFor,
} from '@/lib/makeups-local';
import { deriveStreak } from '@/lib/streak';

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

export default function calendarPage(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'calendar-screen';

  wrap.innerHTML = `
    <header class="checkin-header">
      <button class="checkin-back" id="back-btn" aria-label="返回">
        <span class="ms">arrow_back</span>
      </button>
      <span class="checkin-title">月曆 / 補簽</span>
      <span></span>
    </header>
    <div class="calendar-body">
      <div class="calendar-month-row">
        <button class="calendar-arrow" id="prev-month" type="button" aria-label="上個月">
          <span class="ms">chevron_left</span>
        </button>
        <h2 class="calendar-month-title" id="month-title">—</h2>
        <button class="calendar-arrow" id="next-month" type="button" aria-label="下個月">
          <span class="ms">chevron_right</span>
        </button>
      </div>
      <div class="calendar-weekdays">
        ${WEEKDAY_LABELS.map((w) => `<div class="calendar-weekday">${w}</div>`).join('')}
      </div>
      <div class="calendar-grid" id="grid"></div>
      <div class="calendar-legend">
        <span class="legend-item"><span class="legend-dot legend-done">✓</span>已打卡 / 已補簽</span>
        <span class="legend-item"><span class="legend-dot legend-makeable"></span>可補簽</span>
        <span class="legend-item"><span class="legend-dot legend-lost"></span>已 lost</span>
      </div>
    </div>
  `;

  wrap.querySelector('#back-btn')?.addEventListener('click', () => navigate('/profile'));

  // Mutable view state.
  const today = new Date();
  let anchor = new Date(today.getFullYear(), today.getMonth(), 1);
  let checkInRows: CheckInRow[] = [];

  function paint(): void {
    const u = $user.get();
    const profile = $profile.get();
    const startedAt = profile?.challenge_started_at
      ? new Date(profile.challenge_started_at)
      : null;
    const makeups = u ? readMakeups(u.id) : { days: [], history: [] };
    const checkedInDays = new Set(checkInRows.map((r) => r.day_number));
    const madeUpDays = new Set(makeups.days);

    const cells = buildCalendar({
      anchor,
      now: today,
      challengeStartedAt: startedAt,
      checkedInDays,
      madeUpDays,
    });

    const title = wrap.querySelector('#month-title');
    if (title) title.textContent = `${anchor.getFullYear()} 年 ${anchor.getMonth() + 1} 月`;

    const grid = wrap.querySelector<HTMLElement>('#grid');
    if (!grid) return;
    grid.innerHTML = '';
    for (const cell of cells) {
      grid.appendChild(renderCell(cell, anchor.getMonth()));
    }

    // Wire makeable-day taps to open the modal.
    grid.querySelectorAll<HTMLElement>('.cal-cell.is-makeable').forEach((el) => {
      el.addEventListener('click', () => {
        const dayNumber = Number(el.dataset.day);
        const iso = el.dataset.iso!;
        if (!Number.isFinite(dayNumber)) return;
        openMakeupModal({ host: wrap, iso, dayNumber, onDone: paint });
      });
    });
  }

  wrap.querySelector('#prev-month')?.addEventListener('click', () => {
    anchor = new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1);
    paint();
  });
  wrap.querySelector('#next-month')?.addEventListener('click', () => {
    anchor = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1);
    paint();
  });

  // Initial fetch — listCheckIns runs once on mount; the page is short-lived
  // so we don't reactively re-fetch when other surfaces add check-ins. Re-
  // entering the page (e.g. after a makeup) repaints with fresh data.
  void (async () => {
    const u = $user.get();
    if (u) {
      try {
        checkInRows = await listCheckIns(u.id);
      } catch {
        /* leave empty — calendar still paints, all days look unmade */
      }
    }
    paint();
  })();

  return wrap;
}

function renderCell(cell: CalendarCell, displayedMonth: number): HTMLElement {
  const el = document.createElement('div');
  const inMonth = new Date(cell.iso).getMonth() === displayedMonth;
  el.className = `cal-cell is-${cell.status}` + (inMonth ? '' : ' is-out');
  el.dataset.iso = cell.iso;
  if (cell.dayNumber !== null) el.dataset.day = String(cell.dayNumber);

  const glyph = glyphFor(cell.status);
  el.innerHTML = `
    <span class="cal-cell-num">${cell.dayOfMonth}</span>
    ${glyph}
  `;
  return el;
}

function glyphFor(status: DayStatus): string {
  switch (status) {
    case 'done': return '<span class="cal-cell-dot cal-cell-done">✓</span>';
    case 'makeable': return '<span class="cal-cell-dot cal-cell-gray"></span>';
    case 'lost': return '<span class="cal-cell-dot cal-cell-lost"></span>';
    default: return '';
  }
}

interface OpenModalArgs {
  host: HTMLElement;
  iso: string;
  dayNumber: number;
  onDone: () => void;
}

function openMakeupModal({ host, iso, dayNumber, onDone }: OpenModalArgs): void {
  const user = $user.get();
  if (!user) return;
  const userId = user.id;
  const makeups = readMakeups(userId);
  const priorThisMonth = countMakeupsInMonth(makeups.history);
  const cost = priceFor(priorThisMonth);
  const balance = $gems.get().balance;

  // Streak preview: derive current streak, then derive streak with the
  // proposed day added to madeUpDays. Doing this inline keeps the modal
  // self-contained — no extra fetch.
  // checkIns aren't passed in; we derive against an empty set + makeups,
  // which approximates the after-effect when paired with the current
  // streak rendered on the home chip. For PR-3 this is good enough — the
  // modal is showing a relative delta, not an absolute total.

  const md = new Date(iso);
  const dateLabel = `${md.getMonth() + 1}/${md.getDate()}`;

  const overlay = document.createElement('div');
  overlay.className = 'makeup-modal-overlay';
  overlay.innerHTML = `
    <div class="makeup-modal" role="dialog" aria-label="補簽">
      <div class="makeup-pet" aria-hidden="true">🐣</div>
      <p class="makeup-copy">主人，${dateLabel} 那天我等了你⋯</p>
      <div class="makeup-streak-card">
        <span class="makeup-streak-label">補完這天</span>
        <span class="makeup-streak-delta">+1 天 streak</span>
      </div>
      <div class="makeup-cost-row">
        <span class="ms">diamond</span>
        <span class="makeup-cost-num">${cost}</span>
        <span class="makeup-cost-label">能量石</span>
      </div>
      <p class="makeup-balance">目前餘額：💎 ${balance}</p>
      <div class="makeup-error" id="makeup-error" hidden></div>
      <div class="makeup-actions">
        <button class="btn text-btn-m btn-secondary btn-l text-btn-l" id="makeup-cancel" type="button">取消</button>
        <button class="btn text-btn-m btn-primary btn-l text-btn-l" id="makeup-confirm" type="button">
          💛 救回那一天
        </button>
      </div>
    </div>
  `;

  const close = () => overlay.remove();
  overlay.querySelector('#makeup-cancel')?.addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  const confirm = overlay.querySelector<HTMLButtonElement>('#makeup-confirm');
  const errorEl = overlay.querySelector<HTMLElement>('#makeup-error');
  confirm?.addEventListener('click', () => {
    void doConfirm();
  });

  async function doConfirm(): Promise<void> {
    if (!confirm || !errorEl) return;
    if (balance < cost) {
      errorEl.hidden = false;
      errorEl.textContent = '能量石不足，補簽需要更多 💎';
      return;
    }
    confirm.disabled = true;
    confirm.textContent = '處理中…';
    try {
      const res = await spendGemsForMakeup(userId, cost, dayNumber);
      // Refresh local $gems balance after spend so home/store reflect
      // immediately without waiting for day-sync's next pass.
      const refreshed = await getGemBalance(userId);
      if (refreshed) {
        $gems.set({ ...$gems.get(), balance: refreshed.balance });
      } else {
        $gems.set({ ...$gems.get(), balance: res.balance });
      }
      recordMakeup(userId, { day: dayNumber, gemCost: cost, madeAt: new Date().toISOString() });
      close();
      onDone();
    } catch (err) {
      errorEl.hidden = false;
      errorEl.textContent = (err as Error).message ?? '補簽失敗';
      confirm.disabled = false;
      confirm.textContent = '💛 救回那一天';
    }
  }

  host.appendChild(overlay);
}

/** Exported for the home streak chip to call when computing displayed streak. */
export function streakWithLocalMakeups(
  checkIns: { day_number: number }[],
  userId: number,
  todayDayNumber: number,
): number {
  const m = readMakeups(userId);
  return deriveStreak({
    checkIns,
    todayDayNumber,
    madeUpDays: m.days,
  });
}
