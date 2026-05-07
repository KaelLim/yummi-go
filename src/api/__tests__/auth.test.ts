import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock drust before importing auth
vi.mock('@/api/drust', () => {
  return {
    drust: {
      insert: vi.fn(),
      rpc: vi.fn(),
      rpcRows: vi.fn(),
      list: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };
});

import { drust } from '@/api/drust';
import { register, login, logout, currentUserId } from '../auth';
import { sha256Salted } from '@/lib/hash';
import { KEYS } from '@/lib/storage';

const mockedDrust = drust as unknown as {
  insert: ReturnType<typeof vi.fn>;
  rpc: ReturnType<typeof vi.fn>;
  rpcRows: ReturnType<typeof vi.fn>;
  list: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

describe('auth', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('register', () => {
    it('inserts users, then bootstraps 4 collections, stores user id', async () => {
      mockedDrust.insert
        .mockResolvedValueOnce({ id: 42, record: { id: 42 } }) // users
        .mockResolvedValueOnce({ id: 1, record: {} }) // user_profiles
        .mockResolvedValueOnce({ id: 1, record: {} }) // pet_states
        .mockResolvedValueOnce({ id: 1, record: {} }) // gem_balances
        .mockResolvedValueOnce({ id: 1, record: {} }); // makeup_cards

      const out = await register('alice', 'pw123', 'Alice');

      expect(out).toEqual({ id: 42, username: 'alice', displayName: 'Alice' });

      // First insert: users with hashed password
      const expectedHash = await sha256Salted('pw123', 'alice');
      expect(mockedDrust.insert).toHaveBeenNthCalledWith(1, 'users', {
        username: 'alice',
        password_hash: expectedHash,
        display_name: 'Alice',
      });

      // Bootstrap order: collect all 4 collections (Promise.all so order may
      // vary in time but call args by collection are predictable).
      const calls = mockedDrust.insert.mock.calls.slice(1);
      const collections = calls.map((c) => c[0]);
      expect(collections).toEqual(
        expect.arrayContaining(['user_profiles', 'pet_states', 'gem_balances', 'makeup_cards']),
      );

      const petCall = calls.find((c) => c[0] === 'pet_states')!;
      expect(petCall[1]).toMatchObject({
        user_id: 42,
        level: 1,
        current_xp: 0,
        accumulated_xp: 0,
        stage: 'egg',
        mood: 'normal',
      });

      const gemCall = calls.find((c) => c[0] === 'gem_balances')!;
      expect(gemCall[1]).toMatchObject({
        user_id: 42,
        balance: 0,
        total_earned: 0,
        total_spent: 0,
      });

      const cardCall = calls.find((c) => c[0] === 'makeup_cards')!;
      expect(cardCall[1]).toMatchObject({
        user_id: 42,
        card_count: 0,
        fragment_count: 0,
      });

      const profileCall = calls.find((c) => c[0] === 'user_profiles')!;
      expect(profileCall[1]).toMatchObject({ user_id: 42 });

      // userId stored
      expect(localStorage.getItem(KEYS.USER_ID)).toBe('42');
    });
  });

  describe('login', () => {
    it('sends rpc with hashed password, stores user id on success', async () => {
      mockedDrust.rpc.mockResolvedValueOnce({
        column_names: ['id', 'username', 'display_name'],
        rows: [[7, 'alice', 'Alice']],
        row_count: 1,
        truncated: false,
      });
      mockedDrust.rpcRows.mockReturnValueOnce([
        { id: 7, username: 'alice', display_name: 'Alice' },
      ]);

      const out = await login('alice', 'pw');

      const expectedHash = await sha256Salted('pw', 'alice');
      expect(mockedDrust.rpc).toHaveBeenCalledWith('login', {
        username: 'alice',
        password_hash: expectedHash,
      });
      expect(out).toEqual({ id: 7, username: 'alice', displayName: 'Alice' });
      expect(localStorage.getItem(KEYS.USER_ID)).toBe('7');
    });

    it('throws on empty rows', async () => {
      mockedDrust.rpc.mockResolvedValueOnce({
        column_names: ['id', 'username', 'display_name'],
        rows: [],
        row_count: 0,
        truncated: false,
      });
      mockedDrust.rpcRows.mockReturnValueOnce([]);

      await expect(login('alice', 'wrong')).rejects.toThrow(/invalid credentials/i);
      expect(localStorage.getItem(KEYS.USER_ID)).toBeNull();
    });
  });

  describe('logout', () => {
    it('clears storage', () => {
      localStorage.setItem(KEYS.USER_ID, '99');
      logout();
      expect(localStorage.getItem(KEYS.USER_ID)).toBeNull();
    });
  });

  describe('currentUserId', () => {
    it('reads from storage', () => {
      localStorage.setItem(KEYS.USER_ID, '5');
      expect(currentUserId()).toBe(5);
    });

    it('returns null when missing', () => {
      expect(currentUserId()).toBeNull();
    });
  });
});
