/**
 * Streak-recovery popup — fires on /check-in/success when the user
 * has just logged today's meal but yesterday's challenge day has no
 * check-in (and wasn't already made up). Offers them the chance to
 * spend gems to recover that missed day so their streak survives.
 *
 * Acts as a proactive prompt for the existing makeup-card flow that
 * lives at /profile/calendar — same persistence + pricing rules
 * (see lib/makeups-local.ts), just surfaced at the moment the user
 * is most likely to care (right after seeing their streak number).
 *
 * Spec hook: docs/UX_UPDATE_SPEC_v0.1 §5. Dev panel exposes
 * `previewStreakRecoveryPopup` to retest without engineering missed
 * days.
 */
import { $locale, type Locale, t } from '@/lib/i18n';
import { bind } from '@/lib/lifecycle';
import {
  readMakeups,
  recordMakeup,
  countMakeupsInMonth,
  priceFor,
  type MakeupState,
} from '@/lib/makeups-local';
import { gemIcon } from '@/lib/currency-icons';
import { getGemBalance, spendGemsForMakeup } from '@/api/wallet';
import { reloadWallet } from '@/store/pet';
import { showGemGain } from '@/lib/gem-toast';
import { KEYS, storage } from '@/lib/storage';

/** Persisted "I'll do it later" state for the recovery popup. The
 *  user tapping 稍後再說 stores the missed day + cost; /home reads
 *  this and surfaces a card under the missions list that re-opens
 *  the popup on tap. Cleared on successful recovery OR when the
 *  next day's check-in passes (since that day is now too far back
 *  to recover anyway). */
export interface DeferredStreakRecovery {
  userId: number;
  missedDay: number;
  costGems: number;
  deferredAt: number;
}

export function readDeferredStreakRecovery(): DeferredStreakRecovery | null {
  return storage.get<DeferredStreakRecovery | null>(
    KEYS.STREAK_RECOVERY_DEFERRED,
    null,
  );
}

export function clearDeferredStreakRecovery(): void {
  storage.remove(KEYS.STREAK_RECOVERY_DEFERRED);
}

function writeDeferred(entry: DeferredStreakRecovery): void {
  storage.set(KEYS.STREAK_RECOVERY_DEFERRED, entry);
}

export interface StreakRecoveryArgs {
  userId: number;
  /** Challenge day number that wasn't checked in. */
  missedDay: number;
  /** Cost in gems to recover. */
  costGems: number;
  /** Current gem balance. Disables the confirm CTA when too low. */
  gemBalance: number;
  /** Called after a successful recovery so the caller can refresh UI. */
  onRecovered?: () => void;
}

/**
 * If yesterday was missed (and not already made up), figure out the
 * cost and call `showStreakRecoveryPopup`. Returns true when the
 * popup was shown; false otherwise.
 */
export async function maybeShowStreakRecovery(args: {
  userId: number;
  todayDayNumber: number;
  /** All challenge-day numbers the user has a check-in for. */
  checkedInDays: Set<number>;
}): Promise<boolean> {
  const missed = args.todayDayNumber - 1;
  if (missed < 1) return false;
  if (args.checkedInDays.has(missed)) return false;
  const m: MakeupState = readMakeups(args.userId);
  if (m.days.includes(missed)) return false;

  const costGems = priceFor(countMakeupsInMonth(m.history));
  let gemBalance = 0;
  try {
    const row = await getGemBalance(args.userId);
    gemBalance = row?.balance ?? 0;
  } catch {
    /* soft-fail; popup will still render with 0 balance and the
       confirm button stays disabled */
  }
  showStreakRecoveryPopup({
    userId: args.userId,
    missedDay: missed,
    costGems,
    gemBalance,
  });
  return true;
}

/** Dev-only — show the popup with stub data to preview the UI. */
export function previewStreakRecoveryPopup(args: {
  userId: number;
  todayDayNumber: number;
}): void {
  showStreakRecoveryPopup({
    userId: args.userId,
    missedDay: Math.max(1, args.todayDayNumber - 1),
    costGems: 100,
    gemBalance: 250,
  });
}

