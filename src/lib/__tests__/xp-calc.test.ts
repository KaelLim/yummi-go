import { describe, it, expect } from 'vitest';
import { mealXp, gemFromOverflow, fragmentFromOverflow, dailyTotal } from '../xp-calc';

describe('mealXp', () => {
  it('meal 1 = 20', () => {
    expect(mealXp(1, 3)).toBe(20);
    expect(mealXp(1, 2)).toBe(20);
    expect(mealXp(1, 1)).toBe(20);
  });
  it('meal 2 = 20', () => {
    expect(mealXp(2, 3)).toBe(20);
    expect(mealXp(2, 2)).toBe(20);
  });
  it('meal 3 = 30 regardless of plan', () => {
    expect(mealXp(3, 3)).toBe(30);
    expect(mealXp(3, 2)).toBe(30);
    expect(mealXp(3, 1)).toBe(30);
  });
});

describe('gemFromOverflow', () => {
  it('returns 0 when daily xp under 100', () => {
    expect(gemFromOverflow(0)).toBe(0);
    expect(gemFromOverflow(50)).toBe(0);
    expect(gemFromOverflow(99)).toBe(0);
  });
  it('returns 1 when exactly 100', () => {
    expect(gemFromOverflow(100)).toBe(1);
  });
  it('returns 1 + (xp - 100) when over 100', () => {
    expect(gemFromOverflow(101)).toBe(2);
    expect(gemFromOverflow(120)).toBe(21);
  });
});

describe('fragmentFromOverflow', () => {
  it('returns 0 when xp <= 100', () => {
    expect(fragmentFromOverflow(0)).toBe(0);
    expect(fragmentFromOverflow(99)).toBe(0);
    expect(fragmentFromOverflow(100)).toBe(0);
  });
  it('returns floor((xp - 100) / 100)', () => {
    expect(fragmentFromOverflow(199)).toBe(0);
    expect(fragmentFromOverflow(200)).toBe(1);
    expect(fragmentFromOverflow(350)).toBe(2);
  });
});

describe('dailyTotal', () => {
  it('sums check-ins + missions*15 + reviews*15', () => {
    expect(dailyTotal(0, 0, 0)).toBe(0);
    expect(dailyTotal(70, 0, 0)).toBe(70);
    expect(dailyTotal(70, 1, 0)).toBe(85);
    expect(dailyTotal(70, 0, 1)).toBe(85);
    expect(dailyTotal(70, 2, 1)).toBe(70 + 30 + 15);
  });
});
