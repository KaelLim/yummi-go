# Drust as Source of Truth — Implementation Plan

> **For agentic workers:** This plan is being executed inline by the model that wrote it. Each step shows expected commands and outputs so a fresh agent could pick it up mid-stream.

**Goal:** Move every user-scoped piece of state out of `localStorage` into drust, fix the existing list+filter bugs, and document the full storage map.

**Architecture:** Per `docs/superpowers/specs/2026-05-08-drust-as-source-of-truth-design.md`.

**Tech Stack:** TypeScript / Vite / nanostores / drust SQLite BaaS / vitest+jsdom.

---

## Phase 1 — Schema

### Task 1.1 — Add `pet_states.strikes` + `pet_states.poisoned_until`

**Files:** drust schema (no source files)

- [ ] **Step 1:** call `add_field` for `pet_states`:
  - `{ name: 'strikes', sql_type: 'integer', nullable: false, default_value: 0 }`
  - `{ name: 'poisoned_until', sql_type: 'text', nullable: true }`
- [ ] **Step 2:** verify with `describe_collection('pet_states')` — both fields present.
- [ ] **Step 3:** sample a row to confirm existing rows got the default for `strikes`.

### Task 1.2 — Add `users.challenge_started_at`

- [ ] `add_field` `users` `{ name: 'challenge_started_at', sql_type: 'text', nullable: true }`
- [ ] verify via `describe_collection('users')`.

### Task 1.3 — Add `quiz_attempts.day_number`

- [ ] `add_field` `quiz_attempts` `{ name: 'day_number', sql_type: 'integer', nullable: false, default_value: 1 }`
- [ ] verify, plus check existing 9 rows now have `day_number = 1`.

### Task 1.4 — Seed missing restaurants

- [ ] Loop over `RESTAURANTS_FIXTURE` (30 entries from `src/lib/fixtures/restaurants.ts`)
- [ ] `insert_record('restaurants', { name, address, lat, lng, place_type, pin_color, is_partner, partner_discount })` for each — letting drust auto-assign id (will be 13-42)
- [ ] verify with `count_rows('restaurants')` → expect 42

---

## Phase 2 — RPCs

For each RPC: define SQL, params, anon_callable=true, then `call_rpc` once with a known user_id to confirm it returns sensible data.

### Task 2.1 — `pet_for_user(user_id)`

```sql
SELECT id, user_id, level, current_xp, accumulated_xp, stage, mood,
       last_fed_at, strikes, poisoned_until
FROM pet_states
WHERE user_id = :user_id
LIMIT 1
```

- params: `[{ name: 'user_id', type: 'integer', required: true }]`

### Task 2.2 — `profile_for_user(user_id)`

```sql
SELECT id, user_id, diet_type, challenge_level, eat_times, known_from, baseline
FROM user_profiles
WHERE user_id = :user_id
LIMIT 1
```

### Task 2.3 — `daily_progress_for_day(user_id, day_number)`

```sql
SELECT id, user_id, day_number, missions_done, total_xp, lucky_color, completed_at
FROM daily_progress
WHERE user_id = :user_id AND day_number = :day_number
LIMIT 1
```

### Task 2.4 — `check_ins_for_user(user_id)`

```sql
SELECT id, user_id, day_number, meal_index, timestamp, food_items, nutrition,
       vegan_type, was_meat_replaced, lucky_color_matched, xp_earned, gems_earned
FROM check_ins
WHERE user_id = :user_id
ORDER BY day_number, meal_index
```

### Task 2.5 — `check_ins_for_user_day(user_id, day_number)`

Same as 2.4 but with `AND day_number = :day_number`.

### Task 2.6 — `has_quiz_attempt_for_day(user_id, day_number)`

```sql
SELECT 1 AS hit FROM quiz_attempts
WHERE user_id = :user_id AND day_number = :day_number
LIMIT 1
```

### Task 2.7 — `quiz_attempts_for_user(user_id)`

```sql
SELECT id, question_id, answer, correct, day_number, attempted_at
FROM quiz_attempts
WHERE user_id = :user_id
ORDER BY attempted_at DESC
```

