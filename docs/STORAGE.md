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
| purpose | `get_user_full`, `profile_for_user` | `onboarding/purpose` updateProfile | NEW — Body / Environment / Vow / null |

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

**Mission key catalogue (in `missions_done` JSON array):**
- `meal:breakfast` / `meal:lunch` / `meal:dinner` — successful meal check-in (xp credited)
- `meal_fail:breakfast` / `meal_fail:lunch` / `meal_fail:dinner` — confirmed-meat fail (no xp)
- `quiz` — daily quiz answered (15 xp)
- `lucky:hit` — recorded when a check-in's `lucky_color_matched=1` (no separate xp; the meal mission already includes the +15)
- `eco` — eco / 5R action checked off in Tasks page
- `review:{restaurant_id}` — restaurant review submitted (20 xp)

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

### Browser-managed state

- Notification permission: stored by the browser as `Notification.permission` ('default' | 'granted' | 'denied'). Yummi Go does not mirror this in localStorage. Re-ask flow: `/profile/settings → 推播提醒 → 允許用餐前 10 分鐘提醒`.

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

### Should be indexed (run during go-live — drust MCP can't issue these)

```sql
CREATE UNIQUE INDEX pet_states_user_id           ON pet_states(user_id);
CREATE UNIQUE INDEX user_profiles_user_id        ON user_profiles(user_id);
CREATE UNIQUE INDEX gem_balances_user_id         ON gem_balances(user_id);
CREATE UNIQUE INDEX makeup_cards_user_id         ON makeup_cards(user_id);
CREATE UNIQUE INDEX daily_progress_user_day      ON daily_progress(user_id, day_number);
CREATE UNIQUE INDEX check_ins_user_day_meal      ON check_ins(user_id, day_number, meal_index);
CREATE        INDEX quiz_attempts_user_day       ON quiz_attempts(user_id, day_number);
CREATE        INDEX restaurant_reviews_restaurant ON restaurant_reviews(restaurant_id);
CREATE        INDEX restaurant_reviews_status    ON restaurant_reviews(status);
CREATE UNIQUE INDEX challenge_scripts_day        ON challenge_scripts(day_number);
```

### Ops handover — running the index migration

drust's MCP surface and REST API are both SELECT-only for SQL — neither
will accept a `CREATE INDEX` statement. The migration has to be applied
**directly against the tenant's underlying SQLite file**, by someone with
shell or admin access on the drust host. Below is the runbook.

**Tenant identifier:** `fec8119d-0231-40f7-a7d6-c580ad312e96`
**Tenant name:** `yummigo`

#### Step 1 — Take a backup before you do anything

```bash
# On the drust host
sqlite3 /var/lib/drust/tenants/fec8119d-0231-40f7-a7d6-c580ad312e96.db \
  ".backup '/tmp/yummigo-pre-index.db'"

# Verify the backup file is non-empty + readable
ls -lh /tmp/yummigo-pre-index.db
sqlite3 /tmp/yummigo-pre-index.db 'SELECT count(*) FROM users;'
```

(Adjust the path if drust stores tenant DBs elsewhere — check the drust
config for the `tenant_data_dir` setting.)

#### Step 2 — Confirm the current state is unindexed

```bash
sqlite3 /var/lib/drust/tenants/fec8119d-0231-40f7-a7d6-c580ad312e96.db \
  "EXPLAIN QUERY PLAN SELECT * FROM pet_states WHERE user_id = 4 LIMIT 1;"
```

Expected output **before the migration**: `SCAN pet_states`. After the
migration this should change to `SEARCH pet_states USING INDEX
pet_states_user_id`.

#### Step 3 — Apply the index migration in a single transaction

Save the SQL block above to `indices.sql`, then:

```bash
sqlite3 /var/lib/drust/tenants/fec8119d-0231-40f7-a7d6-c580ad312e96.db <<'EOF'
BEGIN;
CREATE UNIQUE INDEX pet_states_user_id           ON pet_states(user_id);
CREATE UNIQUE INDEX user_profiles_user_id        ON user_profiles(user_id);
CREATE UNIQUE INDEX gem_balances_user_id         ON gem_balances(user_id);
CREATE UNIQUE INDEX makeup_cards_user_id         ON makeup_cards(user_id);
CREATE UNIQUE INDEX daily_progress_user_day      ON daily_progress(user_id, day_number);
CREATE UNIQUE INDEX check_ins_user_day_meal      ON check_ins(user_id, day_number, meal_index);
CREATE        INDEX quiz_attempts_user_day       ON quiz_attempts(user_id, day_number);
CREATE        INDEX restaurant_reviews_restaurant ON restaurant_reviews(restaurant_id);
CREATE        INDEX restaurant_reviews_status    ON restaurant_reviews(status);
CREATE UNIQUE INDEX challenge_scripts_day        ON challenge_scripts(day_number);
COMMIT;
EOF
```

Notes:
- The `BEGIN…COMMIT` wraps it as one atomic operation — if any statement
  fails (e.g. duplicate `(user_id, day_number)` rows in `daily_progress`),
  none of the indices are created and you're back where you started.
- If a UNIQUE constraint fails, the data has duplicates that need cleaning
  before you can index it. Likely culprits: dev/test rows where the same
  user got two pet_states entries. Either dedupe (keep the row with the
  highest `id`) or downgrade that one to `CREATE INDEX` (non-unique).
- SQLite locks the table while it builds the index. At 100k users the
  `check_ins` index is the slow one — expect 30–60 seconds of write lock.
  Schedule it during a quiet window.

#### Step 4 — Verify each index landed and is being used

