/**
 * Mock Google login for the prototype splash page.
 *
 * Until a real Google OAuth integration lands (Google Cloud client_id +
 * drust set_oauth_provider + redirect handler), this helper fakes the
 * Account chooser → token-exchange → drust-lookup flow with a small
 * modal that picks from a couple of demo "Google accounts" or accepts
 * a free-form email.
 *
 * Behaviour mirrors what the real flow will do:
 *   1. User picks/enters an email.
 *   2. We derive a deterministic username `google_<sanitised email>` and
 *      a deterministic password (sha-of-email salt) so the same email
 *      always lands on the same drust row.
 *   3. login() with those creds — if drust says yes, we're done (returning
 *      user → /home).
 *   4. Otherwise register() a non-guest user with the same creds and
 *      route the caller into the new-player onboarding flow.
 *
 * Real Google OAuth is a separate Phase 2 PR. Replacing this stub is
 * a single helper swap — call sites only see the resolved
 * `{ isReturning, user }` shape.
 */
import { register, login, type LoggedInUser } from '@/api/auth';
import { updateProfile, setChallengeStartedAt } from '@/api/profile';

export interface MockGoogleAccount {
  email: string;
  displayName: string;
  avatarEmoji: string;
  /**
   * When true, the very first sign-in for this email auto-completes
   * onboarding so testers can demo the "returning user → /home" path
   * without first stepping through diet-survey / baseline / etc.
   * Subsequent sign-ins find the existing row and behave normally.
   */
  preOnboarded?: boolean;
}

/**
 * Pre-baked demo accounts shown in the picker. Order matches what a
 * real Google chooser would show — most-recently-used first. Free-form
 * email is also accepted via the modal's input field.
 *
 * Demo User is preOnboarded so the first click experiences the
 * "returning user" branch (straight to /home). Vegan Taster stays
 * fresh so testers can experience the new-user onboarding branch.
 */
export const MOCK_GOOGLE_ACCOUNTS: MockGoogleAccount[] = [
  { email: 'demo.user@gmail.com', displayName: 'Demo User',    avatarEmoji: '👩‍🌾', preOnboarded: true  },
  { email: 'taster@gmail.com',    displayName: 'Vegan Taster', avatarEmoji: '🥗',  preOnboarded: false },
];

export interface MockGoogleResult {
  /** True when an existing drust user matched the email — caller should
   *  fast-path to /home. False means a new account was just provisioned
   *  and the user should land in /onboarding/diet-survey. */
  isReturning: boolean;
  user: LoggedInUser;
}

/**
 * Run the mock Google flow for the given email. Tries login first; if
 * the user doesn't exist, registers them as a non-guest. The returned
 * `isReturning` flag tells the caller which post-auth route to use.
 *
 * For accounts flagged `preOnboarded` in MOCK_GOOGLE_ACCOUNTS, a fresh
 * registration is followed by an inline updateProfile + challenge-start
 * stamp so the very first click lands on /home like a returning user.
 */
export async function mockGoogleSignIn(email: string, displayName: string): Promise<MockGoogleResult> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new Error('email must include an @');
  }
  // Deterministic username/password so the same email always lands on
  // the same drust row. Real OAuth will swap this for a Google `sub`.
  const username = 'google_' + cleanEmail.replace(/[^a-z0-9]/g, '_').slice(0, 48);
  const password = 'mockgoogle:' + cleanEmail;
  try {
    const u = await login(username, password);
    return { isReturning: true, user: u };
  } catch {
    // No existing account — register a fresh non-guest row.
    const u = await register(username, password, displayName || cleanEmail.split('@')[0]!, { isGuest: false });
    const demo = MOCK_GOOGLE_ACCOUNTS.find((a) => a.email === cleanEmail);
    if (demo?.preOnboarded) {
      // Pre-fill onboarding so this demo account behaves like a
      // returning user from the first click. Soft-fails — if any of
      // these writes fail we still return the registered user, just
      // with the new-user route.
      try {
        await updateProfile(u.id, {
          diet_type: 'flexitarian',
          challenge_level: 2,
          purpose: 'body',
          baseline: JSON.stringify({ beef: 0.15, pork: 0.25, lamb: 0.05, chicken: 0.35, plant: 0.2 }),
          eat_times: JSON.stringify({ breakfast: '08:00', lunch: '12:30', dinner: '19:00' }),
        });
        await setChallengeStartedAt(u.id, new Date().toISOString());
        return { isReturning: true, user: u };
      } catch (err) {
        console.warn('[mock-google] pre-onboarding seed failed, falling back to new-user route:', err);
      }
    }
    return { isReturning: false, user: u };
  }
}
