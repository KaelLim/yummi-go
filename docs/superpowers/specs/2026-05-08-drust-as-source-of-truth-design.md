# Drust as Source of Truth — Storage Redesign

**Date:** 2026-05-08
**Status:** approved (autonomous execution per user instruction)
**Scope:** prototype, but designed to scale conceptually to **100,000 users**.
**Out of scope:** food-scan AI integration, Google Maps, OAuth/SSO. Authentication stays at the existing `users (username, password_hash)` model.

## 1. Goal

Move all **user-scoped, authoritative state** from `localStorage` into the drust SQLite backend. Keep `localStorage` only for **device-scoped preferences** that don't survive a fresh install or sign-in on a second device.

Document the storage layout, query patterns, and indexing trade-offs explicitly so the next engineer can reason about behaviour at 100k users without surprises.

## 2. Why now

The prototype currently mixes three persistence styles:

1. drust (canonical: users, pet_states, profile, quiz_attempts) — partial coverage
2. `localStorage` for stuff drust doesn't yet hold (strikes, poison cooldown, challenge start timestamp)
3. In-memory only (`$today.missionsDone`, `$today.totalXpToday`) — vanishes on reload

That mix means:
- Sign in on a second device → fresh egg, lost cooldown, lost strikes
- Refresh `/home` mid-day → quiz "已完成" flag ✓ (drust-backed) but other missions reset
- The `daily_progress` table exists in drust with the perfect schema but is **completely unused** (0 rows)

This redesign closes those gaps and aligns the data model with the spec's "100k users on Tzu Chi platform" target.

## 3. Constraints we have to design around

### 3.1 drust capability matrix (observed)

| Capability | Available | Notes |
|---|---|---|
| Create collection / add field | ✅ | via MCP DDL |
| `unique: true` on a column | ✅ | implicit unique-index |
| Composite indices | ❌ | no API surface |
| `CREATE INDEX` after the fact | ❌ | rejected by SQL authorizer |
| RPC (parameterised SELECT) | ✅ | works around list 20-row cap and filter ignore |
| List endpoint with filters | ⚠️ | filter params silently ignored, capped at 20 rows |
| Per-user JWT / row-level auth | ❌ | shared anon token, server-side row check via RPC must enforce |

### 3.2 Anon-token god mode

Today every client uses the same `drust_GaKEqSNtWqoo9fMofnbxZn2ymDZPDVrXFYhfkmDbv3M` anon token with `select+insert+update+delete` on every collection. At 100k users this is a **vandalism vector**: anyone can wipe pet_states or rewrite challenge_scripts.

**Mitigation in scope:** prefer RPCs (parameterised, server-controlled) over direct table writes for **reads**. Treat direct `update_record` / `delete_record` calls as legacy / dev-tool surfaces.
**Out of scope:** real per-user JWT, row-level auth — documented as future work.

### 3.3 List endpoint hard cap

`GET /records/<coll>` returns at most **20 rows** and silently ignores filter params. So this:

```ts
const result = await drust.list<PetState>('pet_states');
return result.records.find((p) => p.user_id === userId);
```

…works at 3 users. At 100k users it returns 20 random pets — **almost never the requested user's pet**. Every list+filter site is a latent bug.

## 4. Storage taxonomy

Three buckets with explicit ownership rules.

### 4.1 drust (cross-device, authoritative)

Anything that represents the user's identity, progress, or earned state.

