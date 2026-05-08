/**
 * Global $ui → $today / $challenge synchroniser.
 *
 * Subscribes once at boot and keeps the day stores in sync with whatever
 * the time-mode / manual-day inputs say. Without this, only the route that
 * happens to call hydrate() picks up the right day — every other route
 * paints stale (e.g. /tasks header showing D1 while the dev panel slider
 * is at D6).
 */
import { $ui } from './ui';
import { $today, $challenge, setDay } from './today';
import { currentDayNumber } from '@/lib/time';
import { getDayScript } from '@/api/content';

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
  if ($today.get().dayNumber === day && $challenge.get().currentDay !== null) return;
  try {
    const script = await getDayScript(day);
    if (!script) return;
    const existing = $challenge.get().scripts.filter((s) => s.day_number !== script.day_number);
    const scripts = [...existing, script].sort((a, b) => a.day_number - b.day_number);
    setDay(scripts, day);
  } catch {
    /* soft fail — keep whatever was there */
  }
}
