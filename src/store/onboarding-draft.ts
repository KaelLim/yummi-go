/**
 * Transient onboarding answers, kept in-memory while the user walks the
 * 9-step flow without an account. After /register succeeds, flushDraftToDrust
 * persists the collected fields onto the freshly-created user row + profile,
 * stamps the oath timestamp, and clears the draft.
 *
 * If the user is already logged in (returning users who restart onboarding),
 * each step writes drust directly and the draft stays unused — see each
 * onboarding route for the `if ($user)` branch.
 */
import { atom } from 'nanostores';
import { signOath, updateProfile } from '@/api/profile';
import { setChallengeStartedAt } from '@/store/ui';

export interface OnboardingDraft {
  oath_signed: boolean;
  diet_type: string | null;
  baseline: string | null; // JSON-encoded
  purpose: string | null;
  challenge_level: number | null;
  eat_times: string | null; // JSON-encoded
  known_from: string | null;
  pet_name: string | null;
}

function emptyDraft(): OnboardingDraft {
  return {
    oath_signed: false,
    diet_type: null,
    baseline: null,
    purpose: null,
    challenge_level: null,
    eat_times: null,
    known_from: null,
    pet_name: null,
  };
}

export const $onboardingDraft = atom<OnboardingDraft>(emptyDraft());

export function patchDraft(patch: Partial<OnboardingDraft>): void {
  $onboardingDraft.set({ ...$onboardingDraft.get(), ...patch });
}

export function resetDraft(): void {
  $onboardingDraft.set(emptyDraft());
}

/**
 * Push every non-null draft field onto the just-registered user's rows, then
 * stamp challenge_started_at. Each call is best-effort: errors are logged but
 * don't abort the rest, because partial onboarding data still beats losing
 * the user mid-flush.
 */
export async function flushDraftToDrust(userId: number): Promise<void> {
  const d = $onboardingDraft.get();

  if (d.oath_signed) {
    try {
      await signOath(userId);
    } catch (err) {
      console.warn('[onboarding-draft] signOath failed:', err);
    }
  }

  const profilePatch: Record<string, unknown> = {};
  if (d.diet_type !== null) profilePatch.diet_type = d.diet_type;
  if (d.baseline !== null) profilePatch.baseline = d.baseline;
  if (d.purpose !== null) profilePatch.purpose = d.purpose;
  if (d.challenge_level !== null) profilePatch.challenge_level = d.challenge_level;
  if (d.eat_times !== null) profilePatch.eat_times = d.eat_times;
  if (d.known_from !== null) profilePatch.known_from = d.known_from;

  if (Object.keys(profilePatch).length > 0) {
    try {
      await updateProfile(userId, profilePatch);
    } catch (err) {
      console.warn('[onboarding-draft] updateProfile failed:', err);
    }
  }

  try {
    await setChallengeStartedAt(userId);
  } catch (err) {
    console.warn('[onboarding-draft] setChallengeStartedAt failed:', err);
  }

  resetDraft();
}
