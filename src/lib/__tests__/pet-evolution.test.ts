import { describe, it, expect } from 'vitest';
import {
  stageFromLevel,
  levelFromAccumulatedXp,
  XP_PER_LEVEL,
  STAGE_THRESHOLDS,
  isFinalStage,
} from '../pet-evolution';

// UX_UPDATE_SPEC v0.3 model: 30-day, 5-stage pet, flat 30 XP/level.
// Stage rename: old 'adult' band → 'teen' (LV20-26); old 'max' band → 'adult' (LV27-30, final).
describe('stageFromLevel', () => {
  it('classifies stage boundaries correctly', () => {
    expect(stageFromLevel(1)).toBe('egg');
    expect(stageFromLevel(5)).toBe('egg');
    expect(stageFromLevel(6)).toBe('baby');
    expect(stageFromLevel(12)).toBe('baby');
    expect(stageFromLevel(13)).toBe('youth');
    expect(stageFromLevel(19)).toBe('youth');
    expect(stageFromLevel(20)).toBe('teen');
    expect(stageFromLevel(26)).toBe('teen');
    expect(stageFromLevel(27)).toBe('adult');
    expect(stageFromLevel(30)).toBe('adult');
  });

  it('falls back to final (adult) when out of range', () => {
    expect(stageFromLevel(150)).toBe('adult');
  });
});

describe('isFinalStage', () => {
  it('returns true for LV27-30', () => {
    expect(isFinalStage(26)).toBe(false);
    expect(isFinalStage(27)).toBe(true);
    expect(isFinalStage(30)).toBe(true);
  });
});

describe('levelFromAccumulatedXp', () => {
  it('LV1 + 0 XP', () => {
    expect(levelFromAccumulatedXp(0)).toEqual({ level: 1, currentXp: 0 });
  });
  it('29 XP → still LV1, currentXp 29', () => {
    expect(levelFromAccumulatedXp(29)).toEqual({ level: 1, currentXp: 29 });
  });
  it('30 XP → LV2, currentXp 0', () => {
    expect(levelFromAccumulatedXp(30)).toEqual({ level: 2, currentXp: 0 });
  });
  it('150 XP (5*30) → LV6, currentXp 0', () => {
    expect(levelFromAccumulatedXp(150)).toEqual({ level: 6, currentXp: 0 });
  });
  it('clamps at LV30 when XP exceeds total (with full XP showing)', () => {
    let total = 0;
    for (let lv = 1; lv <= 30; lv++) total += XP_PER_LEVEL[lv];
    // Past total → final-level cap returns currentXp = XP_PER_LEVEL[30]
    // so the progress bar shows 100% (instead of looping back to 0).
    expect(levelFromAccumulatedXp(total + 999)).toEqual({ level: 30, currentXp: 30 });
  });
});

describe('XP_PER_LEVEL', () => {
  it('is a flat 30 XP/level across LV1-30', () => {
    for (let lv = 1; lv <= 30; lv++) {
      expect(XP_PER_LEVEL[lv]).toBe(30);
    }
  });
});

describe('STAGE_THRESHOLDS', () => {
  it('exposes 5 stages in 30-day order', () => {
    expect(STAGE_THRESHOLDS.length).toBe(5);
    expect(STAGE_THRESHOLDS.map((s) => s.stage)).toEqual(['egg', 'baby', 'youth', 'teen', 'adult']);
  });
});
