# Prototype Polish — 10-item Design

**Date:** 2026-05-08
**Status:** approved (autonomous execution per user instruction)
**Goal:** close the gaps between `docs/workflow.md` and the running prototype so the demo feels complete end-to-end.
**Out of scope:** food-scan AI, Google Maps, OAuth, real per-user JWT, real push backend (matches earlier prototype-scope decision).

## 1. What this addresses

`docs/workflow.md` lays out the complete designer flow (12-step onboarding, per-meal reward chain, share, eat-time push, etc). The prototype implemented the high-traffic core but left ten visible gaps. This spec covers all ten as one batched polish round.

| # | Gap | Type | Impact |
|---|---|---|---|
| 1 | Onboarding missing **挑戰目的** + **來源調查** screens | new screens | demo realism |
| 2 | `/check-in/success` has no **share** button | small UI | demo realism |
| 3 | Meat-confirm fail uses ugly `alert()` | ux | polish |
| 4 | Reward chain (XP → progress → fog) collapsed into one page | animation | demo wow |
| 5 | Day-1 hook is generic; no challenge-rule readout | content | continuity |
| 6 | `eat_times` collected but never fires a notification | feature | feature parity with workflow §5 |
| 7 | `challenge_level` collected but never enforced | logic | breaks workflow §4 |
| 8 | `/profile/reviews` UI exists, just no live data path test | verify | sanity |
| 9 | Home lucky-card has no "已命中" indicator after a lucky-match | UI | feedback loop |
| 10 | No **build info** anywhere — demo can't tell which version is running | meta | ops |

## 2. Cross-cutting changes

### 2.1 drust schema delta

| Table | Field | Why |
|---|---|---|
| `user_profiles` | `purpose TEXT NULL` | item 1 — Body management / Environment protection / Make a vow |

Everything else stays — `known_from` already exists; `meal_fail:*` mission keys ride on `daily_progress.missions_done`'s existing JSON column.

### 2.2 New mission keys (canonical list)

`daily_progress.missions_done` (JSON `string[]`) gains three new mission flags. None require schema changes.

| Key | Set when | Carries XP? |
|---|---|---|
| `meal_fail:breakfast` / `:lunch` / `:dinner` | user confirms 是 to "這是肉嗎" → meat-fail screen | no, 0 XP |
| `lucky:hit` | a check-in's `luckyColorMatched=1` lands | no — XP already on the meal mission |
| `quiz` (existing) | quiz answered | yes (+15) |

`markMissionDone(key, xp)` already supports `xp=0`; we use that for non-XP flags.

### 2.3 Updated RPCs

None. Existing 8 RPCs cover everything. `restaurant_reviews_for_user` from item 8 already exists in `src/api/reviews.ts`.

## 3. Item-by-item design

### Item 1 — Onboarding 挑戰目的 + 來源調查

**Two new routes**, slotted into the existing 6-step flow → 8 steps:

```
oath → diet-survey → baseline → purpose → challenge-level → eat-times → known-from → day1-hook
                                ^^^^^^^                              ^^^^^^^^^^
                                NEW (4/8)                            NEW (7/8)
```

**`/onboarding/purpose`** — choose one of:
- 🏃 Body management（健康管理）
- 🌱 Environment protection（環保）
- 🙏 Make a vow（發願）
- Skip

Tap → `updateProfile(userId, { purpose: '...' })` → next.

**`/onboarding/known-from`** — choose one of:
- Facebook / Instagram / Threads / 親友分享 / Skip

Tap → `updateProfile(userId, { known_from: '...' })` → /onboarding/day1-hook.

Both routes follow the existing `choice-row` template (see `diet-survey.ts`). `createProgress(N, 8)` updated everywhere from 6 to 8.

### Item 2 — Per-meal Share button

`/check-in/success`:

```html
<div class="success-actions">
  <button class="btn btn-secondary" id="share">
    <span class="ms">share</span>分享成果
  </button>
  <button class="btn btn-primary" id="next">繼續守護</button>
</div>
```

Share text: `"我在 Yummi Go 完成第 D{n} 天 {早/午/晚}餐 +{xp} XP {luckyHit ? '🍀' : ''}"`

