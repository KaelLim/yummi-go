/**
 * Authentication module: register / login / logout / currentUserId.
 *
 * Stores the logged-in user id in localStorage under KEYS.USER_ID.
 * Uses sha256Salted (password + ':' + username) to hash before sending.
 */
import { drust } from './drust';
import { sha256Salted } from '@/lib/hash';
import { storage, KEYS } from '@/lib/storage';

export interface LoggedInUser {
  id: number;
  username: string;
  displayName: string;
}

export async function register(
  username: string,
  password: string,
  displayName: string,
): Promise<LoggedInUser> {
  const password_hash = await sha256Salted(password, username);
  // Insert into users
  const result = await drust.insert<{
    id: number;
    username: string;
    display_name: string;
  }>('users', { username, password_hash, display_name: displayName });
  const userId = result.id;
  // Bootstrap default rows in 4 dependent tables
  await Promise.all([
    drust.insert('user_profiles', { user_id: userId }),
    drust.insert('pet_states', {
      user_id: userId,
      level: 1,
      current_xp: 0,
      accumulated_xp: 0,
      stage: 'egg',
      mood: 'normal',
    }),
    drust.insert('gem_balances', {
      user_id: userId,
      balance: 0,
      total_earned: 0,
      total_spent: 0,
    }),
    drust.insert('makeup_cards', {
      user_id: userId,
      card_count: 0,
      fragment_count: 0,
    }),
  ]);
  storage.set(KEYS.USER_ID, userId);
  return { id: userId, username, displayName };
}

export async function login(
  username: string,
  password: string,
): Promise<LoggedInUser> {
  const password_hash = await sha256Salted(password, username);
  const result = await drust.rpc('login', { username, password_hash });
  const rows = drust.rpcRows<{
    id: number;
    username: string;
    display_name: string;
  }>(result);
  const row = rows[0];
  if (!row) throw new Error('Invalid credentials');
  storage.set(KEYS.USER_ID, row.id);
  return { id: row.id, username: row.username, displayName: row.display_name };
}

export function logout(): void {
  storage.remove(KEYS.USER_ID);
}

export function currentUserId(): number | null {
  return storage.get<number | null>(KEYS.USER_ID, null);
}
