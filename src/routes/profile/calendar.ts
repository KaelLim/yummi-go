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
import { $ui } from '@/store/ui';
import { $today } from '@/store/today';
import { navigate } from '@/router';
import { listCheckIns, updateCheckInItems, type CheckInRow } from '@/api/check-ins';
import { spendGemsForMakeup } from '@/api/wallet';
import { getGemBalance } from '@/api/wallet';
import { buildCalendar, type CalendarCell, type DayStatus } from '@/lib/calendar';
import { openItemsEditor } from '@/lib/items-editor';
import type { MockFood } from '@/lib/mock-ai';
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
      <span class="checkin-title">蔬食旅程</span>
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
    // Dev manual-day override: when the user drags the DevPanel day slider
    // to D=N, treat days 1..N-1 as ✓ on the calendar so the streak chip
    // and the calendar visuals agree without seeding a check-in per day.
    // Only kicks in when timeMode === 'manual' (prod stays untouched).
    const ui = $ui.get();
    if (ui.timeMode === 'manual') {
      const todayDay = $today.get().dayNumber;
      for (let d = 1; d <= todayDay; d++) checkedInDays.add(d);
    }
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

    // Wire makeable-day taps to open the makeup modal.
    grid.querySelectorAll<HTMLElement>('.cal-cell.is-makeable').forEach((el) => {
      el.addEventListener('click', () => {
        const dayNumber = Number(el.dataset.day);
        const iso = el.dataset.iso!;
        if (!Number.isFinite(dayNumber)) return;
        openMakeupModal({ host: wrap, iso, dayNumber, onDone: paint });
      });
    });
    // Done + today + lost days all open the nutrition recap modal. The
    // modal renders an empty-state message when no meals were logged
    // (e.g. today before first check-in, or a missed past day), so the
    // user can browse the calendar and tap any in-challenge day to see
    // what's there. The makeable case below still routes to the makeup
    // modal — that's its own decision flow.
    grid.querySelectorAll<HTMLElement>(
      '.cal-cell.is-done, .cal-cell.is-today, .cal-cell.is-lost',
    ).forEach((el) => {
      el.addEventListener('click', () => {
        const dayNumber = Number(el.dataset.day);
        const iso = el.dataset.iso!;
        if (!Number.isFinite(dayNumber)) return;
        openNutritionModal({
          host: wrap,
          iso,
          dayNumber,
          getRowsForDay: () => checkInRows.filter((r) => r.day_number === dayNumber),
          // After a successful meal edit, re-fetch check-ins so the
          // calendar (and any subsequent modal reopen) reflects the
          // updated nutrition.
          onChanged: async () => {
            const u = $user.get();
            if (!u) return;
            try { checkInRows = await listCheckIns(u.id); } catch { /* soft fail */ }
            paint();
          },
        });
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

  // Repaint when the DevPanel slider changes the manual day, so the
  // synthesized "all-days-done" preview matches the slider position.
  const unsubUi = $ui.subscribe(() => paint());
  const unsubToday = $today.subscribe(() => paint());
  // Tear the subscriptions down with the route element so SPA navigation
  // doesn't leak listeners.
  wrap.addEventListener('lifecycle:unmount', () => {
    unsubUi();
    unsubToday();
  });

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

interface NutritionTotals { cal: number; protein: number; carb: number; fat: number; fiber: number; }
interface ScannedItem { name: string; weightG?: number; cal?: number; protein?: number; carb?: number; fat?: number; fiber?: number; }

function safeParse<T>(s: string): T | null {
  try { return JSON.parse(s) as T; } catch { return null; }
}

function aggregateDayTotals(rows: CheckInRow[]): NutritionTotals {
  const acc: NutritionTotals = { cal: 0, protein: 0, carb: 0, fat: 0, fiber: 0 };
  for (const row of rows) {
    const n = safeParse<Partial<NutritionTotals>>(row.nutrition);
    if (!n) continue;
    acc.cal     += Number(n.cal     ?? 0);
    acc.protein += Number(n.protein ?? 0);
    acc.carb    += Number(n.carb    ?? 0);
    acc.fat     += Number(n.fat     ?? 0);
    acc.fiber   += Number(n.fiber   ?? 0);
  }
  // Round to 1 decimal so the modal doesn't show floating-point noise.
  for (const k of Object.keys(acc) as Array<keyof NutritionTotals>) {
    acc[k] = Math.round(acc[k] * 10) / 10;
  }
  return acc;
}

const MEAL_LABEL = ['', '第一餐', '第二餐', '第三餐'] as const;

interface NutritionRecapArgs {
  host: HTMLElement;
  iso: string;
  dayNumber: number;
  /** Resolver so the modal always reads the latest checkInRows from the
   *  calendar page after an edit refreshes them. */
  getRowsForDay: () => CheckInRow[];
  /** Called after a successful per-meal edit so the calendar page can
   *  re-fetch and the modal can repaint with new totals. */
  onChanged: () => void | Promise<void>;
}

/**
 * Nutrition recap modal — opens when the user taps a green ✓ day in the
 * calendar. Shows the day-total macros plus a per-meal breakdown of the
 * AI-scanned items. Each meal section carries a 修改內容 button, but only
 * on the LATEST logged meal of the day — once a later meal is recorded
 * the earlier ones lock per the spec rule "Once the data of the next
 * meal enters, you can not change the previous ones".
 */
function openNutritionModal({ host, iso, dayNumber, getRowsForDay, onChanged }: NutritionRecapArgs): void {
  const overlay = document.createElement('div');
  overlay.className = 'nutrition-recap-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');

  const md = new Date(iso);
  const dateLabel = `${md.getMonth() + 1}/${md.getDate()}`;
  const challengeLevel = $profile.get()?.challenge_level ?? null;
  const mealTarget = challengeLevel ?? 1;

  function paint(): void {
    const rows = getRowsForDay();
    const totals = aggregateDayTotals(rows);
    const sortedRows = rows.slice().sort((a, b) => a.meal_index - b.meal_index);
    const maxMealIndex = rows.length > 0
      ? Math.max(...rows.map((r) => r.meal_index))
      : 0;

    const totalsCard = `
      <section class="nutrition-card is-revealed">
        <div class="nutrition-card-head">
          <span class="ms">restaurant_menu</span>
          <strong>當日總攝取</strong>
        </div>
        <div class="nutrition-grid">
          <div class="nutrition-cell"><span class="nutrition-cell-label">熱量</span><strong>${Math.round(totals.cal)} kcal</strong></div>
          <div class="nutrition-cell"><span class="nutrition-cell-label">蛋白質</span><strong>${totals.protein} g</strong></div>
          <div class="nutrition-cell"><span class="nutrition-cell-label">碳水</span><strong>${totals.carb} g</strong></div>
          <div class="nutrition-cell"><span class="nutrition-cell-label">脂肪</span><strong>${totals.fat} g</strong></div>
          <div class="nutrition-cell"><span class="nutrition-cell-label">膳食纖維</span><strong>${totals.fiber} g</strong></div>
        </div>
      </section>
    `;

    const mealCards = sortedRows.map((row) => {
      const items = safeParse<ScannedItem[]>(row.food_items) ?? [];
      const veg = row.vegan_type ? `<span class="recap-meal-veg">${escapeHtml(row.vegan_type)}</span>` : '';
      const itemsHtml = items.length
        ? items.map((it) => `<li class="recap-item"><span>${escapeHtml(it.name ?? '未命名')}</span>${it.weightG ? `<span class="recap-item-w">${Math.round(it.weightG)} g</span>` : ''}</li>`).join('')
        : '<li class="recap-item recap-item-empty">沒有食材紀錄</li>';
      const isLatest = row.meal_index === maxMealIndex;
      const editAction = isLatest
        ? `<button class="recap-meal-edit" type="button" data-check-in-id="${row.id}"><span class="ms">edit</span>修改內容</button>`
        : `<span class="recap-meal-locked" title="已記錄下一餐，無法再修改"><span class="ms">lock</span>已鎖定</span>`;
      return `
        <section class="recap-meal">
          <header class="recap-meal-head">
            <strong>${MEAL_LABEL[row.meal_index] ?? `第 ${row.meal_index} 餐`}</strong>
            ${veg}
            ${editAction}
          </header>
          <ul class="recap-items">${itemsHtml}</ul>
        </section>
      `;
    }).join('');

    overlay.innerHTML = `
      <div class="nutrition-recap-card">
        <header class="nutrition-recap-head">
          <div class="nutrition-recap-titles">
            <h2 class="nutrition-recap-title">${dateLabel} · Day ${dayNumber}</h2>
            <p class="nutrition-recap-sub">完成 ${rows.length} / ${mealTarget} 餐蔬食${challengeLevel ? `（等級 ${challengeLevel}）` : ''}</p>
            <p class="nutrition-recap-rule"><span class="ms">info</span>下一餐記錄後，前面餐次不再可修改</p>
          </div>
          <button class="nutrition-recap-close" type="button" aria-label="關閉">
            <span class="ms">close</span>
          </button>
        </header>
        ${rows.length ? totalsCard : '<p class="nutrition-recap-empty">這天還沒有 AI 掃描紀錄。</p>'}
        ${mealCards}
      </div>
    `;

    overlay.querySelector('.nutrition-recap-close')?.addEventListener('click', close);
    overlay.querySelectorAll<HTMLButtonElement>('.recap-meal-edit').forEach((btn) => {
      btn.addEventListener('click', () => {
        const checkInId = Number(btn.dataset.checkInId);
        const row = rows.find((r) => r.id === checkInId);
        if (!row) return;
        const initial = (safeParse<MockFood[]>(row.food_items) ?? []) as MockFood[];
        openItemsEditor({
          host: overlay,
          initial,
          onSave: async (next, nextNutrition) => {
            try {
              await updateCheckInItems(checkInId, next, nextNutrition);
            } catch (err) {
              console.error('[recap] updateCheckInItems failed:', err);
              window.alert('儲存失敗，請稍後再試');
              return;
            }
            await onChanged();
            paint();
          },
        });
      });
    });
  }

  function close(): void { overlay.remove(); }
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  paint();
  host.appendChild(overlay);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;',
  );
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
