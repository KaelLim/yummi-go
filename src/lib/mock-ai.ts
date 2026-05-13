/**
 * Mock AI food scanner — deterministic when caller supplies an rng.
 * 30-item食物庫 covers vegan + meat options for check-in scoring.
 */
export interface MockFood {
  name: string;
  cal: number;
  protein: number;
  carb: number;
  fat: number;
  fiber: number;
  isVeg: boolean;
  colors: string[];
  weightG: number;
}

export const FOOD_BANK: MockFood[] = [
  { name: '生菜', cal: 16, protein: 1, carb: 3, fat: 0, fiber: 1, isVeg: true, colors: ['green'], weightG: 32 },
  { name: '番茄', cal: 22, protein: 1, carb: 5, fat: 0, fiber: 2, isVeg: true, colors: ['red'], weightG: 120 },
  { name: '小黃瓜', cal: 16, protein: 1, carb: 4, fat: 0, fiber: 1, isVeg: true, colors: ['green'], weightG: 21 },
  { name: '優格', cal: 60, protein: 6, carb: 9, fat: 1, fiber: 0, isVeg: true, colors: ['white'], weightG: 73 },
  { name: '彩色櫻桃蘿蔔', cal: 18, protein: 1, carb: 4, fat: 0, fiber: 2, isVeg: true, colors: ['red', 'purple', 'white'], weightG: 73 },
  { name: '酪梨', cal: 160, protein: 2, carb: 9, fat: 15, fiber: 7, isVeg: true, colors: ['green'], weightG: 100 },
  { name: '紫米飯', cal: 200, protein: 4, carb: 43, fat: 1, fiber: 3, isVeg: true, colors: ['purple', 'black'], weightG: 100 },
  { name: '南瓜', cal: 26, protein: 1, carb: 7, fat: 0, fiber: 1, isVeg: true, colors: ['yellow', 'orange'], weightG: 80 },
  { name: '茄子', cal: 25, protein: 1, carb: 6, fat: 0, fiber: 3, isVeg: true, colors: ['purple', 'white'], weightG: 70 },
  { name: '黑木耳', cal: 25, protein: 1, carb: 7, fat: 0, fiber: 7, isVeg: true, colors: ['black'], weightG: 50 },
  { name: '玉米', cal: 86, protein: 3, carb: 19, fat: 1, fiber: 2, isVeg: true, colors: ['yellow'], weightG: 100 },
  { name: '蘋果', cal: 52, protein: 0, carb: 14, fat: 0, fiber: 2, isVeg: true, colors: ['red', 'green'], weightG: 150 },
  { name: '香蕉', cal: 89, protein: 1, carb: 23, fat: 0, fiber: 3, isVeg: true, colors: ['yellow'], weightG: 100 },
  { name: '藍莓', cal: 57, protein: 1, carb: 14, fat: 0, fiber: 2, isVeg: true, colors: ['purple', 'blue'], weightG: 50 },
  { name: '高麗菜', cal: 25, protein: 1, carb: 6, fat: 0, fiber: 2, isVeg: true, colors: ['green', 'white'], weightG: 100 },
  { name: '紅蘿蔔', cal: 41, protein: 1, carb: 10, fat: 0, fiber: 3, isVeg: true, colors: ['orange'], weightG: 80 },
  { name: '豆腐', cal: 76, protein: 8, carb: 2, fat: 5, fiber: 0, isVeg: true, colors: ['white'], weightG: 100 },
  { name: '糙米飯', cal: 110, protein: 3, carb: 23, fat: 1, fiber: 2, isVeg: true, colors: ['white'], weightG: 100 },
  { name: '燕麥', cal: 389, protein: 17, carb: 66, fat: 7, fiber: 11, isVeg: true, colors: ['white'], weightG: 50 },
  { name: '鷹嘴豆', cal: 164, protein: 9, carb: 27, fat: 3, fiber: 8, isVeg: true, colors: ['yellow'], weightG: 100 },
  { name: '黑豆', cal: 132, protein: 9, carb: 24, fat: 1, fiber: 9, isVeg: true, colors: ['black'], weightG: 100 },
  { name: '橘子', cal: 47, protein: 1, carb: 12, fat: 0, fiber: 2, isVeg: true, colors: ['orange'], weightG: 130 },
  { name: '葡萄', cal: 69, protein: 1, carb: 18, fat: 0, fiber: 1, isVeg: true, colors: ['purple', 'green'], weightG: 100 },
  { name: '芝麻', cal: 573, protein: 18, carb: 23, fat: 50, fiber: 12, isVeg: true, colors: ['black', 'white'], weightG: 20 },
  { name: '海帶', cal: 43, protein: 2, carb: 10, fat: 1, fiber: 1, isVeg: true, colors: ['green', 'black'], weightG: 50 },
  { name: '雞胸肉', cal: 165, protein: 31, carb: 0, fat: 4, fiber: 0, isVeg: false, colors: ['white'], weightG: 100 },
  { name: '牛肉片', cal: 250, protein: 26, carb: 0, fat: 17, fiber: 0, isVeg: false, colors: ['red'], weightG: 80 },
  { name: '豬肉絲', cal: 200, protein: 22, carb: 0, fat: 12, fiber: 0, isVeg: false, colors: ['red', 'white'], weightG: 60 },
  { name: '鮭魚', cal: 208, protein: 22, carb: 0, fat: 13, fiber: 0, isVeg: false, colors: ['orange'], weightG: 100 },
  { name: '蝦仁', cal: 99, protein: 24, carb: 0, fat: 1, fiber: 0, isVeg: false, colors: ['orange'], weightG: 80 },
];

export interface ScanResult {
  items: MockFood[];
  hasMeat: boolean;
  scanFailed: boolean;
}

export interface MockScanOpts {
  failRate?: number;
  meatRate?: number;
  rng?: () => number;
  /** Prototype hook: force the outcome instead of rolling against meatRate. */
  forceMeat?: boolean;
}

export function mockScan(opts?: MockScanOpts): ScanResult {
  const rng = opts?.rng ?? Math.random;
  const failRate = opts?.failRate ?? 0.05;
  if (rng() < failRate) return { items: [], hasMeat: false, scanFailed: true };
  const count = 3 + Math.floor(rng() * 4); // 3..6 inclusive
  const meatRate = opts?.meatRate ?? 0.3;
  const veggies = FOOD_BANK.filter((f) => f.isVeg);
  const meats = FOOD_BANK.filter((f) => !f.isVeg);
  const includeMeat = opts?.forceMeat ?? rng() < meatRate;
  let items: MockFood[];
  if (includeMeat) {
    // Guarantee at least one meat item when forced — otherwise a tiny RNG
    // run could pick only veggies from the mixed pool and silently fall
    // back to the no-meat flow.
    const shuffledVeg = [...veggies].sort(() => rng() - 0.5).slice(0, Math.max(1, count - 1));
    const shuffledMeat = [...meats].sort(() => rng() - 0.5).slice(0, 1);
    items = [...shuffledVeg, ...shuffledMeat];
  } else {
    items = [...veggies].sort(() => rng() - 0.5).slice(0, count);
  }
  return { items, hasMeat: items.some((i) => !i.isVeg), scanFailed: false };
}
