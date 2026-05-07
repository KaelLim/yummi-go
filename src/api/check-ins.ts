/**
 * Check-ins module: meal logging.
 *
 * createCheckIn() encodes complex fields (food_items, nutrition) as JSON
 * strings and converts booleans to 0/1 for SQLite. listCheckIns() supports
 * an optional day_number filter for daily aggregations.
 */
import { drust } from './drust';

export interface CheckInRow {
  id: number;
  user_id: number;
  day_number: number;
  meal_index: number;
  timestamp: string;
  food_items: string; // JSON-encoded
  nutrition: string; // JSON-encoded
  vegan_type: string | null;
  was_meat_replaced: number; // 0/1
  lucky_color_matched: number;
  xp_earned: number;
  gems_earned: number;
}

export interface CreateCheckInArgs {
  userId: number;
  dayNumber: number;
  mealIndex: 1 | 2 | 3;
  foodItems: unknown;
  nutrition: unknown;
  veganType: string | null;
  wasMeatReplaced: boolean;
  luckyColorMatched: boolean;
  xpEarned: number;
  gemsEarned: number;
}

export async function createCheckIn(
  args: CreateCheckInArgs,
): Promise<CheckInRow> {
  const result = await drust.insert<CheckInRow>('check_ins', {
    user_id: args.userId,
    day_number: args.dayNumber,
    meal_index: args.mealIndex,
    food_items: JSON.stringify(args.foodItems),
    nutrition: JSON.stringify(args.nutrition),
    vegan_type: args.veganType,
    was_meat_replaced: args.wasMeatReplaced ? 1 : 0,
    lucky_color_matched: args.luckyColorMatched ? 1 : 0,
    xp_earned: args.xpEarned,
    gems_earned: args.gemsEarned,
  });
  return result.record;
}

export async function listCheckIns(
  userId: number,
  dayNumber?: number,
): Promise<CheckInRow[]> {
  const filter: Record<string, string> = { user_id: `eq.${userId}` };
  if (dayNumber !== undefined) filter.day_number = `eq.${dayNumber}`;
  const result = await drust.list<CheckInRow>('check_ins', filter);
  return result.records;
}
