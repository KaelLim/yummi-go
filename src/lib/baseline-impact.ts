/**
 * CO2 savings calculation per spec 附件三.
 * Compares user's typical meat-eating week against an equivalent plant-based week.
 */
export const CO2_KG_PER_KG: Record<string, number> = {
  beef: 99.48,
  pork: 12.31,
  lamb: 39.72,
  chicken: 9.87,
};

export interface Baseline {
  beef: number;
  pork: number;
  lamb: number;
  chicken: number; // ratios summing to <= 1
}

const PLANT_AVG_CO2 = 1.0; // approx kg CO2e per kg plant food

export function impactSavedKg(weeklyKg: number, baseline: Baseline): number {
  const meatCo2 =
    (baseline.beef * CO2_KG_PER_KG.beef +
      baseline.pork * CO2_KG_PER_KG.pork +
      baseline.lamb * CO2_KG_PER_KG.lamb +
      baseline.chicken * CO2_KG_PER_KG.chicken) *
    weeklyKg;
  const plantCo2 = weeklyKg * PLANT_AVG_CO2;
  return Math.max(0, meatCo2 - plantCo2);
}
