import { describe, it, expect } from 'vitest';
import { currentDayNumber } from '../time';

const DAY_MS = 86_400_000;

describe('currentDayNumber — real mode', () => {
  it('day 1 immediately after start', () => {
    const start = 1_000_000_000_000;
    expect(currentDayNumber({ mode: 'real', challengeStartedAt: start, now: start })).toBe(1);
  });

  it('day 2 after 1 day', () => {
    const start = 1_000_000_000_000;
    expect(currentDayNumber({ mode: 'real', challengeStartedAt: start, now: start + DAY_MS })).toBe(2);
  });

  it('clamped to 30 after long elapsed', () => {
    const start = 0;
    expect(currentDayNumber({ mode: 'real', challengeStartedAt: start, now: 365 * DAY_MS })).toBe(30);
  });
});

describe('currentDayNumber — compressed mode', () => {
  it('day 3 after 60 seconds (30s/day)', () => {
    const start = 1_000_000_000_000;
    expect(
      currentDayNumber({
        mode: 'compressed',
        challengeStartedAt: start,
        compressedStartedAt: start,
        now: start + 60_000,
      }),
    ).toBe(3);
  });

  it('day 1 immediately', () => {
    const start = 1_000_000_000_000;
    expect(
      currentDayNumber({ mode: 'compressed', challengeStartedAt: start, compressedStartedAt: start, now: start }),
    ).toBe(1);
  });

  it('falls back to challengeStartedAt when compressedStartedAt missing', () => {
    const start = 1_000_000_000_000;
    expect(
      currentDayNumber({ mode: 'compressed', challengeStartedAt: start, now: start + 30_000 }),
    ).toBe(2);
  });

  it('clamps to 30', () => {
    expect(
      currentDayNumber({ mode: 'compressed', challengeStartedAt: 0, compressedStartedAt: 0, now: 1_000_000_000 }),
    ).toBe(30);
  });
});

describe('currentDayNumber — manual mode', () => {
  it('returns manualDay clamped to 1..30', () => {
    expect(currentDayNumber({ mode: 'manual', challengeStartedAt: 0, manualDay: 5 })).toBe(5);
    expect(currentDayNumber({ mode: 'manual', challengeStartedAt: 0, manualDay: 0 })).toBe(1);
    expect(currentDayNumber({ mode: 'manual', challengeStartedAt: 0, manualDay: 99 })).toBe(30);
  });

  it('defaults to day 1 when manualDay is undefined', () => {
    expect(currentDayNumber({ mode: 'manual', challengeStartedAt: 0 })).toBe(1);
  });
});
