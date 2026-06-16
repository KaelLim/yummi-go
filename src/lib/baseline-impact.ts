/**
 * CO2 / water / land savings calculations per spec 附件三 + § Day-30 終曲.
 *
 * Compares the user's typical meat-eating week against the equivalent
 * plant-based week. Water and land use values are sourced from FAO + Water
 * Footprint Network averages (kg-of-meat → litres / m² of resource).
 */
export const CO2_KG_PER_KG: Record<string, number> = {
  beef: 99.48,
  pork: 12.31,
  lamb: 39.72,
  chicken: 9.87,
};

/** litres of water per kg of meat (Water Footprint Network global avg). */
export const WATER_L_PER_KG: Record<string, number> = {
  beef: 15400,
  pork: 6000,
  lamb: 10400,
  chicken: 4300,
};

/** m² of land per kg of meat (FAO + Our World in Data, global avg). */
export const LAND_M2_PER_KG: Record<string, number> = {
  beef: 326,
  pork: 17,
  lamb: 369,
  chicken: 12,
};

export interface Baseline {
  beef: number;
  pork: number;
  lamb: number;
  chicken: number;
  /** Explicit plant-based share. Optional for back-compat with older
   *  baselines that pre-date the 蔬食 slider — when absent, the
   *  remainder of (1 - meat sum) is treated as plant. Impact math
   *  doesn't read this directly (it's "meat replaced by plants"
   *  weighted by meat ratios), so older records still compute right. */
  plant?: number;
}

/**
 * UI now collapses the 4 meat sliders into one 「肉食」 bar. We still
 * store the per-kind breakdown so the impact calc keeps its
 * resolution (beef has ~8× the CO2 of chicken). The mix below is a
 * rough Taiwanese-average split: lots of pork + chicken, less beef
 * + lamb. Sums to 1.0.
 */
const MEAT_MIX = { beef: 0.15, pork: 0.50, lamb: 0.05, chicken: 0.30 };

/** Convert a single meat% (0-100) into the full 5-field Baseline. */
export function baselineFromMeatPct(meatPct: number): Baseline {
  const meat = Math.max(0, Math.min(100, meatPct)) / 100;
  return {
    beef:    meat * MEAT_MIX.beef,
    pork:    meat * MEAT_MIX.pork,
    lamb:    meat * MEAT_MIX.lamb,
    chicken: meat * MEAT_MIX.chicken,
    plant:   1 - meat,
  };
}

/** Sum the 4 meat ratios out of a stored Baseline back into 0-100. */
export function meatPctFromBaseline(b: Baseline): number {
  const meat = (b.beef ?? 0) + (b.pork ?? 0) + (b.lamb ?? 0) + (b.chicken ?? 0);
  return Math.round(meat * 100);
}

const PLANT_AVG_CO2 = 1.0; // kg CO2e per kg plant food
const PLANT_AVG_WATER = 1000; // litres water per kg plant food
const PLANT_AVG_LAND = 3; // m² land per kg plant food

function weightedFactor(
  baseline: Baseline,
  factors: Record<string, number>,
): number {
  return (
    baseline.beef * factors.beef +
    baseline.pork * factors.pork +
    baseline.lamb * factors.lamb +
    baseline.chicken * factors.chicken
  );
}

export function impactSavedKg(weeklyKg: number, baseline: Baseline): number {
  const meatCo2 = weightedFactor(baseline, CO2_KG_PER_KG) * weeklyKg;
  const plantCo2 = weeklyKg * PLANT_AVG_CO2;
  return Math.max(0, meatCo2 - plantCo2);
}

/** Litres of water saved by replacing weeklyKg of meat with plants. */
export function impactSavedLitresWater(
  weeklyKg: number,
  baseline: Baseline,
): number {
  const meatWater = weightedFactor(baseline, WATER_L_PER_KG) * weeklyKg;
  const plantWater = weeklyKg * PLANT_AVG_WATER;
  return Math.max(0, meatWater - plantWater);
}

/** m² of land use avoided by replacing weeklyKg of meat with plants. */
export function impactSavedM2Land(
  weeklyKg: number,
  baseline: Baseline,
): number {
  const meatLand = weightedFactor(baseline, LAND_M2_PER_KG) * weeklyKg;
  const plantLand = weeklyKg * PLANT_AVG_LAND;
  return Math.max(0, meatLand - plantLand);
}