export function showStreakRecoveryPopup(args: StreakRecoveryArgs): void {
  const existing = document.getElementById('streak-recovery-host');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'streak-recovery-overlay';
  overlay.id = 'streak-recovery-host';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');

  const card = document.createElement('div');
  card.className = 'streak-recovery-card';
  card.addEventListener('click', (e) => e.stopPropagation());
  overlay.append(card);

  const canAfford = args.gemBalance >= args.costGems;
  let confirming = false;

  function paint(locale: Locale): void {
    const closeLabel = locale === 'en' ? 'Close' : '關閉';
    card.innerHTML = `
      <header class="streak-recovery-head">
        <span class="streak-recovery-eyebrow">${escapeHtml(t('streakRecovery.eyebrow'))}</span>
        <button class="streak-recovery-close" type="button" aria-label="${escapeAttr(closeLabel)}">
          <span class="ms">close</span>
        </button>
      </header>
      <div class="streak-recovery-hero" aria-hidden="true">🔥</div>
      <h2 class="streak-recovery-title">${escapeHtml(t('streakRecovery.title'))}</h2>
      <p class="streak-recovery-body">${escapeHtml(
        t('streakRecovery.bodyFmt').replace('{day}', `D${args.missedDay}`),
      )}</p>
      <div class="streak-recovery-cost">
        ${gemIcon(22)}
        <span class="streak-recovery-cost-num">${args.costGems}</span>
        <span class="streak-recovery-cost-label">${escapeHtml(t('streakRecovery.costLabel'))}</span>
      </div>
      <p class="streak-recovery-balance">${escapeHtml(
        t('streakRecovery.balanceFmt').replace('{n}', String(args.gemBalance)),
      )}</p>
      ${
        !canAfford
          ? `<p class="streak-recovery-warn">${escapeHtml(t('streakRecovery.insufficient'))}</p>`
          : ''
      }
      <div class="streak-recovery-actions">
        <button class="btn btn-secondary btn-l text-btn-l" type="button" data-action="skip">
          ${escapeHtml(t('streakRecovery.skip'))}
        </button>
        <button class="btn btn-primary btn-l text-btn-l" type="button" data-action="recover" ${
          canAfford ? '' : 'disabled'
        }>
          ${escapeHtml(t('streakRecovery.recover'))}
        </button>
      </div>
    `;
    card.querySelector<HTMLButtonElement>('[data-action="skip"]')?.addEventListener('click', dismiss);
    card.querySelector<HTMLButtonElement>('.streak-recovery-close')?.addEventListener('click', dismiss);
    card.querySelector<HTMLButtonElement>('[data-action="recover"]')?.addEventListener('click', () => {
      void recover();
    });
  }

  function dismiss(): void {
    // 稍後再說 / close X → persist the deferred state so /home can
    // surface a card under the missions list to re-open this popup.
    writeDeferred({
      userId: args.userId,
      missedDay: args.missedDay,
      costGems: args.costGems,
      deferredAt: Date.now(),
    });
    overlay.remove();
  }

  async function recover(): Promise<void> {
    if (confirming || !canAfford) return;
    confirming = true;
    const confirmBtn = card.querySelector<HTMLButtonElement>('[data-action="recover"]');
    if (confirmBtn) {
      confirmBtn.disabled = true;
      confirmBtn.textContent = t('common.saving');
    }
    try {
      await spendGemsForMakeup(args.userId, args.costGems, args.missedDay);
      recordMakeup(args.userId, {
        day: args.missedDay,
        gemCost: args.costGems,
        madeAt: new Date().toISOString(),
      });
      await reloadWallet(args.userId);
      showGemGain(-args.costGems);
      // Recovery succeeded — drop any deferred state so the home
      // card stops surfacing.
      clearDeferredStreakRecovery();
      args.onRecovered?.();
      overlay.remove();
    } catch (err) {
      console.warn('[streak-recovery] spendGems failed:', err);
      const warn = document.createElement('p');
      warn.className = 'streak-recovery-warn';
      warn.textContent = (err as Error).message ?? t('common.error');
      card.appendChild(warn);
      confirming = false;
      if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.textContent = t('streakRecovery.recover');
      }
    }
  }

  paint($locale.get());
  bind(overlay, $locale, paint);
  document.body.appendChild(overlay);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;',
  );
}

function escapeAttr(s: string): string {
  return escapeHtml(s);
}
