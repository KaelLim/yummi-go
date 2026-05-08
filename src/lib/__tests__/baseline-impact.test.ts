import { describe, it, expect } from 'vitest';
import {
  impactSavedKg,
  impactSavedLitresWater,
  impactSavedM2Land,
  CO2_KG_PER_KG,
  WATER_L_PER_KG,
  LAND_M2_PER_KG,
} from '../baseline-impact';

describe('CO2_KG_PER_KG', () => {
  it('exposes the four meat factors per spec 附件三', () => {
    expect(CO2_KG_PER_KG.beef).toBeCloseTo(99.48, 2);
    expect(CO2_KG_PER_KG.pork).toBeCloseTo(12.31, 2);
    expect(CO2_KG_PER_KG.lamb).toBeCloseTo(39.72, 2);
    expect(CO2_KG_PER_KG.chicken).toBeCloseTo(9.87, 2);
  });
});

describe('WATER_L_PER_KG', () => {
  it('exposes water-footprint factors (litres per kg meat)', () => {
    expect(WATER_L_PER_KG.beef).toBe(15400);
    expect(WATER_L_PER_KG.pork).toBe(6000);
    expect(WATER_L_PER_KG.lamb).toBe(10400);
    expect(WATER_L_PER_KG.chicken).toBe(4300);
  });
});

describe('LAND_M2_PER_KG', () => {
  it('exposes land-use factors (m² per kg meat)', () => {
    expect(LAND_M2_PER_KG.beef).toBe(326);
    expect(LAND_M2_PER_KG.pork).toBe(17);
    expect(LAND_M2_PER_KG.lamb).toBe(369);
    expect(LAND_M2_PER_KG.chicken).toBe(12);
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

describe('impactSavedLitresWater', () => {
  it('returns 0 for zero weeklyKg', () => {
    const baseline = { beef: 0.5, pork: 0.5, lamb: 0, chicken: 0 };
    expect(impactSavedLitresWater(0, baseline)).toBe(0);
  });

  it('saves ~9.7k L for a half-beef-half-pork week at 1 kg', () => {
    // 0.5*15400 + 0.5*6000 = 10700 — minus 1000 plant baseline = 9700
    const saved = impactSavedLitresWater(1, {
      beef: 0.5,
      pork: 0.5,
      lamb: 0,
      chicken: 0,
    });
    expect(saved).toBeCloseTo(9700, 0);
  });

  it('saves ~57k L for a 4 kg/wk pure-beef baseline', () => {
    // (1.0*15400 - 1000) * 4 = 57600
    const saved = impactSavedLitresWater(4, {
      beef: 1,
      pork: 0,
      lamb: 0,
      chicken: 0,
    });
    expect(saved).toBeCloseTo(57600, 0);
  });

  it('never returns negative values', () => {
    expect(
      impactSavedLitresWater(1, { beef: 0, pork: 0, lamb: 0, chicken: 0 }),
    ).toBe(0);
  });
});

describe('impactSavedM2Land', () => {
  it('saves ~323 m² for 1 kg of pure-beef substitute', () => {
    // 326 - 3 = 323
    const saved = impactSavedM2Land(1, {
      beef: 1,
      pork: 0,
      lamb: 0,
      chicken: 0,
    });
    expect(saved).toBeCloseTo(323, 0);
  });

  it('chicken baseline yields modest land savings (~9 m²/kg)', () => {
    // 12 - 3 = 9
    const saved = impactSavedM2Land(1, {
      beef: 0,
      pork: 0,
      lamb: 0,
      chicken: 1,
    });
    expect(saved).toBeCloseTo(9, 0);
  });

  it('never returns negative values', () => {
    expect(
      impactSavedM2Land(1, { beef: 0, pork: 0, lamb: 0, chicken: 0 }),
    ).toBe(0);
  });
});
