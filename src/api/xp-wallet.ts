/**
 * Per-user XP wallet — receives earned XP and lets the user manually
 * spend it by feeding the pet (capped at PET_DAILY_XP_CAP per local day)
 * or, once the cap is reached, by converting the remainder to gems at
 * the documented 1 XP = 1 Gem rate.
 *
 * One row per user keyed by user_id (UNIQUE idx_xp_balances_user_id).
 * Reads are list-filter-client-side because drust list params are
 * silently ignored.
 */
import { drust } from './drust';
import {
  recordXpEvent,
  recordGemEvent,
  type XpReason,
} from './events';
import { addXp as petAddXp, type PetState } from './pet';

export const PET_DAILY_XP_CAP = 100;
/** 1 XP buys 1 gem once the daily pet cap is hit (per docs/analysis CSV). */
export const XP_TO_GEM_RATE = 1;

export interface XpBalance {
  id: number;
  user_id: number;
  balance: number;
  total_earned: number;
  fed_today: number;
  fed_today_date: string | null;
}

function localDateKey(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

async function fetchRow(userId: number): Promise<XpBalance | null> {
  const result = await drust.list<XpBalance>('xp_balances');
  return result.records.find((r) => r.user_id === userId) ?? null;
}

/**
 * Fetch the wallet and roll over fed_today on local-date change. Returns
 * a normalised row whose fed_today_date is always today's local key (or
 * null only if the row was just created and never fed).
 */
export async function getXpBalance(userId: number): Promise<XpBalance | null> {
  const row = await fetchRow(userId);
  if (!row) return null;
  const today = localDateKey();
  if (row.fed_today_date && row.fed_today_date !== today && row.fed_today !== 0) {
    await drust.update('xp_balances', row.id, {
      fed_today: 0,
      fed_today_date: today,
    });
    return { ...row, fed_today: 0, fed_today_date: today };
  }
  return row;
}

/**
 * Read the wallet, lazily bootstrapping if missing. Used by write paths
 * and by the UI so accounts predating the bootstrap addition heal on
 * first touch instead of silently swallowing every earn.
 */
export async function getOrBootstrapXpBalance(
  userId: number,
): Promise<XpBalance> {
  const existing = await getXpBalance(userId);
  if (existing) return existing;
  return bootstrapXpBalance(userId);
}

/**
 * Credit XP earned from an action into the wallet. Idempotent-ish: each
 * call is one xp_events row, even when refId is null (we don't try to
 * dedupe earn events — that's the caller's responsibility).
 */
export async function creditXp(
  userId: number,
  amount: number,
  reason: XpReason = 'check_in',
  refId: number | null = null,
): Promise<XpBalance> {
  if (amount <= 0) {
    return getOrBootstrapXpBalance(userId);
  }
  const row = await getOrBootstrapXpBalance(userId);
  const next = {
    balance: row.balance + amount,
    total_earned: row.total_earned + amount,
  };
  await drust.update('xp_balances', row.id, next);
  void recordXpEvent({
    userId,
    deltaXp: amount,
    reason,
    refId,
    levelBefore: 0,
    levelAfter: 0,
    accumulatedXpAfter: next.total_earned,
  });
  return { ...row, ...next };
}

export interface FeedPetResult {
  fed: number;
  remainingBalance: number;
  fedToday: number;
  capReached: boolean;
  pet: PetState | null;
}

/**
 * Move XP from wallet → pet_states. Caps at min(balance, cap - fed_today)
 * so the daily 100 XP rule cannot be bypassed even if the caller asks
 * for more. Returns the actual amount fed plus the updated balances.
 * No-op (fed=0) when the cap is already reached.
 */
export async function feedPet(
  userId: number,
  requestedAmount: number = Number.POSITIVE_INFINITY,
): Promise<FeedPetResult> {
  const row = await getOrBootstrapXpBalance(userId);
  const today = localDateKey();
  const remainingCap = Math.max(0, PET_DAILY_XP_CAP - row.fed_today);
  const fed = Math.max(0, Math.min(row.balance, remainingCap, requestedAmount));
  if (fed === 0) {
    return {
      fed: 0,
      remainingBalance: row.balance,
      fedToday: row.fed_today,
      capReached: row.fed_today >= PET_DAILY_XP_CAP,
      pet: null,
    };
  }
  const newBalance = row.balance - fed;
  const newFedToday = row.fed_today + fed;
  await drust.update('xp_balances', row.id, {
    balance: newBalance,
    fed_today: newFedToday,
    fed_today_date: today,
  });
  // Feeding writes the pet's accumulated_xp + emits its own xp_events
  // entry (reason='feed_pet') so the history shows both halves of the
  // transaction: the earn into the wallet, and the wallet→pet transfer.
  const pet = await petAddXp(userId, fed, 'feed_pet', null);
  return {
    fed,
    remainingBalance: newBalance,
    fedToday: newFedToday,
    capReached: newFedToday >= PET_DAILY_XP_CAP,
    pet,
  };
}

export interface ConvertXpToGemsResult {
  converted: number;
  gemsEarned: number;
  remainingBalance: number;
  newGemBalance: number;
}

/**
 * Empty the wallet into gem_balances at XP_TO_GEM_RATE. Intended UX:
 * surfaced only after the pet's daily cap is reached, so the user can
 * still spend XP earned past 100 — but the function itself does NOT
 * enforce that gating, so admin/dev tools can also convert at will.
 */
export async function convertXpToGems(
  userId: number,
): Promise<ConvertXpToGemsResult> {
  const row = await getOrBootstrapXpBalance(userId);
  const converted = row.balance;
  if (converted === 0) {
    return {
      converted: 0,
      gemsEarned: 0,
      remainingBalance: 0,
      newGemBalance: NaN,
    };
  }
  const gemsEarned = Math.floor(converted * XP_TO_GEM_RATE);
  // Pull current gem balance so we can compute balance_after for the event.
  const gemList = await drust.list<{ id: number; user_id: number; balance: number; total_earned: number }>('gem_balances');
  const gem = gemList.records.find((r) => r.user_id === userId);
  if (!gem) throw new Error('Gem balance not found');
  const newGemBalance = gem.balance + gemsEarned;
  await drust.update('xp_balances', row.id, { balance: 0 });
  await drust.update('gem_balances', gem.id, {
    balance: newGemBalance,
    total_earned: gem.total_earned + gemsEarned,
  });
  void recordGemEvent({
    userId,
    delta: gemsEarned,
    reason: 'xp_overflow',
    balanceAfter: newGemBalance,
  });
  return {
    converted,
    gemsEarned,
    remainingBalance: 0,
    newGemBalance,
  };
}

/**
 * Bootstrap helper — called from auth.register alongside the other
 * default-row inserts. Idempotent: returns existing row if one is
 * already there.
 */
export async function bootstrapXpBalance(userId: number): Promise<XpBalance> {
  const existing = await fetchRow(userId);
  if (existing) return existing;
  const result = await drust.insert<XpBalance>('xp_balances', {
    user_id: userId,
    balance: 0,
    total_earned: 0,
    fed_today: 0,
    fed_today_date: null,
  });
  return result.record;
}
