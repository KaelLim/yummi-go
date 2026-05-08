# Storage Map

Single source of truth for **what lives where** and **how each piece is read / written** in the Yummi Go prototype, designed to scale conceptually to **100,000 users**.

This document is the operational companion to `docs/superpowers/specs/2026-05-08-drust-as-source-of-truth-design.md`. Update it any time persisted state moves.

## Storage tiers

```
┌──────────────────────────────────────────────────────────────────────────┐
│  drust SQLite (cross-device, authoritative)                              │
│  ────────────────────────────────────────                                │
│  users / user_profiles / pet_states / gem_balances / makeup_cards        │
│  daily_progress / check_ins / quiz_attempts / restaurant_reviews         │
│  challenge_scripts / quiz_questions / restaurants                        │
│                                                                          │
│  Access pattern: RPCs for all multi-key reads; insert/update for writes  │
│  Auth: shared anon bearer token (prototype). Future: per-user JWT        │
└──────────────────────────────────────────────────────────────────────────┘
                              │ read-through cache
                              ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  In-memory atoms (nanostores)                                            │
│  ────────────────────────────                                            │
│  $user / $profile / $pet / $today / $challenge / $gems / $ui             │
│                                                                          │
│  Hydrated on boot (bootstrapFromStorage) and on day-flip (setupDaySync)  │
│  Stale-while-revalidate: render whatever's there, refetch in background  │
└──────────────────────────────────────────────────────────────────────────┘
                              │ device-only persistence
                              ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  localStorage (per-device, non-authoritative)                            │
│  ────────────────────────────────────────────                            │
│  yummi.userId        — session marker, used to skip /login on re-visit   │
│  yummi.theme         — light/dark UI preference                          │
│  yummi.timeMode      — dev affordance (real / compressed / manual)       │
│  yummi.manualDay     — dev affordance (1–30 slider)                      │
│  yummi.installPromptDismissed (InstallPrompt-local) — per-device toast   │
└──────────────────────────────────────────────────────────────────────────┘
```

**Promotion rule:** anything that should follow a user across devices belongs in drust. Anything that's a local affordance (theme, dev tools, install card) stays in localStorage.

## Per-field reference

### drust collections (canonical)

#### `users`

| Column | Source | Read | Write | 100k notes |
|---|---|---|---|---|
| id | auto | `login` RPC, `get_user_full` RPC | `register` (insert) | UNIQUE auto-index |
| username | register | `login` RPC | register (insert) | should be UNIQUE — not enforced today |
| password_hash | register | `login` RPC matches | register (insert) | sha256(password \|\| ':' \|\| username) — no per-user salt |
| display_name | register | `get_user_full` RPC | register (insert) | nullable |
| oath_signed_at | onboarding/oath | `get_user_full` | `signOath` update | ISO 8601 |
| **challenge_started_at** | day1-hook CTA | `get_user_full` | `setChallengeStartedAt` update | NEW — replaces localStorage |

#### `user_profiles`

One row per user (1:1 with `users`).

| Column | Read | Write | Used by |
|---|---|---|---|
| user_id (FK) | `profile_for_user` RPC | onboarding inserts | identity card, baseline calc |
| diet_type | `get_user_full` | onboarding/diet-survey update | profile |
| challenge_level | `get_user_full` | onboarding/challenge-level | gating fog reduction |
| eat_times | `get_user_full` | onboarding/eat-times | future push schedule |
| known_from | `get_user_full` | onboarding/known-from | analytics |
| baseline | `get_user_full` | onboarding/baseline | impact calculator (CO2/water/land) |

#### `pet_states`

One row per user.

| Column | Read | Write | 100k notes |
|---|---|---|---|
| user_id (FK) | `pet_for_user` RPC, `get_user_full` join | register insert | should be UNIQUE — not enforced |
| level / current_xp / accumulated_xp | `pet_for_user`, `get_user_full` | `addXp` update | recomputed from accumulated_xp |
| stage | derived from level | `addXp` update | egg/baby/youth/adult/max |
| mood | `pet_for_user` | `setMood` | normal/happy/weak/critical/evolve |
| last_fed_at | `pet_for_user` | `addXp` update | ISO 8601 |
| **strikes** | `pet_for_user`, `get_user_full` | `setStrikes` update | NEW — replaces localStorage `yummi.pet.strikes` |
| **poisoned_until** | `pet_for_user`, `get_user_full` | `setStrikes` update | NEW — ISO 8601, null when not poisoned |

#### `daily_progress`

One row per (user_id, day_number). **NEW — populated by this redesign.**