```bash
sqlite3 /var/lib/drust/tenants/fec8119d-0231-40f7-a7d6-c580ad312e96.db \
  ".indices pet_states"
# Expected: pet_states_user_id

sqlite3 /var/lib/drust/tenants/fec8119d-0231-40f7-a7d6-c580ad312e96.db \
  "EXPLAIN QUERY PLAN SELECT * FROM pet_states WHERE user_id = 4 LIMIT 1;"
# Expected: SEARCH pet_states USING INDEX pet_states_user_id (user_id=?)
```

Repeat for each table. Specifically check the high-traffic ones:

```sql
EXPLAIN QUERY PLAN
  SELECT * FROM check_ins WHERE user_id = 4 ORDER BY day_number, meal_index;
-- Expected: SEARCH check_ins USING INDEX check_ins_user_day_meal

EXPLAIN QUERY PLAN
  SELECT * FROM daily_progress WHERE user_id = 4 AND day_number = 8;
-- Expected: SEARCH daily_progress USING INDEX daily_progress_user_day

EXPLAIN QUERY PLAN
  SELECT 1 FROM quiz_attempts WHERE user_id = 4 AND day_number = 8 LIMIT 1;
-- Expected: SEARCH quiz_attempts USING INDEX quiz_attempts_user_day
```

If any of these still say `SCAN`, the matching `CREATE INDEX` failed
silently and needs to be re-run individually.

#### Step 5 — Smoke-test through the app

After the indices land, hit the production frontend and walk through:

- `/home` should paint within ~50 ms (was ~150 ms with SCAN at 100k)
- `/profile` calendar should render without a visible delay
- `/challenge/day-30` aggregates should resolve in well under a second

The visible-to-user latency is the only acceptance criterion that
matters — drust's authorizer timeouts (5 seconds) are the failure mode
to prevent.

#### Step 6 — Rollback (only if something is badly broken)

Indices are pure read-side; nothing in app data depends on them. Drop
them individually and the app keeps working, just slowly:

```sql
DROP INDEX IF EXISTS pet_states_user_id;
DROP INDEX IF EXISTS check_ins_user_day_meal;
-- … etc.
```

If a UNIQUE constraint is masking a real data problem, restore the
backup from Step 1 instead:

```bash
sudo systemctl stop drust         # or however drust is run
cp /tmp/yummigo-pre-index.db \
   /var/lib/drust/tenants/fec8119d-0231-40f7-a7d6-c580ad312e96.db
sudo systemctl start drust
```

## Authentication / authorisation (prototype scope)

The shared anon bearer token is **intentionally** the only auth on the
client. Per-user JWT, row-level security, and OAuth/SSO are explicitly
out of scope for the prototype — the goal is for the frontend to look
real, not to be hardened against a malicious client.

For reference, the current state:
- Tokens: shared anon bearer + service token (`whoami` MCP shows both)
- `anon_caps` on every collection: `select | insert | update | delete`
- The client always passes `currentUserId()` from `$user` so honest
  clients only ever read/write their own rows
- A malicious client could still poke other users' rows; this is
  accepted prototype risk and documented here only so the next
  reviewer doesn't have to rediscover it

## Migration history

- **2026-05-08 (this redesign):**
  - Added `pet_states.strikes`, `pet_states.poisoned_until`, `users.challenge_started_at`, `quiz_attempts.day_number`
  - Created 8 RPCs: `pet_for_user`, `profile_for_user`, `daily_progress_for_day`, `check_ins_for_user`, `check_ins_for_user_day`, `has_quiz_attempt_for_day`, `quiz_attempts_for_user`, `restaurants_filtered`
  - Inserted 30 fixture restaurants (now 42 total)
  - Removed localStorage keys: `yummi.pet.strikes`, `yummi.pet.poisonedUntil`, `yummi.challengeStartedAt`
  - Replaced every `drust.list(coll)` + client-filter pattern with a server-side RPC
  - Wired `daily_progress` table (was empty, now populated on every mission complete)

- **2026-05-08 (prototype polish):**
  - Added `user_profiles.purpose` column
  - Added `meal_fail_count` RPC for tolerance counting
  - Updated `get_user_full` and `profile_for_user` RPCs to include `purpose`
  - New mission keys in `daily_progress.missions_done`: `meal_fail:*`, `lucky:hit`
  - New onboarding screens `/onboarding/purpose` (step 4) and `/onboarding/known-from` (step 7) — flow grew from 6 → 8 steps
  - New `/check-in/fail` screen replaces an `alert()` for confirmed-meat path
  - In-tab `meal-notifier` polling for eat_times reminders (uses `Notification` API; tab-only, no service worker)
  - localStorage map unchanged

## Known limitations

| Limitation | Impact | Path forward |
|---|---|---|
| No composite index DDL through drust MCP | per-user queries scan at scale | drust enhancement, or offline DDL once during go-live |
| Anon token has god-mode CRUD | one bad client can vandalise others | per-user JWT + auth.user_id() predicates |
| List endpoint silently caps at 20 rows + ignores filters | latent bug if any code path regresses to `drust.list` for FK lookup | RPC-first convention; CI grep guard could enforce |
| daily_progress upsert is read-modify-write | two devices on the same day race-write → loser stomped | acceptable for prototype; eventually a write RPC with `INSERT OR REPLACE` |
| No row-level retention policy on check_ins / quiz_attempts | unbounded growth at 100k users over time | retention RPC, partition table, or service cron |
| Theme / language not synced cross-device | acceptable trade-off for now | `user_profiles.preferences` JSON column when needed |
