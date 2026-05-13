/**
 * Check-ins module: meal logging.
 *
 * createCheckIn() encodes complex fields (food_items, nutrition) as JSON
 * strings and converts booleans to 0/1 for SQLite. listCheckIns() routes
 * through one of two RPCs depending on whether a day_number filter was
 * supplied — both are bounded queries, replacing the old list+filter that
 * silently truncated to 20 rows across all users.
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

/**
 * Patch the food items + nutrition snapshot of an existing check-in. Used
 * by the /check-in/success "修改內容" sheet so the user can correct what
 * the AI mis-detected. Both fields land as JSON strings to mirror how
 * createCheckIn writes them; XP/gems are intentionally not touched here
 * (the reward already paid out at submit time).
 */
export async function updateCheckInItems(
  checkInId: number,
  foodItems: unknown,
  nutrition: unknown,
): Promise<void> {
  await drust.update('check_ins', checkInId, {
    food_items: JSON.stringify(foodItems),
    nutrition: JSON.stringify(nutrition),
  });
}

export async function listCheckIns(
  userId: number,
  dayNumber?: number,
): Promise<CheckInRow[]> {
  const rpcName =
    dayNumber === undefined ? 'check_ins_for_user' : 'check_ins_for_user_day';
  const params: Record<string, unknown> = { user_id: userId };
  if (dayNumber !== undefined) params.day_number = dayNumber;
  const result = await drust.rpc(rpcName, params);
  return drust.rpcRows<CheckInRow>(result);
}

/**
 * Dev-only: delete every check-in row for a user. drust has no bulk-delete
 * surface, so this fans out one DELETE per row. At prototype scale (≤90
 * rows per user across the demo) this is acceptable; a real go-live would
 * want a service-only RPC for batch delete.
 */
export async function deleteAllCheckIns(userId: number): Promise<number> {
  const rows = await listCheckIns(userId);
  await Promise.all(rows.map((r) => drust.delete('check_ins', r.id)));
  return rows.length;
}
