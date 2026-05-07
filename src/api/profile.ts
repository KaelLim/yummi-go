/**
 * Profile module: full-user JOIN, profile read/patch, oath signing.
 *
 * getUserFull() calls the get_user_full RPC and flattens the result.
 * getProfile/updateProfile read & patch user_profiles by user_id (not row id).
 * signOath() stamps the user row with the current ISO timestamp.
 */
import { drust } from './drust';

export interface UserProfile {
  user_id: number;
  diet_type: string | null;
  challenge_level: number | null;
  eat_times: string | null; // JSON-encoded
  known_from: string | null;
  baseline: string | null; // JSON-encoded
}

export interface UserFull {
  id: number;
  username: string;
  display_name: string;
  oath_signed_at: string | null;
  diet_type: string | null;
  challenge_level: number | null;
  eat_times: string | null;
  known_from: string | null;
  baseline: string | null;
  level: number;
  current_xp: number;
  accumulated_xp: number;
  stage: string;
  mood: string;
  gems: number;
  total_earned: number;
  card_count: number;
  fragment_count: number;
}

export async function getUserFull(userId: number): Promise<UserFull | null> {
  const result = await drust.rpc('get_user_full', { user_id: userId });
  const rows = drust.rpcRows<UserFull>(result);
  return rows[0] ?? null;
}

export async function getProfile(userId: number): Promise<UserProfile | null> {
  const result = await drust.list<UserProfile>('user_profiles', {
    user_id: `eq.${userId}`,
  });
  return result.records[0] ?? null;
}

export async function updateProfile(
  userId: number,
  patch: Partial<UserProfile>,
): Promise<void> {
  // Find profile row id first (we look up by user_id then PATCH by row id)
  const existing = await drust.list<{ id: number }>('user_profiles', {
    user_id: `eq.${userId}`,
  });
  const profileId = existing.records[0]?.id;
  if (!profileId) throw new Error('Profile not found for user ' + userId);
  await drust.update('user_profiles', profileId, patch);
}

export async function signOath(userId: number): Promise<void> {
  await drust.update('users', userId, {
    oath_signed_at: new Date().toISOString(),
  });
}
