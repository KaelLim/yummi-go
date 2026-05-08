/**
 * Global user store (nanostores).
 *
 * $user holds the minimal logged-in identity.
 * $profile holds the full joined profile (user + profile + pet + gems + cards).
 * $isLoggedIn is a computed derivation.
 *
 * bootstrapFromStorage() restores the session from localStorage on app boot
 * by hydrating both atoms using the stored userId.
 */
import { atom, computed } from 'nanostores';
import * as authApi from '@/api/auth';
import * as profileApi from '@/api/profile';
import { $pet } from './pet';
import { stageFromLevel, type PetStage } from '@/lib/pet-evolution';

export interface UserStoreShape {
  id: number;
  username: string;
  displayName: string;
}

export const $user = atom<UserStoreShape | null>(null);
export const $profile = atom<profileApi.UserFull | null>(null);
export const $isLoggedIn = computed($user, (u) => u !== null);

/** Restore session from localStorage on app boot. Returns true if restored. */
export async function bootstrapFromStorage(): Promise<boolean> {
  const id = authApi.currentUserId();
  if (!id) return false;
  try {
    const full = await profileApi.getUserFull(id);
    if (!full) {
      authApi.logout();
      return false;
    }
    $user.set({
      id: full.id,
      username: full.username,
      displayName: full.display_name ?? full.username,
    });
    $profile.set(full);
    // Seed $pet from the joined view so home/PetView paint the real level
    // immediately. Otherwise we render LV.1 defaults until awardXp fires.
    if (typeof full.level === 'number') {
      $pet.set({
        level: full.level,
        currentXp: full.current_xp ?? 0,
        accumulatedXp: full.accumulated_xp ?? 0,
        stage: ((full.stage as PetStage) ?? stageFromLevel(full.level)) as PetStage,
        mood: full.mood ?? 'normal',
      });
    }
    return true;
  } catch {
    authApi.logout();
    return false;
  }
}

export function setLoggedInUser(u: authApi.LoggedInUser) {
  $user.set({ id: u.id, username: u.username, displayName: u.displayName });
}

/**
 * Clear the local session: forget the stored user id and reset both atoms.
 * Navigation is intentionally left to the caller (e.g. a UI handler can
 * `clearUser(); navigate('/login')`).
 */
export function clearUser() {
  authApi.logout();
  $user.set(null);
  $profile.set(null);
  $pet.set(null);
}