| Column | Read | Write |
|---|---|---|
| user_id, day_number | `daily_progress_for_day` RPC | `upsertDailyProgress` |
| missions_done | RPC | upsert (JSON-encoded `string[]`) |
| total_xp | RPC | upsert (cumulative for the day) |
| lucky_color | RPC | upsert (memo for sharing flow) |
| completed_at | RPC | upsert (ISO 8601 once all 3 meals + quiz done) |

**Replaces** the in-memory `$today` that vanished on reload. Hydrated by `setupDaySync` after every day flip.

#### `check_ins`

Append-only: one row per (user_id, day_number, meal_index).

| Read | Write |
|---|---|
| `check_ins_for_user` RPC (profile calendar, day-30 stats) | `createCheckIn` insert |
| `check_ins_for_user_day` RPC (per-day aggregation) | `deleteAllCheckIns` (dev-only fan-out) |

Schema: user_id, day_number, meal_index (1/2/3), timestamp, food_items (JSON), nutrition (JSON), vegan_type, was_meat_replaced (0/1), lucky_color_matched (0/1), xp_earned, gems_earned.

At 100k users × 30 days × 3 meals = **9M rows**. Currently zero indices ⇒ table-scan risk. RPC-only access path keeps SQL bounded but `WHERE user_id = ?` still scans without an index. See "Indexing strategy" below.

#### `quiz_attempts`

Append-only: per question answered.

| Read | Write |
|---|---|
| `has_quiz_attempt_for_day` RPC (existence check) | `recordQuizAttempt` insert |
| `quiz_attempts_for_user` RPC (analytics) | — |

Schema: user_id, question_id, answer, correct (0/1), **day_number** (NEW), attempted_at.

At 100k users × 30 days = **3M rows**. `(user_id, day_number)` is the hot index target.

#### `gem_balances`, `makeup_cards`

Identical access pattern to `pet_states`: one row per user, joined by `get_user_full` RPC, mutated via `addGems` / `addFragments` / `resetGems` / `resetMakeup` (in `src/api/wallet.ts`).

#### `restaurant_reviews`

| Read | Write |
|---|---|
| (future) `restaurant_reviews_for_restaurant` RPC | `createReview` insert |
| (future) `restaurant_reviews_for_user` RPC | report flow updates `status` |

Schema: user_id, restaurant_id, rating, text, photo_id, vegan_type, status (pending/approved/rejected).

#### Read-only content (seeded)

| Collection | Read | Notes |
|---|---|---|
| `challenge_scripts` (30 rows) | `get_day_script` RPC, `listChallengeScripts` (with fixture merge) | seeded once |
| `quiz_questions` (95 rows) | `random_quiz` RPC | seeded once |
| `restaurants` (42 rows) | `restaurants_filtered` RPC | 12 original + 30 fixture |

### In-memory atoms

| Atom | Source of truth | Hydration |
|---|---|---|
| `$user` | `users` row (login response or get_user_full) | `bootstrapFromStorage()` on boot |
| `$profile` | `get_user_full` RPC (joined view) | `bootstrapFromStorage()` |
| `$pet` | `get_user_full` join + `pet_for_user` refresh | bootstrap + `reloadPet` from day-sync |
| `$today` | `daily_progress_for_day` RPC | `setupDaySync` → `loadDailyProgress` |
| `$challenge` | `get_day_script` RPC | `setupDaySync` |
| `$gems` | `get_user_full` join (placeholder, may move to dedicated atom) | `bootstrapFromStorage` |
| `$ui` | localStorage (theme/timeMode/manualDay) + `users.challenge_started_at` (ISO → epoch ms) | boot + `bootstrapChallengeStartedAtFromIso` |

### localStorage (device-scoped only)

| Key | Reader | Writer | Why local |
|---|---|---|---|
| `yummi.userId` | `auth.currentUserId()` | `register` / `login` | session marker; auto-recovers via `bootstrapFromStorage` |
| `yummi.theme` | `$ui` initial | `setTheme` | per-device feel |
| `yummi.timeMode` | `$ui` initial | `setTimeMode` (dev panel) | dev-only |
| `yummi.manualDay` | `$ui` initial | `setManualDay` (dev panel) | dev-only |
| `yummi.installPromptDismissed` | `InstallPrompt` mount | dismiss / install handlers | per-device install card |

**Removed in 2026-05-08 redesign:** `yummi.pet.strikes`, `yummi.pet.poisonedUntil`, `yummi.challengeStartedAt`. All three now live in drust.

## Query plan at 100k users

The `list+filter` pattern is gone. Every per-user read uses a parameterised RPC:

| Action | RPC | Bound | Approx latency |
|---|---|---|---|
| Render `/home` greeting | `get_day_script(day)` | 1 row | 5–10 ms |
| Render `/home` pet bar | `pet_for_user(user_id)` | 1 row | 80–150 ms (no index) |
| Render `/home` quiz bubble | `daily_progress_for_day(user_id, day)` | 1 row | 1–3 s ⚠️ |
| Profile calendar | `check_ins_for_user(user_id)` | up to 90 rows per user | depends on index |
| Day-30 stats | `check_ins_for_user(user_id)` + `quiz_attempts_for_user` | 90 + 30 rows | depends on index |
| Map | `restaurants_filtered(place_type, partner_only)` | 1–42 rows | 5–10 ms (small table) |
| Quiz dedupe on page reload | `has_quiz_attempt_for_day(user_id, day)` | 1 row | 1–3 s ⚠️ |

⚠️ The latency targets assume the indices listed below. Without them, queries that filter on `user_id` table-scan all 9M check_ins / 3M quiz_attempts rows and risk hitting drust's 5-second authorizer timeout.

## Indexing strategy

drust does **not** expose `CREATE INDEX` through MCP — only `unique: true` on a column at create time. So:

### Already indexed (implicit, by primary key)

- All `id` columns are PRIMARY KEY AUTOINCREMENT.

### Should be indexed (deferred — needs a migration tool drust doesn't yet provide)

```sql
CREATE UNIQUE INDEX pet_states_user_id          ON pet_states(user_id);
CREATE UNIQUE INDEX user_profiles_user_id        ON user_profiles(user_id);
CREATE UNIQUE INDEX gem_balances_user_id         ON gem_balances(user_id);
CREATE UNIQUE INDEX makeup_cards_user_id         ON makeup_cards(user_id);
CREATE UNIQUE INDEX daily_progress_user_day      ON daily_progress(user_id, day_number);
CREATE UNIQUE INDEX check_ins_user_day_meal      ON check_ins(user_id, day_number, meal_index);
CREATE        INDEX quiz_attempts_user_day       ON quiz_attempts(user_id, day_number);
CREATE        INDEX restaurant_reviews_restaurant ON restaurant_reviews(restaurant_id);
CREATE        INDEX restaurant_reviews_status     ON restaurant_reviews(status);
CREATE UNIQUE INDEX challenge_scripts_day        ON challenge_scripts(day_number);
```

When drust grows direct-DDL or an admin endpoint, run the above as the first step of go-live.

## Authentication / authorisation

- Tokens: shared anon bearer (`drust_GaKEqSNtWqoo9fMofnbxZn2ymDZPDVrXFYhfkmDbv3M`). Service token exists but is server-only.
- `anon_caps` on every collection: `select | insert | update | delete`. **Anyone with the anon token can mutate any row.**
- We mitigate by always passing `currentUserId()` from the client; a malicious client could still poke other rows.
- Future hardening (out of scope): per-user JWT issued by `login` RPC; server-side row checks via `auth.user_id() = :user_id` predicate; capability tightening on `users` / `pet_states` / `daily_progress` to `select` only via RPC.

## Migration history

- **2026-05-08 (this redesign):**
  - Added `pet_states.strikes`, `pet_states.poisoned_until`, `users.challenge_started_at`, `quiz_attempts.day_number`
  - Created 8 RPCs: `pet_for_user`, `profile_for_user`, `daily_progress_for_day`, `check_ins_for_user`, `check_ins_for_user_day`, `has_quiz_attempt_for_day`, `quiz_attempts_for_user`, `restaurants_filtered`
  - Inserted 30 fixture restaurants (now 42 total)
  - Removed localStorage keys: `yummi.pet.strikes`, `yummi.pet.poisonedUntil`, `yummi.challengeStartedAt`
  - Replaced every `drust.list(coll)` + client-filter pattern with a server-side RPC
  - Wired `daily_progress` table (was empty, now populated on every mission complete)

## Known limitations

| Limitation | Impact | Path forward |
|---|---|---|
| No composite index DDL through drust MCP | per-user queries scan at scale | drust enhancement, or offline DDL once during go-live |
| Anon token has god-mode CRUD | one bad client can vandalise others | per-user JWT + auth.user_id() predicates |
| List endpoint silently caps at 20 rows + ignores filters | latent bug if any code path regresses to `drust.list` for FK lookup | RPC-first convention; CI grep guard could enforce |
| daily_progress upsert is read-modify-write | two devices on the same day race-write → loser stomped | acceptable for prototype; eventually a write RPC with `INSERT OR REPLACE` |
| No row-level retention policy on check_ins / quiz_attempts | unbounded growth at 100k users over time | retention RPC, partition table, or service cron |
| Theme / language not synced cross-device | acceptable trade-off for now | `user_profiles.preferences` JSON column when needed |
