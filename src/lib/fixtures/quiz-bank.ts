/**
 * Quiz fixture loader.
 *
 * Source: docs/spec/content-quiz.csv (mirrored to ./quiz-bank.csv so Vite
 * can `?raw` import it at build-time). Columns:
 *
 *   Source, 題目編號, 題目類別, Question, 選項A, 選項B, 選項C, 正確答案, 講解
 *
 * Rows with an empty Question OR correct answer are dropped (the sheet has
 * a few placeholder rows). The loader runs once at module load and caches
 * the resulting array.
 *
 * IDs are 1-based and assigned by row order, since the CSV column "題目編號"
 * is left blank for most rows.
 */
import type { QuizQuestion } from '@/api/content';
import { parseCSV } from '@/lib/csv';
import csvText from './quiz-bank.csv?raw';

function build(): QuizQuestion[] {
  const rows = parseCSV(csvText);
  const out: QuizQuestion[] = [];
  let nextId = 1;
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const source = (r[0] ?? '').trim();
    const category = (r[2] ?? '').trim();
    const question = (r[3] ?? '').trim();
    const a = (r[4] ?? '').trim();
    const b = (r[5] ?? '').trim();
    const c = (r[6] ?? '').trim();
    const correct = (r[7] ?? '').trim();
    const explanation = (r[8] ?? '').trim();
    if (!question || !correct || !a || !b || !c) continue;
    out.push({
      id: nextId++,
      source: source || 'ProVeg',
      category: category || '一般',
      question,
      option_a: a,
      option_b: b,
      option_c: c,
      correct_answer: correct,
      explanation,
    });
  }
  return out;
}

export const QUIZ_BANK_FIXTURE: ReadonlyArray<QuizQuestion> = build();

/** Pseudo-random pick. Defaults to Math.random; injectable for tests. */
export function randomQuizFromFixture(
  rng: () => number = Math.random,
): QuizQuestion | null {
  if (QUIZ_BANK_FIXTURE.length === 0) return null;
  const idx = Math.floor(rng() * QUIZ_BANK_FIXTURE.length);
  return QUIZ_BANK_FIXTURE[idx] ?? null;
}
