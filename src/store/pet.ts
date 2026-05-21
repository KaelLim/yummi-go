/**
 * Pet + wallet global stores.
 *
 * $pet mirrors the user's pet_states row. Strikes / poison_until are
 * server-side fields now (drust pet_states.strikes + pet_states.poisoned_until).
 * The store still exposes them as numbers / epoch-ms for the UI; we
 * convert at the API boundary.
 *
 * $gems aggregates the three spendable resources rendered in the home
 * header: wallet XP (xp_balances.balance — the food bag), gems
 * (gem_balances.balance), and makeup cards (makeup_cards.card_count).
 * reloadWallet pulls all three in parallel from drust and writes the
 * store atomically.
 */
import { atom } from 'nanostores';
import * as petApi from '@/api/pet';
import * as xpWallet from '@/api/xp-wallet';
import * as walletApi from '@/api/wallet';
import { stageFromLevel, type PetStage } from '@/lib/pet-evolution';
import type { PetMood } from '@/lib/pet-sprites';
import { showGemGain } from '@/lib/gem-toast';

export const POISON_DURATION_MS = 24 * 60 * 60 * 1000; // 24h
export const STRIKE_THRESHOLD = 3;

export interface PetStoreShape {
  level: number;
  currentXp: number;
  accumulatedXp: number;
  stage: PetStage;
  mood: string;
  strikes: number;
  poisonedUntil: number | null; // epoch ms, parsed from pet_states.poisoned_until ISO string
}

export interface GemsStoreShape {
  /** All-time XP earned by this user (xp_balances.total_earned). The
   *  per-day wallet balance is no longer surfaced since awardXp auto-
   *  distributes; total_earned is the meaningful counter to show. */
  totalXp: number;
  balance: number;
  fragments: number;
  makeupCards: number;
}

export const $pet = atom<PetStoreShape | null>(null);
export const $gems = atom<GemsStoreShape>({
  totalXp: 0,
  balance: 0,
  fragments: 0,
  makeupCards: 0,
});

function isoToEpoch(iso: string | null): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : ms;
}

function epochToIso(ms: number | null): string | null {
  return ms === null ? null : new Date(ms).toISOString();
}

export function setPetFromRow(p: petApi.PetState) {
  $pet.set({
    level: p.level,
    currentXp: p.current_xp,
    accumulatedXp: p.accumulated_xp,
    stage: (p.stage as PetStage) ?? stageFromLevel(p.level),
    mood: p.mood,
    strikes: p.strikes ?? 0,
    poisonedUntil: isoToEpoch(p.poisoned_until ?? null),
  });
}

export async function reloadPet(userId: number) {
  const p = await petApi.getPet(userId);
  if (p) setPetFromRow(p);
}

/**
 * Pull wallet XP + gems + makeup-cards in parallel and push the
 * aggregated values into $gems. Used by day-sync on user/day change
 * and by check-in success after a wallet mutation so the home header
 * stays in sync with drust.
 */
export async function reloadWallet(userId: number): Promise<void> {
  const [xp, gem, mu] = await Promise.all([
    xpWallet.getOrBootstrapXpBalance(userId),
    walletApi.getGemBalance(userId),
    walletApi.getMakeupCards(userId),
  ]);
  $gems.set({
    totalXp: xp.total_earned,
    balance: gem?.balance ?? 0,
    fragments: mu?.fragment_count ?? 0,
    makeupCards: mu?.card_count ?? 0,
  });
}

export interface AwardXpResult {
  /** XP credited to the wallet (== deltaXp on success, 0 on early return). */
  credited: number;
  /** Slice that auto-fed the pet (≤ PET_DAILY_XP_CAP - fed_today). */
  xpFedToPet: number;
  /** Gems gained from auto-converting the overflow (1 XP = 1 gem). */
  gemsFromXp: number;
}

/**
 * Earn XP and auto-distribute it. Credits xp_balances, then immediately
 * feeds the pet up to PET_DAILY_XP_CAP for the local day and converts any
 * leftover XP into gems at 1:1. Callers that don't care about the split
 * can ignore the return value — most just want the credit + feed to
 * happen as a side effect. /check-in/result is the only caller that
 * reads the result to display the breakdown on /check-in/success.
 *
 * Each leg emits its own xp_events / gem_events row so the history shows
 * the wallet credit, the wallet→pet transfer, and the overflow→gem swap
 * as discrete entries.
 *
 * Local stores ($pet, $gems) are also synced here so the SPA UI reacts
 * immediately — without this, home's level-bar / resource chips would
 * sit on stale values until the next bootstrap (i.e. a page refresh).
 */
/** +N gems awarded once per local day when the user first crosses the
 *  100-XP pet-feed cap. Tunable; the flag-driven home celebration popup
 *  uses this value verbatim in its breakdown. */
export const XP_MILESTONE_BONUS_GEMS = 10;

/** localStorage key consumed by home to render the milestone popup on
 *  the user's next page mount. Value is JSON-encoded
 *  { bonus: number, overflow: number }. */
export const MILESTONE_PENDING_KEY = 'yummi:xp_milestone_pending';