### Task 2.8 — `restaurants_filtered(place_type, partner_only)`

```sql
SELECT id, name, address, lat, lng, place_type, pin_color, is_partner, partner_discount
FROM restaurants
WHERE (:place_type = '' OR place_type = :place_type)
  AND (:partner_only = 0 OR is_partner = 1)
ORDER BY name
```

- params: `place_type` (text, default ''), `partner_only` (integer, default 0)

---

## Phase 3 — API layer rewires

### Task 3.1 — `src/api/pet.ts`

- [ ] `getPet(userId)` calls `pet_for_user` RPC instead of `drust.list`
- [ ] return shape: extend `PetState` with `strikes: number; poisoned_until: string | null`
- [ ] `setMood(userId, mood)` — keep update_record path (write op, no RPC alternative). Find pet via `getPet` (now indexed by RPC).
- [ ] `addXp` — same; uses getPet then update.
- [ ] new `setStrikes(userId, strikes, poisonedUntil)` that updates `pet_states` for the user's row.
- [ ] new `clearStrikes(userId)` that sets `strikes=0, poisoned_until=null`.
- [ ] new `resetPet` keeps existing reset behaviour but also zeroes strikes/poison.

### Task 3.2 — `src/api/profile.ts`

- [ ] `getProfile(userId)` → `profile_for_user` RPC
- [ ] `updateProfile` keeps `update_record` (pre-fetched id from RPC)
- [ ] new `setChallengeStartedAt(userId, isoTs)` updates `users.challenge_started_at`
- [ ] new `getChallengeStartedAt(userId)` reads `users` via `get_user_full` (already joins) — no new RPC needed

### Task 3.3 — `src/api/check-ins.ts`

- [ ] `listCheckIns(userId, dayNumber?)` calls `check_ins_for_user_day` if dayNumber given, else `check_ins_for_user`
- [ ] `deleteAllCheckIns` lists via the new RPC then fans out delete (still O(N) writes — accepted at prototype scale)

### Task 3.4 — `src/api/content.ts`

- [ ] `recordQuizAttempt(userId, questionId, answer, correct, dayNumber)` already correct; verify drust accepts now that `day_number` column exists
- [ ] `hasQuizAttemptForDay(userId, dayNumber)` switches from `drust.list('quiz_attempts', limit:'500')` to `has_quiz_attempt_for_day` RPC
- [ ] `listRestaurants` switches to `restaurants_filtered` RPC (keep fixture fallback)
- [ ] new `quizAttemptsForUser(userId)` for profile/day-30

### Task 3.5 — new `src/api/daily-progress.ts`

```ts
export interface DailyProgressRow {
  id: number;
  user_id: number;
  day_number: number;
  missions_done: string; // JSON-encoded string[]
  total_xp: number;
  lucky_color: string | null;
  completed_at: string | null;
}

export async function getDailyProgress(userId: number, dayNumber: number): Promise<DailyProgressRow | null>;
export async function upsertDailyProgress(
  userId: number,
  dayNumber: number,
  patch: { missions_done?: string[]; total_xp?: number; lucky_color?: string; completed_at?: string | null }
): Promise<DailyProgressRow>;
```

`upsertDailyProgress` reads via RPC; if exists, `update_record`; if not, `insert_record`.

---

## Phase 4 — Store rewires

### Task 4.1 — `src/store/pet.ts`

- [ ] Drop the `STRIKE_STORAGE_KEY` / `POISON_STORAGE_KEY` localStorage code paths entirely.
- [ ] `setPetFromRow` reads `strikes` + `poisoned_until` from the petApi row.
- [ ] `addStrike()` becomes `addStrike(userId)` async — writes via `petApi.setStrikes` then `setPetFromRow`.
- [ ] `clearStrikes()` becomes `clearStrikes(userId)` async — writes via `petApi.clearStrikes`.
- [ ] `effectiveMood` and `poisonRemainingMs` unchanged (compute from store state).

### Task 4.2 — `src/store/today.ts`

