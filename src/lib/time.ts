/**
 * Demo time progression. Three modes:
 *   - real:        wall-clock days since challenge start (clamped 1..30)
 *   - compressed:  30 seconds = 1 day (clamped 1..30)
 *   - manual:      caller-supplied day (clamped 1..30)
 *
 * Pure function; receives all inputs as args so it can be tested without globals.
 */
export type TimeMode = 'real' | 'compressed' | 'manual';
const SECONDS_PER_DAY_COMPRESSED = 30;

export interface CurrentDayOpts {
  mode: TimeMode;
  challengeStartedAt: number;
  compressedStartedAt?: number;
  manualDay?: number;
  now?: number;
}

export function currentDayNumber(opts: CurrentDayOpts): number {
  const now = opts.now ?? Date.now();
  if (opts.mode === 'manual') return Math.max(1, Math.min(30, opts.manualDay ?? 1));
  if (opts.mode === 'compressed') {
    const elapsed = (now - (opts.compressedStartedAt ?? opts.challengeStartedAt)) / 1000;
    return Math.max(1, Math.min(30, Math.floor(elapsed / SECONDS_PER_DAY_COMPRESSED) + 1));
  }
  const days = Math.floor((now - opts.challengeStartedAt) / 86_400_000);
  return Math.max(1, Math.min(30, days + 1));
}
