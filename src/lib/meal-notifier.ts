/**
 * In-tab meal reminder. Polls every 60s; when "now" lands within ±5 min
 * of (mealtime − 10 min) and Notification permission is granted, fires a
 * Notification once per slot per local date.
 *
 * Tab-only — no service worker, no push backend. Acceptable for prototype.
 * Spec: 2026-05-08-prototype-polish-design.md §3.6
 */
import { $profile } from '@/store/user';

const POLL_MS = 60_000;
const WINDOW_MS = 5 * 60_000;
const LEAD_MS = 10 * 60_000; // fire 10 min before meal time

const MEAL_LABEL: Record<string, string> = {
  breakfast: '第一餐',
  lunch: '第二餐',
  dinner: '第三餐',
};

export function parseEatTimes(raw: string | null): Record<string, string> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed as Record<string, string>;
  } catch {
    return null;
  }
}

/**
 * Pure helper: which meal slot is currently in the notification window?
 * Returns null if no slot is within ±5 min of (mealtime − 10 min).
 * If multiple match, returns the one closest in time.
 */
export function computeMatchKey(
  eatTimes: Record<string, string>,
  now: Date,
): string | null {
  let bestKey: string | null = null;
  let bestDiff = Infinity;
  for (const [key, hhmm] of Object.entries(eatTimes)) {
    const [h, m] = hhmm.split(':').map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) continue;
    const target = new Date(now);
    target.setHours(h, m, 0, 0);
    target.setTime(target.getTime() - LEAD_MS);
    const diff = Math.abs(now.getTime() - target.getTime());
    if (diff <= WINDOW_MS && diff < bestDiff) {
      bestDiff = diff;
      bestKey = key;
    }
  }
  return bestKey;
}

export function setupMealNotifier(): () => void {
  const fired = new Map<string, string>(); // key → 'YYYY-MM-DD'
  let timer: number | null = null;

  function tick() {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission !== 'granted') return;
    const eatTimes = parseEatTimes($profile.get()?.eat_times ?? null);
    if (!eatTimes) return;
    const now = new Date();
    const key = computeMatchKey(eatTimes, now);
    if (!key) return;
    const today = now.toISOString().slice(0, 10);
    if (fired.get(key) === today) return;
    fired.set(key, today);
    try {
      new Notification(`該打卡了 — ${MEAL_LABEL[key] ?? key}`, {
        body: '走進廚房，今天的能量等你補進精靈體內 🍃',
        icon: '/icon-192.png',
      });
    } catch (err) {
      console.warn('[meal-notifier] Notification failed:', err);
    }
  }

  timer = window.setInterval(tick, POLL_MS);
  tick();
  return () => {
    if (timer !== null) {
      window.clearInterval(timer);
      timer = null;
    }
  };
}

export async function requestMealNotificationPermission(): Promise<NotificationPermission> {
  if (typeof Notification === 'undefined') return 'denied';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}
