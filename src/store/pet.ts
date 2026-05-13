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
  walletXp: number;
  balance: number;
  fragments: number;
  makeupCards: number;
}

export const $pet = atom<PetStoreShape | null>(null);
export const $gems = atom<GemsStoreShape>({
  walletXp: 0,
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
    walletXp: xp.balance,
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
 */
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