export async function awardXp(
  userId: number,
  deltaXp: number,
  reason: petApi.XpReason = 'check_in',
  refId: number | null = null,
): Promise<AwardXpResult> {
  if (deltaXp <= 0) {
    return { credited: 0, xpFedToPet: 0, gemsFromXp: 0 };
  }
  await xpWallet.creditXp(userId, deltaXp, reason, refId);
  const fed = await xpWallet.feedPet(userId);
  let gemsFromXp = 0;
  if (fed.remainingBalance > 0) {
    const conv = await xpWallet.convertXpToGems(userId);
    gemsFromXp = conv.gemsEarned;
  }
  // Push the new pet row into $pet so the level-bar + sprite re-render
  // immediately. fed.pet is null only when fed.fed === 0 (cap already
  // hit) — in that case the existing $pet is already correct.
  if (fed.pet) setPetFromRow(fed.pet);

  // Milestone: first time crossing 100 XP today. Award the bonus gems
  // immediately, drop a flag for the next home mount to celebrate, and
  // SUPPRESS the per-meal gem-gain toast — the popup will summarise the
  // whole moment so the toast would feel redundant.
  if (fed.crossedTodayCap) {
    try {
      await walletApi.addGems(userId, XP_MILESTONE_BONUS_GEMS, 'xp_milestone');
    } catch (err) {
      console.warn('[awardXp] milestone bonus failed:', err);
    }
    void reloadWallet(userId);
    try {
      localStorage.setItem(MILESTONE_PENDING_KEY, JSON.stringify({
        bonus: XP_MILESTONE_BONUS_GEMS,
        overflow: gemsFromXp,
      }));
      console.info('[awardXp] milestone flag set — next home mount shows popup', {
        bonus: XP_MILESTONE_BONUS_GEMS,
        overflow: gemsFromXp,
      });
    } catch { /* private mode — popup just won't fire, no harm */ }
    return { credited: deltaXp, xpFedToPet: fed.fed, gemsFromXp };
  }

  // Refresh wallet / gem / makeup-card totals for the resource chips.
  void reloadWallet(userId);
  if (gemsFromXp > 0) showGemGain(gemsFromXp);
  return { credited: deltaXp, xpFedToPet: fed.fed, gemsFromXp };
}

/**
 * Strike writes are serialised through this chain so rapid clicks don't
 * race. Without this, three +Strike clicks in 50ms each launch their own
 * `getPet → update_record` round-trip; whichever update_record commits
 * last on the server wins, and the count drifts (saw strikes=2 in drust
 * after 3 clicks during live verification).
 *
 * Each enqueue returns the chain head; the next caller awaits it before
 * computing its own delta, so reads always see the post-write state.
 */
let strikeChain: Promise<unknown> = Promise.resolve();

/**
 * Append one strike to the user's drust row. The third strike triggers a
 * 24-hour mood=critical penalty (寵物食物中毒). Optimistically updates the
 * store to the new count so the UI reacts immediately, then persists; on
 * failure the next refresh will reconcile.
 *
 * `now` is injectable for tests. Returns the new total.
 */
export function addStrike(
  userId: number,
  now: number = Date.now(),
): Promise<number> {
  const next = strikeChain.then(async () => {
    const cur = $pet.get();
    if (!cur) return 0;
    const strikes = Math.min(STRIKE_THRESHOLD, cur.strikes + 1);
    const poisonedUntil =
      strikes >= STRIKE_THRESHOLD
        ? now + POISON_DURATION_MS
        : cur.poisonedUntil;
    $pet.set({ ...cur, strikes, poisonedUntil });
    try {
      await petApi.setStrikes(userId, strikes, epochToIso(poisonedUntil));
    } catch (err) {
      console.warn('[pet] setStrikes failed:', err);
    }
    return strikes;
  });
  // Don't let one failure block subsequent calls from running.
  strikeChain = next.catch(() => undefined);
  return next;
}

/** Dev / admin pardon. Wipes both strike count and active poison window. */
export function clearStrikes(userId: number): Promise<void> {
  const next = strikeChain.then(async () => {
    const cur = $pet.get();
    if (!cur) return;
    $pet.set({ ...cur, strikes: 0, poisonedUntil: null });
    try {
      await petApi.clearStrikes(userId);
    } catch (err) {
      console.warn('[pet] clearStrikes failed:', err);
    }
  });
  strikeChain = next.catch(() => undefined);
  return next;
}

/**
 * The mood the UI should actually render. While poisonedUntil is in the
 * future, we override whatever drust has stored — even if the pet is
 * happy from XP, food poisoning takes priority.
 */
export function effectiveMood(state: PetStoreShape | null): PetMood {
  if (!state) return 'normal';
  if (state.poisonedUntil && state.poisonedUntil > Date.now()) {
    return 'critical';
  }
  return (state.mood as PetMood) ?? 'normal';
}

/** Milliseconds remaining on an active poison window (0 if not poisoned). */
export function poisonRemainingMs(state: PetStoreShape | null): number {
  if (!state?.poisonedUntil) return 0;
  return Math.max(0, state.poisonedUntil - Date.now());
}
