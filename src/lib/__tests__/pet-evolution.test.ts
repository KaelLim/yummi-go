import { describe, it, expect } from 'vitest';
import { stageFromLevel, levelFromAccumulatedXp, XP_PER_LEVEL, STAGE_THRESHOLDS } from '../pet-evolution';

describe('stageFromLevel', () => {
  it('classifies stage boundaries correctly', () => {
    expect(stageFromLevel(1)).toBe('egg');
    expect(stageFromLevel(5)).toBe('egg');
    expect(stageFromLevel(6)).toBe('baby');
    expect(stageFromLevel(18)).toBe('baby');
    expect(stageFromLevel(19)).toBe('youth');
    expect(stageFromLevel(23)).toBe('youth');
    expect(stageFromLevel(39)).toBe('youth');
    expect(stageFromLevel(40)).toBe('adult');
    expect(stageFromLevel(79)).toBe('adult');
    expect(stageFromLevel(80)).toBe('max');
    expect(stageFromLevel(100)).toBe('max');
  });

  it('falls back to max when out of range', () => {
    expect(stageFromLevel(150)).toBe('max');
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
  it('clamps at LV30 when XP exceeds total', () => {
    let total = 0;
    for (let lv = 1; lv <= 30; lv++) total += XP_PER_LEVEL[lv];
    expect(levelFromAccumulatedXp(total + 999)).toEqual({ level: 30, currentXp: 0 });
  });
});

describe('XP_PER_LEVEL', () => {
  it('matches 積分制度 CSV breakpoints', () => {
    expect(XP_PER_LEVEL[1]).toBe(30);
    expect(XP_PER_LEVEL[5]).toBe(30);
    expect(XP_PER_LEVEL[6]).toBe(50);
    expect(XP_PER_LEVEL[10]).toBe(50);
    expect(XP_PER_LEVEL[11]).toBe(60);
    expect(XP_PER_LEVEL[12]).toBe(60);
    expect(XP_PER_LEVEL[13]).toBe(80);
    expect(XP_PER_LEVEL[19]).toBe(80);
    expect(XP_PER_LEVEL[20]).toBe(100);
    expect(XP_PER_LEVEL[26]).toBe(100);
    expect(XP_PER_LEVEL[27]).toBe(150);
    expect(XP_PER_LEVEL[30]).toBe(150);
  });
});

describe('STAGE_THRESHOLDS', () => {
  it('exposes 5 stages', () => {
    expect(STAGE_THRESHOLDS.length).toBe(5);
    expect(STAGE_THRESHOLDS.map((s) => s.stage)).toEqual(['egg', 'baby', 'youth', 'adult', 'max']);
  });
});
