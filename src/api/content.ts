/**
 * Content module: read-only challenge scripts, quiz Qs, restaurants;
 * plus quiz attempt recording.
 *
 * Fallback policy: each read function tries drust first; on thrown error or
 * an empty result it returns the local fixture so the prototype works
 * without a seeded backend. Mutations (recordQuizAttempt) still go to drust
 * — fixtures are read-only.
 */
import { drust } from './drust';
import {
  DAY_SCRIPTS_FIXTURE,
  dayScriptFor,
} from '@/lib/fixtures/day-scripts';
import {
  RESTAURANTS_FIXTURE,
  restaurantById,
} from '@/lib/fixtures/restaurants';
import {
  QUIZ_BANK_FIXTURE,
  randomQuizFromFixture,
} from '@/lib/fixtures/quiz-bank';

export interface ChallengeScript {
  id: number;
  day_number: number;
  lucky_color: string;
  greeting: string;
  action_type: string;
  task_description: string;
  bonus_challenge: string;
  fog_reduction_pct: number;
}

export interface QuizQuestion {
  id: number;
  source: string;
  category: string;
  question: string;
  option_a: string;
  option_b: string;
  option_c: string;
  correct_answer: string;
  explanation: string;
}

export interface Restaurant {
  id: number;
  name: string;
  address: string;
  lat: number;
  lng: number;
  place_type: string;
  pin_color: 'gray' | 'green' | 'blue';
  is_partner: number;
  partner_discount: string | null;
}

export async function getDayScript(
  dayNumber: number,
): Promise<ChallengeScript | null> {
  try {
    const result = await drust.rpc('get_day_script', { day_number: dayNumber });
    const rows = drust.rpcRows<ChallengeScript>(result);
    if (rows[0]) return rows[0];
  } catch (err) {
    console.warn('[content] get_day_script failed, using fixture:', err);
  }
  return dayScriptFor(dayNumber);
}

/**
 * NOTE — drust's list endpoint hard-caps at 20 rows and ignores `offset`,
 * so a seeded backend with all 30 days will still come back partial. We
 * splice in fixture entries for any day_number drust didn't return; that
 * way the calendar always has the full 30-day script.
 */
export async function listChallengeScripts(): Promise<ChallengeScript[]> {
  let live: ChallengeScript[] = [];
  try {
    const result = await drust.list<ChallengeScript>('challenge_scripts', {
      sort: 'day_number',
      limit: '100',
    });
    live = result.records;
  } catch (err) {
    console.warn('[content] list_challenge_scripts failed, using fixture:', err);
  }
  if (live.length === 0) return [...DAY_SCRIPTS_FIXTURE];
  const byDay = new Map<number, ChallengeScript>();
  for (const s of DAY_SCRIPTS_FIXTURE) byDay.set(s.day_number, s);
  for (const s of live) byDay.set(s.day_number, s);
  return Array.from(byDay.values()).sort(
    (a, b) => a.day_number - b.day_number,
  );
}

export async function randomQuiz(): Promise<QuizQuestion | null> {
  try {
    const result = await drust.rpc('random_quiz');
    const rows = drust.rpcRows<QuizQuestion>(result);
    if (rows[0]) return rows[0];
  } catch (err) {
    console.warn('[content] random_quiz failed, using fixture:', err);
  }
  return randomQuizFromFixture();
}

export async function recordQuizAttempt(
  userId: number,
  questionId: number,
  answer: string,
  correct: boolean,
  dayNumber: number,
): Promise<void> {
  try {
    await drust.insert('quiz_attempts', {
      user_id: userId,
      question_id: questionId,
      answer,
      correct: correct ? 1 : 0,
      day_number: dayNumber,
    });
  } catch (err) {
    // Soft-fail: prototype runs without a writeable backend, but the quiz
    // UI shouldn't error out just because we couldn't record an attempt.
    console.warn('[content] recordQuizAttempt soft-failed:', err);
  }
}

/**
 * Returns true if the user already has at least one quiz_attempts row for
 * the given day_number. Used by /home to flip the bubble to "已完成" on
 * hydrate. Soft-fails to false on any drust error so a flaky backend
 * doesn't lock the user out of taking the quiz.
 *
 * Routed through the `has_quiz_attempt_for_day` RPC — server-side
 * existence-check, bounded query, scales to 100k users without scanning
 * client-side.
 */
export async function hasQuizAttemptForDay(
  userId: number,
  dayNumber: number,
): Promise<boolean> {
  try {
    const result = await drust.rpc('has_quiz_attempt_for_day', {
      user_id: userId,
      day_number: dayNumber,
    });
    return result.row_count > 0;
  } catch (err) {
    console.warn('[content] hasQuizAttemptForDay soft-failed:', err);
    return false;
  }
}

export async function listRestaurants(
  filter?: { placeType?: string; partnerOnly?: boolean },
): Promise<Restaurant[]> {
  try {
    const result = await drust.rpc<Restaurant>('restaurants_filtered', {
      place_type: filter?.placeType ?? '',
      partner_only: filter?.partnerOnly ? 1 : 0,
    });
    const rows = drust.rpcRows<Restaurant>(result);
    if (rows.length > 0) return rows;
  } catch (err) {
    console.warn('[content] restaurants_filtered failed, using fixture:', err);
  }
  return applyFilterToFixture(RESTAURANTS_FIXTURE, filter);
}

function applyFilterToFixture(
  rows: ReadonlyArray<Restaurant>,
  filter: { placeType?: string; partnerOnly?: boolean } | undefined,
): Restaurant[] {
  if (!filter) return [...rows];
  return rows.filter((r) => {
    if (filter.placeType && r.place_type !== filter.placeType) return false;
    if (filter.partnerOnly && r.is_partner !== 1) return false;
    return true;
  });
}

export async function getRestaurant(id: number): Promise<Restaurant | null> {
  try {
    const live = await drust.get<Restaurant>('restaurants', id);
    if (live) return live;
  } catch (err) {
    console.warn('[content] get restaurant failed, using fixture:', err);
  }
  return restaurantById(id);
}

/** Fixture quiz bank exposed for analytics / tests. */
export function quizBankSize(): number {
  return QUIZ_BANK_FIXTURE.length;
}
