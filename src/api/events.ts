/**
 * Append-only event log writers.
 *
 * These are fire-and-forget: every recorder swallows failures so a logging
 * outage never breaks the primary write path (XP grant, gem swap, etc.).
 * The drust collections (xp_events / gem_events / makeup_card_events /
 * onboarding_events) are insert-only from the client — no update/delete is
 * exposed, so the row is the historical record.
 */
import { drust } from './drust';

export type XpReason =
  | 'check_in'
  | 'quiz'
  | 'mission'
  | 'bonus'
  | 'feed_pet'
  | 'devpanel'
  | 'reset';

export type GemReason =
  | 'xp_overflow'
  | 'swap_card'
  | 'spend_makeup'
  | 'xp_milestone'
  | 'devpanel_add'
  | 'devpanel_reset'
  | 'mission';

export type MakeupCardReason =
  | 'gem_swap'
  | 'fragment_fold'
  | 'spend'
  | 'devpanel'
  | 'reset';

export type OnboardingStep =
  | 'diet'
  | 'baseline'
  | 'purpose'
  | 'challenge_level'
  | 'eat_times'
  | 'known_from'
  | 'pet_name'
  | 'complete';

export interface XpEventInput {
  userId: number;
  deltaXp: number;
  reason: XpReason;
  refId?: number | null;
  levelBefore: number;
  levelAfter: number;
  accumulatedXpAfter: number;
}

export interface GemEventInput {
  userId: number;
  delta: number;
  reason: GemReason;
  balanceAfter: number;
  refId?: number | null;
}

export interface MakeupCardEventInput {
  userId: number;
  deltaCards: number;
  deltaFragments: number;
  reason: MakeupCardReason;
  cardsAfter: number;
  fragmentsAfter: number;
  refId?: number | null;
}

export interface OnboardingEventInput {
  userId: number;
  step: OnboardingStep;
  value?: unknown;
}

async function safeInsert(collection: string, data: Record<string, unknown>): Promise<void> {
  try {
    await drust.insert(collection, data);
  } catch (err) {
    console.warn(`[events] insert ${collection} failed`, err);
  }
}

export function recordXpEvent(e: XpEventInput): Promise<void> {
  return safeInsert('xp_events', {
    user_id: e.userId,
    delta_xp: e.deltaXp,
    reason: e.reason,
    ref_id: e.refId ?? null,
    level_before: e.levelBefore,
    level_after: e.levelAfter,
    accumulated_xp_after: e.accumulatedXpAfter,
  });
}

export function recordGemEvent(e: GemEventInput): Promise<void> {
  return safeInsert('gem_events', {
    user_id: e.userId,
    delta: e.delta,
    reason: e.reason,
    balance_after: e.balanceAfter,
    ref_id: e.refId ?? null,
  });
}

export function recordMakeupCardEvent(e: MakeupCardEventInput): Promise<void> {
  return safeInsert('makeup_card_events', {
    user_id: e.userId,
    delta_cards: e.deltaCards,
    delta_fragments: e.deltaFragments,
    reason: e.reason,
    cards_after: e.cardsAfter,
    fragments_after: e.fragmentsAfter,
    ref_id: e.refId ?? null,
  });
}

export function recordOnboardingEvent(e: OnboardingEventInput): Promise<void> {
  return safeInsert('onboarding_events', {
    user_id: e.userId,
    step: e.step,
    value_json: e.value === undefined ? null : JSON.stringify(e.value),
  });
}
