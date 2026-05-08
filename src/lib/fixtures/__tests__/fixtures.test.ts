import { describe, it, expect } from 'vitest';
import { DAY_SCRIPTS_FIXTURE, dayScriptFor } from '../day-scripts';
import { RESTAURANTS_FIXTURE, restaurantById } from '../restaurants';
import {
  QUIZ_BANK_FIXTURE,
  randomQuizFromFixture,
} from '../quiz-bank';

describe('day-scripts fixture', () => {
  it('covers exactly day 1 through day 30', () => {
    expect(DAY_SCRIPTS_FIXTURE).toHaveLength(30);
    expect(DAY_SCRIPTS_FIXTURE.map((s) => s.day_number)).toEqual(
      Array.from({ length: 30 }, (_, i) => i + 1),
    );
  });

  it('every entry has greeting / lucky_color / task_description', () => {
    for (const s of DAY_SCRIPTS_FIXTURE) {
      expect(s.greeting).toBeTruthy();
      expect(s.lucky_color).toBeTruthy();
      expect(s.task_description).toBeTruthy();
    }
  });

  it('fog_reduction_pct sums to roughly 100 (90–110)', () => {
    const total = DAY_SCRIPTS_FIXTURE.reduce(
      (a, s) => a + s.fog_reduction_pct,
      0,
    );
    expect(total).toBeGreaterThanOrEqual(90);
    expect(total).toBeLessThanOrEqual(110);
  });

  it('dayScriptFor returns the matching entry, or null out of range', () => {
    expect(dayScriptFor(1)?.day_number).toBe(1);
    expect(dayScriptFor(30)?.day_number).toBe(30);
    expect(dayScriptFor(31)).toBeNull();
    expect(dayScriptFor(0)).toBeNull();
  });
});

describe('restaurants fixture', () => {
  it('has 30 entries with stable ids 1–30', () => {
    expect(RESTAURANTS_FIXTURE).toHaveLength(30);
    expect(RESTAURANTS_FIXTURE.map((r) => r.id).sort((a, b) => a - b)).toEqual(
      Array.from({ length: 30 }, (_, i) => i + 1),
    );
  });

  it('every entry has Taipei-ish coordinates and a place_type', () => {
    for (const r of RESTAURANTS_FIXTURE) {
      expect(r.lat).toBeGreaterThan(24.9);
      expect(r.lat).toBeLessThan(25.2);
      expect(r.lng).toBeGreaterThan(121.4);
      expect(r.lng).toBeLessThan(121.6);
      expect(r.place_type).toBeTruthy();
    }
  });

  it('restaurantById finds known and returns null for unknown', () => {
    expect(restaurantById(1)?.name).toBeTruthy();
    expect(restaurantById(999)).toBeNull();
  });

  it('partner restaurants always have a discount string', () => {
    for (const r of RESTAURANTS_FIXTURE) {
      if (r.is_partner === 1) {
        expect(r.partner_discount).toBeTruthy();
      } else {
        expect(r.partner_discount).toBeNull();
      }
    }
  });
});

describe('quiz-bank fixture', () => {
  it('parses at least 80 quiz questions from the CSV', () => {
    // Source CSV is ~95 rows after dropping incomplete entries (embedded
    // newlines inflate the line count). Floor at 80 so a small future trim
    // still keeps the bank usefully populated.
    expect(QUIZ_BANK_FIXTURE.length).toBeGreaterThanOrEqual(80);
  });

  it('every entry has question / 3 options / correct_answer', () => {
    for (const q of QUIZ_BANK_FIXTURE) {
      expect(q.question).toBeTruthy();
      expect(q.option_a).toBeTruthy();
      expect(q.option_b).toBeTruthy();
      expect(q.option_c).toBeTruthy();
      expect(q.correct_answer).toBeTruthy();
    }
  });

  it('correct_answer matches at least one option text in most rows', () => {
    let matched = 0;
    for (const q of QUIZ_BANK_FIXTURE) {
      if ([q.option_a, q.option_b, q.option_c].includes(q.correct_answer)) {
        matched += 1;
      }
    }
    // Source CSV has a handful of free-text answers that don't equal any
    // option label exactly — UI handles those by showing correct_answer
    // verbatim. Spot-check that the bulk of the bank still aligns.
    expect(matched / QUIZ_BANK_FIXTURE.length).toBeGreaterThan(0.6);
  });

  it('randomQuizFromFixture returns a question for any rng', () => {
    const first = randomQuizFromFixture(() => 0);
    const last = randomQuizFromFixture(() => 0.999);
    expect(first).not.toBeNull();
    expect(last).not.toBeNull();
    expect(first?.id).not.toBe(last?.id);
  });
});
