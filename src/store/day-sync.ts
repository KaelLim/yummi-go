/**
 * Global $ui → $today / $challenge synchroniser.
 *
 * Subscribes once at boot and keeps the day stores in sync with whatever
 * the time-mode / manual-day inputs say. Without this, only the route that
 * happens to call hydrate() picks up the right day — every other route
 * paints stale (e.g. /tasks header showing D1 while the dev panel slider
 * is at D6).
 *
 * After setDay() resets per-day local state, we ask drust whether the user
 * already submitted today's quiz (or other persisted missions) and silently
 * re-tag them so the UI doesn't re-prompt across reloads.
 */
import { $ui } from './ui';
import { $today, $challenge, setDay, loadDailyProgress } from './today';
import { $user } from './user';
import { reloadPet, reloadWallet } from './pet';
import { currentDayNumber } from '@/lib/time';
import { getDayScript } from '@/api/content';
import { getDailyProgress } from '@/api/daily-progress';

export function setupDaySync(): void {
  let pending: Promise<void> | null = null;
  let last = '';
  // `undefined` = not yet seen any user; `null` = logged out; number = userId.
  // Distinguishes "first boot" from a real user-change so we don't blank a
  // freshly-bootstrapped session.
  let lastUserId: number | null | undefined = undefined;

  function fire(): void {
    const s = $ui.get();
    const u = $user.get();
    const newUserId = u?.id ?? null;
    const userChanged = lastUserId !== undefined && lastUserId !== newUserId;
    const day = currentDayNumber({
      mode: s.timeMode,
      challengeStartedAt: s.challengeStartedAt,
      manualDay: s.manualDay,
    });
    const key = `${newUserId ?? 'none'}|${s.timeMode}|${day}`;

    if (userChanged) {
      // Real user-change (logout, register-new, or switch-account). Blank
      // $today *immediately* so the next render doesn't see the previous
      // user's missionsDone before drust answers — this is the fix for
      // "新帳號顯示今日小測驗已完成".
      $today.set({
        dayNumber: day,
        totalXpToday: 0,
        missionsDone: [],
        luckyColor: '',
      });
      last = ''; // force re-hydrate even if (timeMode, day) is unchanged
    }
    lastUserId = newUserId;

    if (key === last) return;
    last = key;

    if (!u) return; // Logged out — nothing to fetch.
    pending = hydrate(day).finally(() => {
      pending = null;
    });
    void pending;
  }

  $ui.subscribe(fire);
  $user.subscribe(fire);
}

async function hydrate(day: number): Promise<void> {
  if (!($today.get().dayNumber === day && $challenge.get().currentDay !== null)) {
    try {
      const script = await getDayScript(day);
      if (script) {
        const existing = $challenge
          .get()
          .scripts.filter((s) => s.day_number !== script.day_number);
        const scripts = [...existing, script].sort(
          (a, b) => a.day_number - b.day_number,
        );
        setDay(scripts, day);
      }
    } catch {
      /* soft fail — keep whatever was there */
    }
  }

  await rehydrateForUser(day);
}

/**
 * Pull per-user-per-day state from drust:
 *   - daily_progress row → seed $today.missionsDone / totalXpToday
 *   - pet_for_user → catch strikes/poison mutations from another device
 */
async function rehydrateForUser(day: number): Promise<void> {
  const u = $user.get();
  if (!u) return;

  const fallbackLuckyColor = $challenge.get().currentDay?.lucky_color ?? '';

  try {
    const row = await getDailyProgress(u.id, day);
    loadDailyProgress(day, row, fallbackLuckyColor);
  } catch (err) {
    console.warn('[day-sync] daily_progress load failed:', err);
  }

  try {
    await reloadPet(u.id);
  } catch (err) {
    console.warn('[day-sync] reloadPet failed:', err);
  }

  try {
    await reloadWallet(u.id);
  } catch (err) {
    console.warn('[day-sync] reloadWallet failed:', err);
  }
}
