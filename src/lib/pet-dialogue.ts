/**
 * Pet dialogue pool keyed by time-of-day.
 *
 * Per UX_UPDATE_SPEC_v0.1 §1, the home pet bubble shifts copy across four
 * buckets (early-morning / midday / evening / late-night). PR-1 ships the
 * time-of-day axis only; pet-state-driven dialogue (hungry / bored / weak /
 * etc.) is layered on later when PetView's 7-state model lands.
 *
 * Phrases are prototype-grade placeholders — the final pool will come from
 * docs/spec/文案資料庫.md once content lands.
 */

export type TimeOfDay = 'early' | 'midday' | 'evening' | 'lateNight';

/** Pick a time-of-day bucket from an hour (0-23). */
export function timeOfDayFromHour(hour: number): TimeOfDay {
  if (hour >= 5 && hour < 11) return 'early';
  if (hour >= 11 && hour < 17) return 'midday';
  if (hour >= 17 && hour < 22) return 'evening';
  return 'lateNight';
}

const DIALOGUE: Record<TimeOfDay, string[]> = {
  early: [
    '主人，早安！',
    '今天從元氣早餐開始吧～',
    '一早起來精神超好！',
    '陽光出來了，要打卡嗎？',
  ],
  midday: [
    '肚子在叫了，下一餐吃什麼？',
    '中午來點清爽的吧～',
    '主人記得吃飯哦！',
    '想吃豆腐料理～',
  ],
  evening: [
    '晚餐時間到了！',
    '今天辛苦了，吃點美味的吧',
    '一起完成今天的最後一餐！',
    '夜色好美，主人在嗎？',
  ],
  lateNight: [
    '主人還沒睡嗎？',
    '夜深了，明天見～',
    '記得早點休息！',
    '夜貓子主人，安安。',
  ],
};

/**
 * Pick a random phrase for the given bucket. Optional `avoid` keeps a
 * second call (e.g. tap-to-reroll) from landing on the same string back-
 * to-back when the pool has more than one entry.
 */
export function pickDialogue(
  bucket: TimeOfDay,
  avoid: string | null = null,
): string {
  const pool = DIALOGUE[bucket];
  const candidates = avoid ? pool.filter((p) => p !== avoid) : pool;
  const source = candidates.length > 0 ? candidates : pool;
  return source[Math.floor(Math.random() * source.length)];
}

/** Convenience: pick using the current clock. */
export function pickDialogueNow(avoid: string | null = null): string {
  return pickDialogue(timeOfDayFromHour(new Date().getHours()), avoid);
}
