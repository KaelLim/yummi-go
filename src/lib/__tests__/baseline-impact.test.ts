import { describe, it, expect } from 'vitest';
import { impactSavedKg, CO2_KG_PER_KG } from '../baseline-impact';

describe('CO2_KG_PER_KG', () => {
  it('exposes the four meat factors per spec 附件三', () => {
    expect(CO2_KG_PER_KG.beef).toBeCloseTo(99.48, 2);
    expect(CO2_KG_PER_KG.pork).toBeCloseTo(12.31, 2);
    expect(CO2_KG_PER_KG.lamb).toBeCloseTo(39.72, 2);
    expect(CO2_KG_PER_KG.chicken).toBeCloseTo(9.87, 2);
  });
});

describe('impactSavedKg', () => {
  it('returns 0 for zero weeklyKg', () => {
    expect(impactSavedKg(0, { beef: 0.5, pork: 0, lamb: 0, chicken: 0.5 })).toBe(0);
  });

  it('returns ~37 kg saved for 30/30/0/40 baseline at 1 kg/wk', () => {
    const saved = impactSavedKg(1, { beef: 0.3, pork: 0.3, lamb: 0, chicken: 0.4 });
    // 0.3*99.48 + 0.3*12.31 + 0*39.72 + 0.4*9.87 = 37.485, minus 1.0 plant baseline = 36.485
    expect(saved).toBeCloseTo(36.485, 2);
  });

  it('never returns negative values', () => {
    const saved = impactSavedKg(0.001, { beef: 0, pork: 0, lamb: 0, chicken: 0 });
    expect(saved).toBe(0);
  });

  it('scales linearly with weeklyKg', () => {
    const baseline = { beef: 0.3, pork: 0.3, lamb: 0, chicken: 0.4 };
    const a = impactSavedKg(1, baseline);
    const b = impactSavedKg(2, baseline);
    expect(b).toBeCloseTo(a * 2, 2);
  });
});
