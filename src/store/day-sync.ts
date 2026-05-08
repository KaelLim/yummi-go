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
import { reloadPet } from './pet';
import { currentDayNumber } from '@/lib/time';
import { getDayScript } from '@/api/content';
import { getDailyProgress } from '@/api/daily-progress';

export function setupDaySync(): void {
  let pending: Promise<void> | null = null;
  let last = '';

  $ui.subscribe((s) => {
    const day = currentDayNumber({
      mode: s.timeMode,
      challengeStartedAt: s.challengeStartedAt,
      manualDay: s.manualDay,
    });
    const key = `${s.timeMode}|${day}`;
    if (key === last) return;
    last = key;
    pending = hydrate(day).finally(() => {
      pending = null;
    });
    void pending;
  });
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
}