Reuse the `shareSummary` pattern from `day-30.ts` (navigator.share → clipboard fallback → alert).

### Item 3 — Meat-fail UX

**New route `/check-in/fail`** that replaces the `alert()` in `result.ts:200`.

Layout:
```
🍖🚫
蔬食餐不能有肉
嗚嗚嗚嗚嗚⋯⋯
下一餐記得不能吃肉哦～
[Try Again] [回首頁]
```

Static copy keyed to the workflow doc §4 ("失敗 / 替代分支"). No randomisation.

Behavior:
- On mount, write `meal_fail:{breakfast|lunch|dinner}` via `markMissionDone(key, 0)` so daily_progress records the failure
- Try Again → `resetCheckin()` → `/check-in`
- 回首頁 → `/home`

`result.ts:200` `alert(...)` → `navigate('/check-in/fail')`.

### Item 4 — Reward chain animation

`/check-in/success` becomes a **3-act sequenced experience**, each act ~1s, total ~3s.

```
ACT 1: +XP burst
  • Floating "+20 XP" bubble grows from pet → fades to top
  • If luckyMatch: "+15 XP 幸運色" bubble follows
  • CSS keyframe (translateY + opacity)

ACT 2: 30-day progress bar
  • Horizontal 30-segment row; today's segment fills with green
  • Drum-roll-style staggered animation across the segments leading up to today
  • CSS keyframe + nth-child delay

ACT 3: 守護者吸收
  • Pet sprite scale-pulse with green glow
  • Fog overlay opacity drops by `fog_reduction_pct`%
  • CSS keyframe

After ACT 3 settles: existing 「繼續守護」 + new Share button (item 2) appear.
```

Implementation:
- One success.ts file owns all three acts; uses `setTimeout` to add classes in sequence
- Acts can be skipped by clicking anywhere — sets all classes to "settled" immediately
- Underlying data (xp, luckyMatch, fog%) read from `$checkin.lastResult` (already populated)

### Item 5 — Day-1 hook upgrade

Current `/onboarding/day1-hook` only says "守護者氣息微弱". Replace with:

```
[breathing egg art, tinted by diet-type]

你獲得了一顆 {diet-typed} 守護者蛋

挑戰規則：
  📅 30 天連續挑戰
  🥗 {等級 1: 每天 1 餐無肉} | {等級 2: 三餐無肉，3 次容錯} | {等級 3: 三餐無肉，零容錯}
  🎯 目標：{purpose 一句話}

`purpose` → 一句話 mapping:
| purpose | line |
|---|---|
| body | 「為了照顧自己的身體，從一餐開始。」 |
| environment | 「每替代一公斤肉，地球少燒 60 kg CO₂。」 |
| vow | 「每一餐都是寫給未來的承諾。」 |
| (null/skip) | 「跟著精靈一起探索蔬食。」 |

灰霧濃重，蛋殼裡的精靈正等待你
請立即開始你的第一次打卡！

[開始打卡]
```

Egg color tint via CSS variable `--egg-tint` set from `$profile.diet_type`:

| diet_type | tint |
|---|---|
| vegan | `var(--color-primary)` (green) |
| vegetarian | soft pink |
| flexitarian | yellow |
| omnivore | salmon-red (deliberately "challenging" tint) |
| null/skip | neutral grey |

Egg breathing animation: 4s ease-in-out infinite scale 1 → 1.04 → 1 with subtle glow shadow.

### Item 6 — Eat-times in-app notifications

**Polling approach** (no service-worker registration, no push backend):

A new module `src/lib/meal-notifier.ts`:

```ts
export function setupMealNotifier(): () => void {
  let timer: number | null = null;
  const fired = new Map<string, string>(); // key → 'YYYY-MM-DD'

  function tick() {
    if (Notification.permission !== 'granted') return;
    const eatTimes = parseEatTimes($profile.get()?.eat_times);
    if (!eatTimes) return;
    const now = new Date();
    for (const [key, hhmm] of Object.entries(eatTimes)) {
      const [h, m] = hhmm.split(':').map(Number);
      const target = new Date(now);
      target.setHours(h, m - 10, 0, 0); // 10 min before meal
      const diff = Math.abs(now.getTime() - target.getTime());
      if (diff > 5 * 60_000) continue;        // ±5 min window
      const today = now.toISOString().slice(0, 10);
      if (fired.get(key) === today) continue; // already fired today
      fired.set(key, today);
      new Notification(`該打卡了 — ${MEAL_LABELS[key]}`, {
        body: '走進廚房，今天的能量等你補進精靈體內 🍃',
        icon: '/icon-192.png',
      });
    }
  }

  timer = window.setInterval(tick, 60_000);
  tick();
  return () => { if (timer) window.clearInterval(timer); };
}
```

