/**
 * Content module: read-only challenge scripts, quiz Qs, restaurants;
 * plus quiz attempt recording.
 *
 * getDayScript / randomQuiz call drust RPCs (get_day_script / random_quiz).
 * listChallengeScripts sorts client-side because list endpoints don't
 * guarantee order.
 */
import { drust } from './drust';

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
  const result = await drust.rpc('get_day_script', { day_number: dayNumber });
  const rows = drust.rpcRows<ChallengeScript>(result);
  return rows[0] ?? null;
}

export async function listChallengeScripts(): Promise<ChallengeScript[]> {
  const result = await drust.list<ChallengeScript>('challenge_scripts', {
    limit: '50',
  });
  return result.records.sort((a, b) => a.day_number - b.day_number);
}

export async function randomQuiz(): Promise<QuizQuestion | null> {
  const result = await drust.rpc('random_quiz');
  const rows = drust.rpcRows<QuizQuestion>(result);
  return rows[0] ?? null;
}

export async function recordQuizAttempt(
  userId: number,
  questionId: number,
  answer: string,
  correct: boolean,
): Promise<void> {
  await drust.insert('quiz_attempts', {
    user_id: userId,
    question_id: questionId,
    answer,
    correct: correct ? 1 : 0,
  });
}

export async function listRestaurants(): Promise<Restaurant[]> {
  const result = await drust.list<Restaurant>('restaurants', { limit: '100' });
  return result.records;
}

export async function getRestaurant(id: number): Promise<Restaurant | null> {
  const result = await drust.list<Restaurant>('restaurants', {
    id: `eq.${id}`,
  });
  return result.records[0] ?? null;
}
