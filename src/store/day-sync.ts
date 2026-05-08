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
import { $today, $challenge, setDay, markMissionDoneSilent } from './today';
import { $user } from './user';
import { currentDayNumber } from '@/lib/time';
import { getDayScript, hasQuizAttemptForDay } from '@/api/content';

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

  await rehydrateMissions(day);
}

/**
 * After setDay clears missionsDone for a new day, restore any flags that
 * persist server-side. Today: just the daily quiz. As more missions get
 * a backing table (eco actions, repair tasks…), check them here too.
 */
async function rehydrateMissions(day: number): Promise<void> {
  const u = $user.get();
  if (!u) return;
  try {
    const did = await hasQuizAttemptForDay(u.id, day);
    if (did) markMissionDoneSilent('quiz');
  } catch {
    /* soft fail */
  }
}