Permission flow:
- After successful `/onboarding/eat-times`, ask `Notification.requestPermission()` once
- If denied, settings page exposes a re-ask button
- `main.ts` calls `setupMealNotifier()` after `bootstrapFromStorage` resolves

Demo limit: only fires while the tab is open. Acceptable for prototype; documented in STORAGE.md.

### Item 7 — challenge_level enforcement

Two surfaces consume the level:

**Profile page**:
```
容錯次數
等級 X · 已用 N / Y 次
[progress bar]
```
- Y derived: level 1 → ∞ (display "free", no bar), level 2 → 3, level 3 → 0
- N = count of `meal_fail:*` entries across all `daily_progress` rows for this user
- Needs new RPC `meal_fail_count(user_id)` that sums failures across all daily_progress rows

**Home pill** (under the day badge, only when level ≥ 2):
```
🛡 容錯 (Y - N) / Y
```
Subtle, no nav action.

When `N >= Y` (out of tolerance):
- Home shows a "挑戰失守" red pill
- Day-30 page reflects the failure in the badge grid (replaces `🌳 30 天滿勤` with `💔 挑戰失守`)
- No further enforcement (we don't lock features) — this is informational, prototype-grade

### Item 8 — Profile reviews verification

`/profile/reviews` route is fully wired (`listMyReviews` RPC + restaurant name resolution + empty state). **No code change needed** — execution plan just verifies it works after a new review row is created via `/map/restaurant/{id}/review`. If verification fails, file a follow-up; otherwise mark this item complete.

### Item 9 — Lucky-card hit indicator

Two parts:

**Result page** writes the hit:
```ts
markMissionDone(`meal:${slot}`, xp);          // existing
if (luckyMatch) markMissionDone('lucky:hit', 0); // NEW
```

**Home `lucky-card`** rendering:
```ts
const luckyHit = t.missionsDone.includes('lucky:hit');
const card = $$('#lucky-card');
card?.classList.toggle('hit', luckyHit);
const tag = $$('[data-bind="lucky-status"]');
if (tag) tag.textContent = luckyHit ? '✓ 已命中 +15 XP' : '';
```

CSS: `.lucky-card.hit` adds a subtle gold border + ✓ checkmark badge in the top-right corner.

When `luckyHit`, click → still navigate to `/check-in` (so the user can repeat any meal — no harm).

### Item 10 — Build info in Settings

`vite.config.ts` defines:
```ts
define: {
  __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '0.0.0'),
}
```

`src/vite-env.d.ts` declares the globals.

Settings page footer:
```html
<footer class="settings-footer">
  Yummi Go v{__APP_VERSION__} · 建置於 {formatted date}
</footer>
```

`vitest.config.ts` mirrors the same `define` so tests don't choke on undefined globals.

## 4. Touched files (preview)

```
DDL:
  drust pet_states / user_profiles via MCP add_field

NEW:
  src/routes/onboarding/purpose.ts
  src/routes/onboarding/known-from.ts
  src/routes/check-in/fail.ts
  src/lib/meal-notifier.ts

MODIFIED:
  src/api/profile.ts                  — UserProfile gains `purpose`
  src/main.ts                         — register new routes; setupMealNotifier
  src/routes/onboarding/baseline.ts   — next route → purpose
  src/routes/onboarding/challenge-level.ts — back/skip → purpose
  src/routes/onboarding/eat-times.ts  — next route → known-from; Notification permission ask
  src/routes/onboarding/day1-hook.ts  — diet-typed egg + rule readout
  src/routes/check-in/result.ts       — alert() → navigate('/check-in/fail'); lucky:hit mark
  src/routes/check-in/success.ts      — 3-act animation + Share button
  src/routes/profile/index.ts         — 容錯次數 card
  src/routes/profile/settings.ts      — version/build footer + re-ask notification
  src/routes/home.ts                  — lucky-card hit indicator + 容錯 pill
  src/components/Progress.ts          — 6 → 8 segments (or accept N as param — already does)
  src/styles/globals.css              — new keyframes + lucky-hit, fail screen, build footer
  vite.config.ts                      — define globals
  vitest.config.ts                    — mirror define
  src/vite-env.d.ts                   — declare globals
```

## 5. Migration order

Each step leaves the app in a working state.

1. **Schema** (drust DDL) — `user_profiles.purpose`
2. **Build info** (item 10) — touch vite.config; lowest risk first
3. **Onboarding additions** (item 1) — new routes, profile flow shifts 6 → 8
4. **Day-1 hook upgrade** (item 5) — depends on profile.purpose + diet_type from item 1
5. **Result.ts + meat-fail** (item 3) — new route + lucky-hit mark (item 9)
6. **Success animation chain** (item 4) — re-author success.ts + share (item 2)
7. **Home lucky pill** (item 9b) — depends on lucky-hit being written by item 5
8. **Notifier** (item 6) — `meal-notifier.ts` + permission ask
9. **Challenge-level enforcement** (item 7) — new RPC + home pill + profile card
10. **Reviews verification** (item 8) — exercise the flow end-to-end and confirm

## 6. Tests

Each route gets a basic mount/render test, plus assertion on the new behaviour:

| Test | What |
|---|---|
| `purpose.test.ts` | renders 4 options + skip; click writes profile then navigates |
| `known-from.test.ts` | same shape |
| `fail.test.ts` | mounts; Try Again → /check-in; 回首頁 → /home; markMissionDone called with `meal_fail:lunch` |
| `success.test.ts` | (existing) extended: share button presence; assert acts add classes in sequence with fake timers |
| `home.test.ts` | (existing) extended: lucky-card hit class when missionsDone includes lucky:hit |
| `meal-notifier.test.ts` | parseEatTimes JSON + window-match logic + dedupe-per-day |
| `today.test.ts` | (existing) extended: lucky:hit + meal_fail mission keys round-trip |

Notification API is mocked at the global level for jsdom.

## 7. Risk / known limitations

- **Notification API is tab-only** — covered in §3 item 6. Real push needs a service-worker + push server, deferred.
- **Animation timing** — 3-second reward chain might feel long on repeat use. Mitigation: tap-anywhere skip.
- **`purpose` enum drift** — three values in code, free-text column in drust. If a future PM adds a fourth purpose, no schema migration needed; rendering is a switch statement.
- **`meal_fail_count` RPC scans daily_progress** — at 100k users × 30 days = 3M rows, this is slow without index. Documented; same indexing limitation as the parent design.

## 8. Acceptance criteria

- All onboarding steps now show "X / 8" (was "X / 6")
- A new user passing through onboarding has `user_profiles.purpose` and `user_profiles.known_from` populated in drust
- Confirming "是" on the meat banner navigates to `/check-in/fail` and writes a `meal_fail:*` row to daily_progress
- `/check-in/success` shows a Share button that triggers navigator.share / clipboard
- The reward chain visibly animates in 3 acts and is skippable
- Day-1 hook shows a coloured egg + rule line keyed by the user's diet_type / challenge_level
- After a check-in with a lucky-color match, /home lucky-card shows a ✓ "已命中 +15 XP" indicator
- After granting notifications and putting an eat-time within 10 min ahead, an OS notification fires (within the active tab limitation)
- Profile shows 容錯次數 card; level 2 user with 1 meal_fail across 30 days shows "1 / 3"
- Settings shows "Yummi Go v0.0.0 · 建置於 {ISO date}"
- All tests pass; `npm run build` succeeds; manual walkthrough confirms each gate

## 9. STORAGE.md updates

After implementation, append to STORAGE.md:
- `user_profiles.purpose` to the field reference
- New mission keys: `lucky:hit`, `meal_fail:*` (in the daily_progress section)
- Notification permission stored in `Notification.permission` (browser API, not localStorage) — note this in the "What lives where" section
- New RPC `meal_fail_count(user_id)` if added
