/**
 * Daily progress module — per-user-per-day mission state.
 *
 * Backed by the `daily_progress` collection (already exists in drust,
 * unused until this redesign). One row per (user_id, day_number) holding
 * the JSON-encoded list of completed mission keys, accumulated XP for the
 * day, and lucky-color memo for sharing-flow display.
 *
 * Reads use the `daily_progress_for_day` RPC. Writes use insert_record
 * for first-of-day + update_record for subsequent missions; drust RPCs
 * are SELECT-only so true UPSERT is implemented client-side.
 */
import { drust } from './drust';

export interface DailyProgressRow {
  id: number;
  user_id: number;
  day_number: number;
  missions_done: string; // JSON-encoded string[]
  total_xp: number;
  lucky_color: string | null;
  completed_at: string | null;
}

export interface DailyProgressPatch {
  missions_done?: string[];
  total_xp?: number;
  lucky_color?: string | null;
  completed_at?: string | null;
}

export async function getDailyProgress(
  userId: number,
  dayNumber: number,
): Promise<DailyProgressRow | null> {
  const result = await drust.rpc('daily_progress_for_day', {
    user_id: userId,
    day_number: dayNumber,
  });
  const rows = drust.rpcRows<DailyProgressRow>(result);
  return rows[0] ?? null;
}

/**
 * Insert-or-update for (user_id, day_number). drust offers no atomic
 * upsert, so this is a read → branch → write triplet. There's a
 * write-write race between two devices completing the same mission at
 * the same instant; since both writers send the merged JSON of all
 * completed missions, the loser's update gets stomped but no data is
 * actually lost (worst case: that user has to refresh to re-see it).
 */
export async function upsertDailyProgress(
  userId: number,
  dayNumber: number,
  patch: DailyProgressPatch,
): Promise<DailyProgressRow> {
  const existing = await getDailyProgress(userId, dayNumber);
  const missionsJson =
    patch.missions_done !== undefined
      ? JSON.stringify(patch.missions_done)
      : undefined;

  if (!existing) {
    const seed = {
      user_id: userId,
      day_number: dayNumber,
      missions_done: missionsJson ?? '[]',
      total_xp: patch.total_xp ?? 0,
      lucky_color: patch.lucky_color ?? null,
      completed_at: patch.completed_at ?? null,
    };
    const result = await drust.insert<DailyProgressRow>(
      'daily_progress',
      seed,
    );
    return result.record;
  }

  const writePatch: Record<string, unknown> = {};
  if (missionsJson !== undefined) writePatch.missions_done = missionsJson;
  if (patch.total_xp !== undefined) writePatch.total_xp = patch.total_xp;
  if (patch.lucky_color !== undefined) writePatch.lucky_color = patch.lucky_color;
  if (patch.completed_at !== undefined) writePatch.completed_at = patch.completed_at;

  if (Object.keys(writePatch).length === 0) return existing;

  const result = await drust.update<DailyProgressRow>(
    'daily_progress',
    existing.id,
    writePatch,
  );
  return result.record;
}

/** Decode missions_done JSON column into a string[]. Tolerates malformed JSON. */
export function decodeMissions(row: DailyProgressRow | null): string[] {
  if (!row?.missions_done) return [];
  try {
    const parsed = JSON.parse(row.missions_done);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}
