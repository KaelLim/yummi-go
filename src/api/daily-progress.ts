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
 * upsert, so this is a read → branch → write triplet. The UNIQUE index
 * `idx_daily_progress_user_id_day_number` is the safety net: if two
 * writers both see no existing row and both call insert, the second
 * insert raises a UNIQUE constraint failure and we recover by reading
 * the now-present row and falling through to the update branch. Before
 * the index, a real race in production left two rows for (9, day 17).
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
    try {
      const result = await drust.insert<DailyProgressRow>(
        'daily_progress',
        seed,
      );
      return result.record;
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      // Another writer beat us; re-read and fall through to update.
      const winner = await getDailyProgress(userId, dayNumber);
      if (!winner) throw err;
      return updateDailyProgress(winner, missionsJson, patch);
    }
  }

  return updateDailyProgress(existing, missionsJson, patch);
}

async function updateDailyProgress(
  existing: DailyProgressRow,
  missionsJson: string | undefined,
  patch: DailyProgressPatch,
): Promise<DailyProgressRow> {
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

function isUniqueViolation(err: unknown): boolean {
  const msg =
    err && typeof err === 'object' && 'message' in err
      ? String((err as { message: unknown }).message)
      : '';
  return /UNIQUE constraint failed/i.test(msg);
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