| Field/Table | Today | After |
|---|---|---|
| user identity | `users` ✓ | unchanged |
| profile (diet, baseline, eat_times, known_from) | `user_profiles` ✓ | unchanged |
| pet level/xp/stage/mood | `pet_states` ✓ | unchanged |
| pet **strikes** count | `localStorage.yummi.pet.strikes` 🔴 | **`pet_states.strikes`** (new col) |
| pet **poisoned_until** | `localStorage.yummi.pet.poisonedUntil` 🔴 | **`pet_states.poisoned_until`** (new col) |
| **challenge_started_at** | `localStorage.yummi.challengeStartedAt` 🔴 | **`users.challenge_started_at`** (new col) |
| daily missions done / xp today / lucky color | in-memory `$today` 🔴 | **`daily_progress`** (already exists, wire up) |
| check-ins | `check_ins` ✓ (empty so far) | unchanged schema |
| quiz attempts | `quiz_attempts` ✓ | **add `day_number` column** (recent code already inserts it but drust rejects unknown field — silent fail) |
| gem balance, fragments, makeup cards | `gem_balances`, `makeup_cards` ✓ | unchanged |
| restaurant list (12 entries today) | `restaurants` ✓ | seed missing 30 fixture rows |
| restaurant reviews | `restaurant_reviews` ✓ (empty) | unchanged schema |
| oath signed timestamp | `users.oath_signed_at` ✓ | unchanged |

### 4.2 localStorage (device-scoped, OK to lose)

Anything that's a UI preference for **this device** or a development affordance.

| Key | Why it stays local |
|---|---|
| `yummi.theme` (light/dark) | per-device feel — phone dark, laptop light is fine |
| `yummi.timeMode` | dev-only knob (real / compressed / manual) |
| `yummi.manualDay` | dev-only knob |
| `yummi.installPromptDismissed` | per-device install card; no cross-device signal needed |

`yummi.userId` is a special case: it's a **session marker** kept on the device so the user doesn't have to log in every visit. It's not authoritative — drust is the source of truth. If the id is stale (user deleted on backend), API calls return 404 and we drop the cookie.

**Removed from localStorage:** the four pet-strike / challenge keys above. Their `storage.set/get/remove` calls disappear in this migration.

### 4.3 In-memory (transient, regenerated on hydrate)

| Store | Source of truth | Hydration trigger |
|---|---|---|
| `$user` | `users` row via login response | `bootstrapFromStorage()` on boot |
| `$profile` | `user_profiles` row | `getUserFull(userId)` |
| `$pet` | `pet_states` row | `getPet(userId)` |
| `$today` | `daily_progress(user_id, day_number)` | `setupDaySync` → `hydrateDailyProgress(userId, day)` |
| `$challenge` | `challenge_scripts` | day-sync loads current day script |
| `$gems` | (currently aggregate of profile.gems / fragments / cards) | `getUserFull` |
| `$ui` | localStorage (theme, time mode) + `users.challenge_started_at` (drust) | boot |

## 5. Schema delta

### 5.1 New columns

```
ALTER TABLE pet_states ADD COLUMN strikes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE pet_states ADD COLUMN poisoned_until TEXT;          -- ISO 8601, nullable
ALTER TABLE users ADD COLUMN challenge_started_at TEXT;          -- ISO 8601, nullable
ALTER TABLE quiz_attempts ADD COLUMN day_number INTEGER NOT NULL DEFAULT 1;
```

drust mapping (`add_field` MCP tool):

| Collection | Field | sql_type | nullable | default |
|---|---|---|---|---|
| pet_states | strikes | integer | false | 0 |
| pet_states | poisoned_until | text | true | null |
| users | challenge_started_at | text | true | null |
| quiz_attempts | day_number | integer | false | 1 |

### 5.2 Tables that already match the design (just need use)

- **`daily_progress`** — already has `(user_id, day_number, missions_done, total_xp, lucky_color, completed_at)`. Currently 0 rows. We start writing on every `markMissionDone`.

### 5.3 Restaurants seed

Production today has 12 rows; the prototype fixture has 30 distinct entries. Insert the 30 (no name overlap with existing) so drust has 42 restaurants for demo. Falls back to fixture only when drust list returns nothing.

## 6. RPC inventory (this is where 100k scale lives)

Every multi-key read pattern has to become an RPC, because list-endpoint filters don't work and the 20-row cap kills full table scans.

### Existing (keep)

