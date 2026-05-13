import { describe, it, expect, beforeEach } from 'vitest';
import {
  $checkin,
  resetCheckin,
  setCapture,
  setScan,
  setItems,
  setVeganType,
  setMeatReplaced,
  setMealIndex,
  setLastResult,
  inferMealIndex,
} from '../checkin';
import type { ScanResult } from '@/lib/mock-ai';

describe('checkin store', () => {
  beforeEach(() => {
    resetCheckin();
  });

  it('starts empty', () => {
    expect($checkin.get()).toEqual({
      imageDataUrl: null,
      scan: null,
      items: [],
      veganType: null,
      wasMeatReplaced: false,
      mealIndex: 1,
      lastResult: null,
    });
  });

  it('setCapture stores the data url', () => {
    setCapture('data:image/png;base64,xxx');
    expect($checkin.get().imageDataUrl).toBe('data:image/png;base64,xxx');
  });

  it('setScan copies items into editable working list', () => {
    const scan: ScanResult = {
      items: [
        { name: 'a', cal: 10, protein: 0, carb: 0, fat: 0, fiber: 0, isVeg: true, colors: [], weightG: 50 },
      ],
      hasMeat: false,
      scanFailed: false,
    };
    setScan(scan);
    const s = $checkin.get();
    expect(s.scan).toBe(scan);
    expect(s.items).toEqual(scan.items);
    expect(s.items).not.toBe(scan.items); // copied, not aliased
  });

  it('setItems / setVeganType / setMeatReplaced / setMealIndex / setLastResult mutate slices', () => {
    setItems([
      { name: 'b', cal: 20, protein: 0, carb: 0, fat: 0, fiber: 0, isVeg: true, colors: [], weightG: 30 },
    ]);
    setVeganType('蛋奶素');
    setMeatReplaced(true);
    setMealIndex(3);
    setLastResult({ xpEarned: 30, luckyColorMatched: true, fogReductionPct: 1, xpFedToPet: 30, gemsFromXp: 0, nutrition: null });
    const s = $checkin.get();
    expect(s.items).toHaveLength(1);
    expect(s.veganType).toBe('蛋奶素');
    expect(s.wasMeatReplaced).toBe(true);
    expect(s.mealIndex).toBe(3);
    expect(s.lastResult).toEqual({ xpEarned: 30, luckyColorMatched: true, fogReductionPct: 1, xpFedToPet: 30, gemsFromXp: 0, nutrition: null });
  });

  it('resetCheckin reverts to defaults', () => {
    setCapture('x');
    setMealIndex(2);
    resetCheckin();
    expect($checkin.get().imageDataUrl).toBeNull();
    expect($checkin.get().mealIndex).toBe(1);
  });
});

describe('inferMealIndex', () => {
  it('< 11:00 → 1 (breakfast)', () => {
    expect(inferMealIndex(new Date('2026-05-08T06:30:00'))).toBe(1);
    expect(inferMealIndex(new Date('2026-05-08T10:59:00'))).toBe(1);
  });
  it('11:00–16:59 → 2 (lunch)', () => {
    expect(inferMealIndex(new Date('2026-05-08T11:00:00'))).toBe(2);
    expect(inferMealIndex(new Date('2026-05-08T16:30:00'))).toBe(2);
  });
  it('≥ 17:00 → 3 (dinner)', () => {
    expect(inferMealIndex(new Date('2026-05-08T17:00:00'))).toBe(3);
    expect(inferMealIndex(new Date('2026-05-08T21:30:00'))).toBe(3);
  });
});
