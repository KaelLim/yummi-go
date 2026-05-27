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

export interface ChallengePurpose {
  id: number;
  key: string;
  emoji: string | null;
  label: string;
  sort_order: number;
  active: number | boolean;
}

/**
 * The hardcoded fallback used when drust is unreachable mid-onboarding.
 * Must stay in sync with what's seeded in challenge_purposes — if someone
 * edits the table to add a new option, this list lags but the live drust
 * read takes precedence so users still see the latest.
 */
const PURPOSE_FALLBACK: ChallengePurpose[] = [
  { id: -1, key: 'body',        emoji: '🏃', label: 'Body management 健康管理',      sort_order: 1, active: 1 },
  { id: -2, key: 'environment', emoji: '🌱', label: 'Environment protection 環保',  sort_order: 2, active: 1 },
  { id: -3, key: 'vow',         emoji: '🙏', label: 'Make a vow 發願',              sort_order: 3, active: 1 },
];

export interface PetNameSuggestion {
  id: number;
  name: string;
  sort_order: number;
  active: number | boolean;
}

/**
 * Hardcoded fallback for pet name suggestions — used when drust is
 * unreachable on /onboarding/pet-name. Keep loosely in sync with what's
 * seeded in pet_name_suggestions; the live read takes precedence so
 * admin edits to the table propagate immediately.
 */
const PET_NAME_FALLBACK: PetNameSuggestion[] = [
  { id: -1, name: '小綠', sort_order: 1, active: 1 },
  { id: -2, name: '阿芽', sort_order: 2, active: 1 },
  { id: -3, name: '豆豆', sort_order: 3, active: 1 },
  { id: -4, name: '小翠', sort_order: 4, active: 1 },
  { id: -5, name: '蛋蛋', sort_order: 5, active: 1 },
];

export async function listPetNameSuggestions(): Promise<PetNameSuggestion[]> {
  try {
    const result = await drust.list<PetNameSuggestion>('pet_name_suggestions', {
      limit: '100',
    });
    const live = result.records
      .filter((r) => Number(r.active) === 1)
      .sort((a, b) => a.sort_order - b.sort_order);
    if (live.length > 0) return live;
  } catch (err) {
    console.warn(
      '[content] list pet_name_suggestions failed, using fallback:',
      err,
    );
  }
  return [...PET_NAME_FALLBACK];
}

export async function listChallengePurposes(): Promise<ChallengePurpose[]> {
  try {
    const result = await drust.list<ChallengePurpose>('challenge_purposes', {
      limit: '100',
    });
    // Filter inactive + sort client-side because drust list ignores query
    // params and `active` is stored as 0/1 via the boolean→integer coercion.
    const live = result.records
      .filter((r) => Number(r.active) === 1)
      .sort((a, b) => a.sort_order - b.sort_order);
    if (live.length > 0) return live;
  } catch (err) {
    console.warn('[content] list challenge_purposes failed, using fallback:', err);
  }
  return [...PURPOSE_FALLBACK];
}

export interface Restaurant {
  id: number;
  name: string;
  address: string;
  lat: number;
  lng: number;
  place_type: string;
  /**
   * Pin tier per UX_UPDATE_SPEC_v0.1 §6:
   *   - gray  → unverified (tappable, opens the verification sheet)
   *   - green → verified
   *   - 'blue' is a legacy stored value that now renders as orange
   *      (partner tier). Schema is unchanged to avoid a migration; the
   *      map's PIN_COLOR table maps blue → orange for rendering.
   */
  pin_color: 'gray' | 'green' | 'blue';
  is_partner: number;
  partner_discount: string | null;
  /**
   * Optional — comma-separated list of vegan tiers the restaurant covers,
   * e.g. "vegan,vegetarian,veggie_option". A single venue can carry all
   * three tiers (a vegan-friendly bistro that also serves egg-dairy
   * dishes and has plant-friendly options on its omnivore menu). The
   * /map filter chips check membership: pick 'vegetarian' → see every
   * restaurant whose list includes 'vegetarian'. Restaurants with a
   * null `vegan_type` only show under the 全部 chip.
   */
  vegan_type?: string | null;
  /**
   * Optional human-readable business hours line (e.g.
   * "週一至週五 11:00–21:00 / 週末公休"). Free-form so admins can list
   * varied schedules without enforcing a strict structured format. The
   * map card shows it below the restaurant name when present.
   */
  business_hours?: string | null;
  /**
   * Optional Google Places ID used to build a precise deep link to the
   * Google Maps store page (蔬食地圖規格 v0.1 §3.2 / §5.2). When present,
   * address taps land on the canonical Google business page (phone,
   * hours, photos, navigate). Falls back to a name+address search when
   * absent — better than dropping the user on a bare coordinate.
   */
  google_place_id?: string | null;
  /**
   * Optional comma-separated activity tags powering the map's 活動標籤
   * filter group (蔬食地圖規格 v0.1 §1.5). Recognised values:
   *   - "600plates" → 蔬食 600 盤 campaign
   *   - any other future campaign key
   * The 'partner' tag is *not* stored here — it's derived from
   * is_partner === 1 so a single source of truth stays at that column.
   * Helper: `parseActivityTags(r)` returns the combined set.
   */
  activity_tags?: string | null;
}

/** Split a comma-separated `vegan_type` into trimmed, deduped tiers. */
export function parseVeganTypes(r: Pick<Restaurant, 'vegan_type'>): string[] {
  if (!r.vegan_type) return [];
  const seen = new Set<string>();
  for (const part of r.vegan_type.split(',')) {
    const v = part.trim();
    if (v) seen.add(v);
  }
  return Array.from(seen);
}

/**
 * Combined activity-tag set per 蔬食地圖規格 v0.1 §1.5. 'partner' is
 * derived (not stored in activity_tags) so the partner column stays
 * authoritative. A restaurant with neither is_partner nor activity_tags
 * falls into the 'other' bucket — that's how regular places surface
 * under 其他.
 */
export const ACTIVITY_TAG_PARTNER = 'partner';
export const ACTIVITY_TAG_600 = '600plates';
export const ACTIVITY_TAG_OTHER = 'other';

export function parseActivityTags(
  r: Pick<Restaurant, 'is_partner' | 'activity_tags'>,
): string[] {
  const out = new Set<string>();
  if (r.is_partner === 1) out.add(ACTIVITY_TAG_PARTNER);
  if (r.activity_tags) {
    for (const part of r.activity_tags.split(',')) {
      const v = part.trim();
      if (v) out.add(v);
    }
  }
  if (out.size === 0) out.add(ACTIVITY_TAG_OTHER);
  return Array.from(out);
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