| RPC | Purpose | Anon |
|---|---|---|
| `login(username, password_hash)` | login | ✅ |
| `get_user_full(user_id)` | one-shot user + profile + pet + gems join | ✅ |
| `get_day_script(day_number)` | challenge script for a day | ✅ |
| `random_quiz()` | one random question | ✅ |

### New (this redesign)

| RPC | Replaces | Why |
|---|---|---|
| `pet_for_user(user_id)` | `getPet()` list+filter | scan → indexed point-lookup once `pet_states.user_id` becomes UNIQUE in a future schema rebuild; for now, replaces the broken 20-row sample with a real WHERE |
| `daily_progress_for_day(user_id, day_number)` | nothing — net new | hydrate `$today` on day-sync |
| `check_ins_for_user(user_id)` | `listCheckIns(userId)` | profile calendar / Day-30 stats |
| `check_ins_for_user_day(user_id, day_number)` | `listCheckIns(userId, day)` | per-day meal aggregation |
| `has_quiz_attempt_for_day(user_id, day_number)` | latest `hasQuizAttemptForDay()` (currently lists 500) | bounded query |
| `quiz_attempts_for_user(user_id)` | profile / day-30 stats | analytics |
| `restaurants_filtered(place_type, partner_only)` | `listRestaurants` + client filter | server-side filtering at scale |
| `restaurant_reviews_for_restaurant(restaurant_id)` | future review listing | restaurant detail page |

### Write RPCs — deferred

drust RPCs are **SELECT-only** (per `create_rpc` description). Writes still go through `insert_record` / `update_record`. To replace the daily_progress upsert pattern (which needs `INSERT … ON CONFLICT DO UPDATE`) we wrap it in client-side logic: try update by id; if no row, insert. Documented in the storage map as a known idempotency gap.

## 7. Indexing strategy at 100k users

drust doesn't expose composite-index DDL. So:

### 7.1 Implicit indices we have

- `pet_states.user_id` is a foreign key but **not unique** today → SCAN. After this redesign we want it UNIQUE (1 pet per user) but adding UNIQUE to an existing column requires drop+recreate, which loses the 3 existing rows. Path: leave for a future migration; document the SCAN cost.
- `quiz_attempts.user_id`, `quiz_attempts.question_id` are FKs. SCAN today.
- `challenge_scripts.day_number` should be unique. Currently non-unique.

### 7.2 What we'd want (deferred)

```
CREATE UNIQUE INDEX pet_states_user_id ON pet_states(user_id);
CREATE UNIQUE INDEX user_profiles_user_id ON user_profiles(user_id);
CREATE UNIQUE INDEX gem_balances_user_id ON gem_balances(user_id);
CREATE UNIQUE INDEX makeup_cards_user_id ON makeup_cards(user_id);
CREATE UNIQUE INDEX daily_progress_user_day ON daily_progress(user_id, day_number);
CREATE UNIQUE INDEX check_ins_user_day_meal ON check_ins(user_id, day_number, meal_index);
CREATE INDEX quiz_attempts_user_day ON quiz_attempts(user_id, day_number);
CREATE INDEX restaurant_reviews_restaurant ON restaurant_reviews(restaurant_id);
CREATE INDEX restaurant_reviews_status ON restaurant_reviews(status);
```

drust limitation today: none of these can be added through MCP. Documented for the operator who'd issue them via direct SQLite access at the time of go-live.

### 7.3 Big-O at 100k users (without composite indices)

| Query | Rows scanned | Typical latency |
|---|---|---|
| `pet_for_user(user_id)` | ~100,000 | 80–150 ms |
| `daily_progress_for_day(user_id, day_number)` | ~100k × 30 ≈ 3M | 1–3 s ⚠️ |
| `check_ins_for_user(user_id)` | up to 9M | **5 s timeout risk** ⚠️ |
| `has_quiz_attempt_for_day` | ~3M | 1–3 s ⚠️ |

