/**
 * Authentication module: register / registerGuest / login / logout / currentUserId.
 *
 * Stores the logged-in user id in localStorage under KEYS.USER_ID.
 * Uses sha256Salted (password + ':' + username) to hash before sending.
 *
 * Guest accounts are real users.id rows with `is_guest = 1`, an auto-
 * generated `guest_<hex>` username, and a throwaway random password.
 * Pet / XP / check-ins all key off user_id, so upgrading a guest to
 * an identified account later is just an UPDATE on the same row.
 */
import { drust } from './drust';
import { sha256Salted } from '@/lib/hash';
import { storage, KEYS } from '@/lib/storage';

export interface LoggedInUser {
  id: number;
  username: string;
  displayName: string;
  isGuest: boolean;
}

export async function register(
  username: string,
  password: string,
  displayName: string,
  opts: { isGuest?: boolean } = {},
): Promise<LoggedInUser> {
  const isGuest = opts.isGuest === true;
  const password_hash = await sha256Salted(password, username);
  const result = await drust.insert<{
    id: number;
    username: string;
    display_name: string;
  }>('users', {
    username,
    password_hash,
    display_name: displayName,
    is_guest: isGuest ? 1 : 0,
  });
  const userId = result.id;
  // Bootstrap default rows in 5 dependent tables.
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
    drust.insert('xp_balances', {
      user_id: userId,
      balance: 0,
      total_earned: 0,
      fed_today: 0,
      fed_today_date: null,
    }),
  ]);
  storage.set(KEYS.USER_ID, userId);
  return { id: userId, username, displayName, isGuest };
}

/**
 * Create an anonymous account.
 *
 * Generates a random username + password so the row satisfies the
 * existing NOT NULL constraints, but the user never sees either.
 * The session lives in localStorage (USER_ID); clearing storage = logout.
 */
export async function registerGuest(): Promise<LoggedInUser> {
  const suffix = randomHex(8);
  const username = `guest_${suffix}`;
  const password = randomHex(32);
  const displayName = `訪客 ${suffix.slice(0, 4)}`;
  return register(username, password, displayName, { isGuest: true });
}

function randomHex(byteLen: number): string {
  const bytes = new Uint8Array(byteLen);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
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
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    isGuest: false,
  };
}

export function logout(): void {
  storage.remove(KEYS.USER_ID);
}

export function currentUserId(): number | null {
  return storage.get<number | null>(KEYS.USER_ID, null);
}
