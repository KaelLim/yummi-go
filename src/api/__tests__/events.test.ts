import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../drust', () => ({
  drust: { insert: vi.fn() },
}));

import {
  recordXpEvent,
  recordGemEvent,
  recordMakeupCardEvent,
  recordOnboardingEvent,
} from '../events';
import { drust } from '../drust';

const mockedInsert = drust.insert as unknown as ReturnType<typeof vi.fn>;

describe('api/events', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedInsert.mockResolvedValue({ id: 1, record: {} });
  });

  it('recordXpEvent maps camelCase → snake_case and includes all fields', async () => {
    await recordXpEvent({
      userId: 7,
      deltaXp: 25,
      reason: 'check_in',
      refId: 42,
      levelBefore: 3,
      levelAfter: 4,
      accumulatedXpAfter: 200,
    });
    expect(mockedInsert).toHaveBeenCalledWith('xp_events', {
      user_id: 7,
      delta_xp: 25,
      reason: 'check_in',
      ref_id: 42,
      level_before: 3,
      level_after: 4,
      accumulated_xp_after: 200,
    });
  });

  it('recordGemEvent supports negative deltas (spends)', async () => {
    await recordGemEvent({
      userId: 7,
      delta: -100,
      reason: 'swap_card',
      balanceAfter: 250,
    });
    expect(mockedInsert).toHaveBeenCalledWith('gem_events', {
      user_id: 7,
      delta: -100,
      reason: 'swap_card',
      balance_after: 250,
      ref_id: null,
    });
  });

  it('recordMakeupCardEvent records both card and fragment deltas', async () => {
    await recordMakeupCardEvent({
      userId: 7,
      deltaCards: 1,
      deltaFragments: -3,
      reason: 'fragment_fold',
      cardsAfter: 2,
      fragmentsAfter: 1,
    });
    expect(mockedInsert).toHaveBeenCalledWith('makeup_card_events', {
      user_id: 7,
      delta_cards: 1,
      delta_fragments: -3,
      reason: 'fragment_fold',
      cards_after: 2,
      fragments_after: 1,
      ref_id: null,
    });
  });

  it('recordOnboardingEvent JSON-encodes the value', async () => {
    await recordOnboardingEvent({
      userId: 7,
      step: 'baseline',
      value: { meat: 0.4, fish: 0.2 },
    });
    expect(mockedInsert).toHaveBeenCalledWith('onboarding_events', {
      user_id: 7,
      step: 'baseline',
      value_json: '{"meat":0.4,"fish":0.2}',
    });
  });

  it('recordOnboardingEvent passes value_json=null when value is undefined', async () => {
    await recordOnboardingEvent({ userId: 7, step: 'complete' });
    expect(mockedInsert).toHaveBeenCalledWith('onboarding_events', {
      user_id: 7,
      step: 'complete',
      value_json: null,
    });
  });

  it('swallows insert failures so the main write path never breaks', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockedInsert.mockRejectedValueOnce(new Error('drust down'));
    await expect(
      recordXpEvent({
        userId: 7,
        deltaXp: 10,
        reason: 'quiz',
        levelBefore: 1,
        levelAfter: 1,
        accumulatedXpAfter: 10,
      }),
    ).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