The ⚠️ rows justify the index work above. Until indices land, mitigate by:
- caching `$today` in-memory (only re-query on day-change)
- caching `$pet` in-memory (only re-query on awardXp / addStrike)
- never re-querying `check_ins_for_user(user_id)` on every nav — only on profile/day-30

## 8. Cache layer (client-side)

### Read-through pattern

```
UI binds → store atom
                ↑
        hydrate function
                ↑
        try drust call → on success, set atom; on error, leave previous atom value
```

Stale-while-revalidate is good enough for prototype: render whatever is in the atom, fire-and-forget the refetch in background.

### Write-through pattern

```
user action → write through drust API → on success, refresh atom from response
                                       → on failure, console.warn (soft-fail) + show toast
```

Optimistic updates are out of scope for prototype. Each user-driven write awaits drust before reflecting in UI.

### Day-change invalidation

`setupDaySync` is the single boundary that knows the day flipped. On every day flip:
1. fetch `get_day_script(day)` → set `$challenge`
2. fetch `daily_progress_for_day(user_id, day)` → upsert into `$today`
3. fetch `pet_for_user(user_id)` → set `$pet` (catches strikes/poison expired by other devices)

## 9. Authentication / authorisation (prototype-grade)

We keep the existing `(username, password_hash)` model. No OAuth, no JWT in this round.

But document the threat surface clearly:

- Anon token is shared. Any user can call `update_record('pet_states', <some other user's id>, {...})`.
- We mitigate by **never sending another user's id from the client** — every call uses `currentUserId()`. A malicious client could still poke other rows; that's accepted risk for prototype.
- Real fix (out of scope): drust per-user JWT + RPCs that read `auth.user_id()` instead of taking it as a param.

## 10. Migration order

Each step leaves the app in a working state. No "all or nothing" cutover.

1. **Schema:** add 4 new columns. Existing data unchanged.
2. **RPCs:** create the 8 new ones. Direct `list` callers keep working.
3. **Restaurants seed:** insert 30 fixture rows, drust now has 42.
4. **Server-of-truth swap (per feature):**
   1. Pet strikes/poison: read on `setPetFromRow`, write on `addStrike`/`clearStrikes`. localStorage keys deleted same commit.
   2. challenge_started_at: read from drust on bootstrap, write on day1-hook CTA. localStorage key deleted.
   3. daily_progress: hydrate `$today` from `daily_progress_for_day`. `markMissionDone` upserts the row.
5. **List → RPC swap (per call site):** `getPet`, `listCheckIns`, `getProfile`, `hasQuizAttemptForDay`. Behaviour is unchanged for the 3-user dataset; correctness restored at 100k.
6. **Tests / build / docs.**

## 11. STORAGE.md

A separate `docs/STORAGE.md` (companion to this spec) lists every persisted key/column with: who writes, who reads, why, expected access pattern at 100k. Living document — updated when state moves.

## 12. Out of scope

- Food-scan AI integration
- Google Maps API (using OSM tile layer)
- OAuth / Tzu Chi SSO
- Real per-user JWT / row-level auth
- Image upload pipeline for restaurant reviews
- Push notifications
- Service Worker offline write queue
- Composite-index DDL (drust limitation; documented)

## 13. Acceptance criteria

- All `localStorage` calls in `src/` for `yummi.pet.strikes`, `yummi.pet.poisonedUntil`, `yummi.challengeStartedAt` are removed
- `daily_progress` rows appear when a user completes a quiz / meal mission
- `pet_for_user`, `daily_progress_for_day`, `check_ins_for_user[_day]`, `has_quiz_attempt_for_day`, `quiz_attempts_for_user`, `restaurants_filtered` RPCs exist and are anon-callable
- `quiz_attempts.day_number` column exists; new attempts are accepted by drust (current silent failure resolved)
- `users.challenge_started_at` is populated for accounts that pressed Day 1 CTA
- Test suite green; `npm run build` succeeds
- `docs/STORAGE.md` documents all persisted state with the 100k query plan