- [ ] add `loadFromDailyProgress(row)` that hydrates `$today` from drust shape (parse missions_done JSON).
- [ ] `markMissionDone(key, xp)` becomes async: update store, then `upsertDailyProgress`. (best-effort drust write)
- [ ] `markMissionDoneSilent(key)` similarly upserts but with no XP delta.
- [ ] `setDay` keeps in-memory atom; rehydrate path moves to day-sync.

### Task 4.3 — `src/store/day-sync.ts`

- [ ] After `setDay`, also call `getDailyProgress(userId, day)` and feed `loadFromDailyProgress`.
- [ ] If no row exists, leave defaults (`missionsDone: []`, `totalXpToday: 0`).
- [ ] Continue to call `pet_for_user` to refresh strikes/poison (catches another device's mutations).
- [ ] Drop the `hasQuizAttemptForDay` rehydrate path — daily_progress now contains 'quiz' in `missions_done` if it was completed.

### Task 4.4 — `src/store/ui.ts` + day1-hook

- [ ] `challengeStartedAt` no longer pulled from localStorage on init. New: `bootstrapChallengeStartedAt(userId)` reads `users.challenge_started_at` after login and seeds `$ui`.
- [ ] day1-hook CTA calls `setChallengeStartedAt(userId, new Date().toISOString())` instead of `storage.set(KEYS.CHALLENGE_STARTED_AT)`.
- [ ] Remove `KEYS.CHALLENGE_STARTED_AT` from storage.ts (keep theme/timeMode/manualDay).

### Task 4.5 — `src/store/user.ts`

- [ ] After `getUserFull`, also call `bootstrapChallengeStartedAt` to seed `$ui`.
- [ ] `$pet.set` includes the new strikes/poisoned_until from the joined row (or zero if columns nullable + null).

### Task 4.6 — DevPanel integration

- [ ] `+1 Strike` button: `await addStrike(userId)`.
- [ ] `特赦` button: `await clearStrikes(userId)`.
- [ ] Existing reset-pet now also zeroes strikes/poison server-side (handled by Task 3.1's resetPet update).

---

## Phase 5 — Tests

### Task 5.1 — Update existing tests for signature changes

- [ ] `src/store/__tests__/pet-strikes.test.ts` — switch to `await addStrike(userId)`, mock the petApi.
- [ ] `src/api/__tests__/content.test.ts` — `hasQuizAttemptForDay` mocks `drust.rpc` with the new RPC name.
- [ ] `src/api/__tests__/check-ins.test.ts` — list calls now use RPC; mock `drust.rpc`.
- [ ] `src/api/__tests__/profile.test.ts` — `getProfile` uses RPC.
- [ ] PetView / Profile tests pass strikes/poisoned_until in their `$pet.set` literals (where they don't already).

### Task 5.2 — New tests

- [ ] `src/api/__tests__/daily-progress.test.ts` — get + upsert (insert path + update path) round-trips.
- [ ] `src/store/__tests__/today-drust.test.ts` — markMissionDone calls the upsert; loadFromDailyProgress hydrates correctly.

### Task 5.3 — Run

```bash
npx vitest run --reporter=default
```

Expected: all tests pass.

---

## Phase 6 — Docs + Verification

### Task 6.1 — `docs/STORAGE.md`

Single-page reference. Sections:
- "What lives where" matrix (every persisted key/column)
- 100k-user query plan per access pattern
- Migration history (this redesign and what changed)
- Known limitations (composite indices, anon-token god mode)

### Task 6.2 — Build

```bash
npm run build
```

Expected: `✓ built in <500ms`, no TypeScript errors.

### Task 6.3 — Manual smoke

- `/home` renders, dev panel `+1 Strike` flow works (poison shows 24h)
- `/profile` shows pet with effective mood
- `/tasks/quiz` records to drust; `/home` keeps quiz bubble in "已完成" after refresh
- `/map` shows 42 restaurants (12 existing + 30 fixture)

### Task 6.4 — Commit

One commit with the spec + plan + STORAGE.md + code change. Body references this plan.
