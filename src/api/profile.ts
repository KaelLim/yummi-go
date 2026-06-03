/**
 * Profile module: full-user JOIN, profile read/patch, oath signing,
 * challenge-started timestamp.
 *
 * getUserFull() calls the get_user_full RPC and flattens the result.
 * getProfile() uses the profile_for_user RPC (replaces list+filter).
 * setChallengeStartedAt() stamps users.challenge_started_at — drust is
 * the source of truth for the start timestamp now (was localStorage).
 */
import { drust } from './drust';

export interface UserProfile {
  user_id: number;
  diet_type: string | null;
  challenge_level: number | null;
  eat_times: string | null; // JSON-encoded
  known_from: string | null;
  baseline: string | null; // JSON-encoded
  purpose: string | null;
}

export interface UserFull {
  id: number;
  username: string;
  display_name: string;
  is_guest: number;
  oath_signed_at: string | null;
  challenge_started_at: string | null;
  diet_type: string | null;
  challenge_level: number | null;
  eat_times: string | null;
  known_from: string | null;
  baseline: string | null;
  purpose: string | null;
  level: number;
  current_xp: number;
  accumulated_xp: number;
  stage: string;
  mood: string;
  strikes: number;
  poisoned_until: string | null;
  gems: number;
  total_earned: number;
  card_count: number;
  fragment_count: number;
}

export async function getUserFull(userId: number): Promise<UserFull | null> {
  const result = await drust.rpc('get_user_full', { uid: userId });
  const rows = drust.rpcRows<UserFull>(result);
  return rows[0] ?? null;
}

export async function getProfile(
  userId: number,
): Promise<(UserProfile & { id: number }) | null> {
  const result = await drust.rpc('profile_for_user', { uid: userId });
  const rows = drust.rpcRows<UserProfile & { id: number }>(result);
  return rows[0] ?? null;
}

export async function updateProfile(
  userId: number,
  patch: Partial<UserProfile>,
): Promise<void> {
  const profile = await getProfile(userId);
  if (!profile) throw new Error('Profile not found for user ' + userId);
  await drust.update('user_profiles', profile.id, patch);
}

export async function signOath(userId: number): Promise<void> {
  await drust.update('users', userId, {
    oath_signed_at: new Date().toISOString(),
  });
}

/**
 * Rename the user. Used by the first-map-visit prompt to let guests
 * upgrade from the auto-generated "訪客 xxxx" placeholder to a real
 * display name without going through /register.
 */
export async function updateDisplayName(
  userId: number,
  displayName: string,
): Promise<void> {
  await drust.update('users', userId, { display_name: displayName });
}

/**
 * Set users.challenge_started_at — fired by the day-1 hook CTA. ISO 8601.
 * Single source of truth: drust. localStorage no longer mirrors this.
 */
export async function setChallengeStartedAt(
  userId: number,
  isoTs: string,
): Promise<void> {
  await drust.update('users', userId, { challenge_started_at: isoTs });
}

export async function mealFailCount(userId: number): Promise<number> {
  try {
    const result = await drust.rpc('meal_fail_count', { uid: userId });
    const rows = drust.rpcRows<{ fails: number }>(result);
    return rows[0]?.fails ?? 0;
  } catch (err) {
    console.warn('[profile] meal_fail_count failed:', err);
    return 0;
  }
}
