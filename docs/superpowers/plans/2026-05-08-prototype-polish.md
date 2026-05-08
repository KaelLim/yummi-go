# Prototype Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** close the 10-item gap between `docs/workflow.md` and the running prototype identified in `docs/superpowers/specs/2026-05-08-prototype-polish-design.md`.

**Architecture:** existing TS/Vite/nanostores PWA on top of drust SQLite. Each item ships as a self-contained PR-sized task; the migration order in spec §5 is preserved so every commit leaves the app working.

**Tech Stack:** TypeScript / Vite 8 / nanostores / drust SQLite BaaS / vitest+jsdom / Web Notification API.

---

## File Structure

```
DDL (drust MCP):
  user_profiles.purpose                   ← new TEXT column

NEW source files:
  src/routes/onboarding/purpose.ts        ← onboarding step 4 (purpose select)
  src/routes/onboarding/known-from.ts     ← onboarding step 7 (acquisition source)
  src/routes/check-in/fail.ts             ← meat-confirm fail screen
  src/lib/meal-notifier.ts                ← in-tab Notification scheduler
  src/lib/__tests__/meal-notifier.test.ts
  src/routes/onboarding/__tests__/purpose.test.ts
  src/routes/onboarding/__tests__/known-from.test.ts
  src/routes/check-in/__tests__/fail.test.ts

MODIFIED:
  src/api/profile.ts                      ← UserProfile + UserFull gain `purpose`
  src/api/content.ts                      ← `mealFailCount` for challenge_level enforcement
  src/main.ts                             ← register new routes + boot setupMealNotifier
  src/router.ts                           ← (no change; defRoute already supports new paths)
  src/routes/onboarding/baseline.ts       ← navigate('/onboarding/purpose')
  src/routes/onboarding/challenge-level.ts ← back→/purpose; createProgress 4/6 → 5/8
  src/routes/onboarding/eat-times.ts      ← navigate(known-from); permission ask
  src/routes/onboarding/day1-hook.ts      ← rule + diet-typed egg
  src/routes/check-in/result.ts           ← alert→navigate(fail); lucky:hit mark
  src/routes/check-in/success.ts          ← 3-act animation + Share button
  src/routes/profile/index.ts             ← 容錯次數 card
  src/routes/profile/settings.ts          ← build footer + re-ask notification
  src/routes/home.ts                      ← lucky-card hit indicator + 容錯 pill
  src/components/Progress.ts              ← already param-driven, just touch callers
  src/styles/globals.css                  ← keyframes / lucky-hit / fail / build footer / egg tints
  vite.config.ts                          ← define __APP_VERSION__ / __BUILD_TIME__
  vitest.config.ts                        ← mirror define
  src/vite-env.d.ts                       ← declare globals
  src/store/today.ts                      ← (no change; markMissionDone already supports xp=0)
  docs/STORAGE.md                         ← document new mission keys + purpose column
```

Each task below stays under ~30 minutes of focused work and produces one commit.

---

## Task 1: Schema — add `user_profiles.purpose`

**Files:**
- DDL: drust collection `user_profiles` (via MCP `add_field`)

- [ ] **Step 1: Add the column**

Use the drust MCP `add_field` tool:

```json
{
  "collection": "user_profiles",
  "field": { "name": "purpose", "sql_type": "text", "nullable": true }
}
```

- [ ] **Step 2: Verify the column landed**

Use drust MCP `describe_collection` for `user_profiles`. Expect a `purpose` TEXT field, nullable, default null.

- [ ] **Step 3: Spot-check existing rows**

Use drust MCP `sample_rows` for `user_profiles` (limit 3). Existing rows must show `purpose: null` — additive change, no data loss.

No commit yet — schema work is paired with the API + onboarding tasks below.

---

## Task 2: Build info defines

**Files:**
- Modify: `vite.config.ts`
- Modify: `vitest.config.ts`
- Modify: `src/vite-env.d.ts`

- [ ] **Step 1: Add defines to `vite.config.ts`**

Append a `define` block to the config:

```ts
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';
import pkg from './package.json' with { type: 'json' };

export default defineConfig({
  // ...existing config...
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
});
```

(If the file already imports `defineConfig` and exports a config, add only the `define` key with the same shape.)

- [ ] **Step 2: Mirror defines in `vitest.config.ts`**

```ts
export default defineConfig({
  // ...existing test config...
  define: {
    __APP_VERSION__: JSON.stringify('test'),
    __BUILD_TIME__: JSON.stringify('1970-01-01T00:00:00.000Z'),
  },
});
```

- [ ] **Step 3: Declare globals in `src/vite-env.d.ts`**

Append after the existing CSV declaration:

```ts
declare const __APP_VERSION__: string;
declare const __BUILD_TIME__: string;
```

- [ ] **Step 4: Verify build still works**

Run: `npm run build`
Expected: build succeeds in <1s; chunks unchanged in count.

- [ ] **Step 5: Verify tests still pass**

Run: `npx vitest run --reporter=default`
Expected: all 357 tests pass.

- [ ] **Step 6: Commit**

```bash
git add vite.config.ts vitest.config.ts src/vite-env.d.ts
git commit -m "feat(build): expose __APP_VERSION__ + __BUILD_TIME__ as compile-time globals"
```

---

## Task 3: Profile API — `purpose` field

**Files:**
- Modify: `src/api/profile.ts`

- [ ] **Step 1: Update interfaces**

In `src/api/profile.ts`, add `purpose: string | null` to both `UserProfile` and `UserFull`:

```ts
export interface UserProfile {
  user_id: number;
  diet_type: string | null;
  challenge_level: number | null;
  eat_times: string | null;
  known_from: string | null;
  baseline: string | null;
  purpose: string | null;  // NEW
}

export interface UserFull {
  // ...existing fields...
  purpose: string | null;  // NEW (after known_from / before baseline)
  // ...
}
```

- [ ] **Step 2: Update `profile_for_user` RPC and `get_user_full` RPC**

Use drust MCP `update_rpc` for `profile_for_user`:

```sql
SELECT id, user_id, diet_type, challenge_level, eat_times, known_from, baseline, purpose FROM user_profiles WHERE user_id = :user_id LIMIT 1
```

Use drust MCP `update_rpc` for `get_user_full`:

```sql
SELECT u.id, u.username, u.display_name, u.oath_signed_at, u.challenge_started_at, p.diet_type, p.challenge_level, p.eat_times, p.known_from, p.baseline, p.purpose, ps.level, ps.current_xp, ps.accumulated_xp, ps.stage, ps.mood, ps.strikes, ps.poisoned_until, gb.balance as gems, gb.total_earned, mc.card_count, mc.fragment_count FROM users u LEFT JOIN user_profiles p ON p.user_id = u.id LEFT JOIN pet_states ps ON ps.user_id = u.id LEFT JOIN gem_balances gb ON gb.user_id = u.id LEFT JOIN makeup_cards mc ON mc.user_id = u.id WHERE u.id = :user_id
```

- [ ] **Step 3: Verify RPCs return the new column**

Use drust MCP `call_rpc` for `profile_for_user` with `{user_id: 4}`. Expect `purpose` in `column_names` (value null).

- [ ] **Step 4: Run typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. Existing test fixtures that construct UserProfile / UserFull need `purpose` added — fix any failures here.

- [ ] **Step 5: Run tests**

Run: `npx vitest run`
Expected: all pass. If a UserFull literal in `day-30.test.ts` / `makeup.test.ts` fails type-check, add `purpose: null` to the literal.

- [ ] **Step 6: Commit**

```bash
git add src/api/profile.ts src/routes/__tests__/day-30.test.ts src/routes/tasks/__tests__/makeup.test.ts
git commit -m "feat(api): expose user_profiles.purpose through profile RPCs"
```

---

## Task 4: New `/onboarding/purpose` route

**Files:**
- Create: `src/routes/onboarding/purpose.ts`
- Create: `src/routes/onboarding/__tests__/purpose.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/routes/onboarding/__tests__/purpose.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/router', () => ({ navigate: vi.fn() }));
vi.mock('@/api/profile', () => ({
  updateProfile: vi.fn().mockResolvedValue(undefined),
}));

import purpose from '../purpose';
import * as router from '@/router';
import * as profileApi from '@/api/profile';
import { $user } from '@/store/user';

const mockedRouter = router as unknown as { navigate: ReturnType<typeof vi.fn> };
const mockedProfile = profileApi as unknown as {
  updateProfile: ReturnType<typeof vi.fn>;
};

describe('onboarding/purpose', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    $user.set({ id: 7, username: 'k', displayName: 'k' });
  });

  it('renders 3 purpose options + Skip', () => {
    const el = purpose();
    expect(el.querySelectorAll('.choice').length).toBe(3);
    expect(el.querySelector('#skip-btn')).not.toBeNull();
  });

  it('shows progress 4/8', () => {
    const el = purpose();
    expect(el.querySelectorAll('.onb-progress-dot').length).toBe(8);
    expect(el.querySelectorAll('.onb-progress-dot.done').length).toBe(4);
  });

  it('clicking a purpose updates profile and advances to /onboarding/challenge-level', async () => {
    const el = purpose();
    const btn = el.querySelector<HTMLButtonElement>('.choice[data-value="environment"]');
    btn?.click();
    await Promise.resolve();
    expect(mockedProfile.updateProfile).toHaveBeenCalledWith(7, { purpose: 'environment' });
    await Promise.resolve();
    expect(mockedRouter.navigate).toHaveBeenCalledWith('/onboarding/challenge-level');
  });

  it('Skip advances without writing profile', () => {
    const el = purpose();
    el.querySelector<HTMLButtonElement>('#skip-btn')?.click();
    expect(mockedProfile.updateProfile).not.toHaveBeenCalled();
    expect(mockedRouter.navigate).toHaveBeenCalledWith('/onboarding/challenge-level');
  });
});
```

- [ ] **Step 2: Run test (expect import-fail)**

Run: `npx vitest run src/routes/onboarding/__tests__/purpose.test.ts`
Expected: FAIL — `Cannot find module '../purpose'`.

- [ ] **Step 3: Create the route**

Create `src/routes/onboarding/purpose.ts`:

```ts
/**
 * Onboarding step 4 — Challenge purpose.
 *
 * Body management / Environment protection / Make a vow / Skip.
 * Tap → updateProfile({ purpose }) → /onboarding/challenge-level.
 */
import { navigate } from '@/router';
import { $user } from '@/store/user';
import { updateProfile } from '@/api/profile';
import { createProgress } from '@/components/Progress';

const OPTIONS = [
  { value: 'body',         emoji: '🏃', label: 'Body management 健康管理' },
  { value: 'environment',  emoji: '🌱', label: 'Environment protection 環保' },
  { value: 'vow',          emoji: '🙏', label: 'Make a vow 發願' },
];

export default function purpose(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'onb-screen';
  wrap.innerHTML = `
    <div class="onb-header">
      <div class="onb-back" id="back-btn"><span class="ms">arrow_back</span></div>
      ${createProgress(4, 8).outerHTML}
    </div>
    <div class="onb-body">
      <h1 class="onb-title text-h2">參加挑戰的目的</h1>
      <p class="onb-sub text-mini">挑戰的方向會影響每日的提示文字</p>
      <div class="onb-options">
        ${OPTIONS.map((o) => `
          <button class="choice" data-value="${o.value}">
            <span class="ch-icon">${o.emoji}</span>
            <span class="ch-text">${o.label}</span>
            <span class="ms ch-arrow">arrow_forward</span>
          </button>
        `).join('')}
      </div>
      <div class="grow"></div>
      <button class="btn-skip" id="skip-btn">Skip</button>
    </div>
  `;

  wrap.querySelector('#back-btn')?.addEventListener('click', () => navigate('/onboarding/baseline'));
  wrap.querySelector('#skip-btn')?.addEventListener('click', () => navigate('/onboarding/challenge-level'));

  wrap.querySelectorAll<HTMLButtonElement>('.choice').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const value = btn.dataset.value!;
      const u = $user.get();
      if (u) {
        try { await updateProfile(u.id, { purpose: value }); } catch { /* soft fail */ }
      }
      navigate('/onboarding/challenge-level');
    });
  });

  return wrap;
}
```

- [ ] **Step 4: Run tests, expect pass**

Run: `npx vitest run src/routes/onboarding/__tests__/purpose.test.ts`
Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/routes/onboarding/purpose.ts src/routes/onboarding/__tests__/purpose.test.ts
git commit -m "feat(onboarding): purpose step (Body/Environment/Vow)"
```

---

## Task 5: New `/onboarding/known-from` route

**Files:**
- Create: `src/routes/onboarding/known-from.ts`
- Create: `src/routes/onboarding/__tests__/known-from.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/routes/onboarding/__tests__/known-from.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/router', () => ({ navigate: vi.fn() }));
vi.mock('@/api/profile', () => ({
  updateProfile: vi.fn().mockResolvedValue(undefined),
}));

import knownFrom from '../known-from';
import * as router from '@/router';
import * as profileApi from '@/api/profile';
import { $user } from '@/store/user';

const mockedRouter = router as unknown as { navigate: ReturnType<typeof vi.fn> };
const mockedProfile = profileApi as unknown as {
  updateProfile: ReturnType<typeof vi.fn>;
};

describe('onboarding/known-from', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    $user.set({ id: 7, username: 'k', displayName: 'k' });
  });

  it('renders 4 source options + Skip', () => {
    const el = knownFrom();
    expect(el.querySelectorAll('.choice').length).toBe(4);
    expect(el.querySelector('#skip-btn')).not.toBeNull();
  });

  it('shows progress 7/8', () => {
    const el = knownFrom();
    expect(el.querySelectorAll('.onb-progress-dot.done').length).toBe(7);
  });

  it('clicking a source updates profile and advances to /onboarding/day1-hook', async () => {
    const el = knownFrom();
    el.querySelector<HTMLButtonElement>('.choice[data-value="instagram"]')?.click();
    await Promise.resolve();
    expect(mockedProfile.updateProfile).toHaveBeenCalledWith(7, { known_from: 'instagram' });
    expect(mockedRouter.navigate).toHaveBeenCalledWith('/onboarding/day1-hook');
  });

  it('Skip advances without writing profile', () => {
    const el = knownFrom();
    el.querySelector<HTMLButtonElement>('#skip-btn')?.click();
    expect(mockedProfile.updateProfile).not.toHaveBeenCalled();
    expect(mockedRouter.navigate).toHaveBeenCalledWith('/onboarding/day1-hook');
  });
});
```

- [ ] **Step 2: Run, expect import-fail**

Run: `npx vitest run src/routes/onboarding/__tests__/known-from.test.ts`
Expected: FAIL.

- [ ] **Step 3: Create the route**

Create `src/routes/onboarding/known-from.ts`:

```ts
/**
 * Onboarding step 7 — Acquisition source.
 *
 * Facebook / Instagram / Threads / 親友分享 / Skip.
 * Tap → updateProfile({ known_from }) → /onboarding/day1-hook.
 */
import { navigate } from '@/router';
import { $user } from '@/store/user';
import { updateProfile } from '@/api/profile';
import { createProgress } from '@/components/Progress';

const OPTIONS = [
  { value: 'facebook',  emoji: '📘', label: 'Facebook' },
  { value: 'instagram', emoji: '📷', label: 'Instagram' },
  { value: 'threads',   emoji: '🧵', label: 'Threads' },
  { value: 'friend',    emoji: '🤝', label: '親友分享' },
];

export default function knownFrom(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'onb-screen';
  wrap.innerHTML = `
    <div class="onb-header">
      <div class="onb-back" id="back-btn"><span class="ms">arrow_back</span></div>
      ${createProgress(7, 8).outerHTML}
    </div>
    <div class="onb-body">
      <h1 class="onb-title text-h2">如何得知這個 App？</h1>
      <p class="onb-sub text-mini">幫我們知道你從哪裡來</p>
      <div class="onb-options">
        ${OPTIONS.map((o) => `
          <button class="choice" data-value="${o.value}">
            <span class="ch-icon">${o.emoji}</span>
            <span class="ch-text">${o.label}</span>
            <span class="ms ch-arrow">arrow_forward</span>
          </button>
        `).join('')}
      </div>
      <div class="grow"></div>
      <button class="btn-skip" id="skip-btn">Skip</button>
    </div>
  `;

  wrap.querySelector('#back-btn')?.addEventListener('click', () => navigate('/onboarding/eat-times'));
  wrap.querySelector('#skip-btn')?.addEventListener('click', () => navigate('/onboarding/day1-hook'));

  wrap.querySelectorAll<HTMLButtonElement>('.choice').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const value = btn.dataset.value!;
      const u = $user.get();
      if (u) {
        try { await updateProfile(u.id, { known_from: value }); } catch { /* soft fail */ }
      }
      navigate('/onboarding/day1-hook');
    });
  });

  return wrap;
}
```

- [ ] **Step 4: Run tests, expect pass**

Run: `npx vitest run src/routes/onboarding/__tests__/known-from.test.ts`
Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/routes/onboarding/known-from.ts src/routes/onboarding/__tests__/known-from.test.ts
git commit -m "feat(onboarding): known-from step (FB/IG/Threads/親友分享)"
```

---

## Task 6: Wire onboarding 6→8 step flow

**Files:**
- Modify: `src/main.ts`
- Modify: `src/routes/onboarding/baseline.ts`
- Modify: `src/routes/onboarding/challenge-level.ts`
- Modify: `src/routes/onboarding/eat-times.ts`
- Modify: `src/routes/onboarding/day1-hook.ts`
- Modify: `src/routes/__tests__/onboarding-baseline.test.ts` (if it asserts navigation target)
- Modify: `src/routes/__tests__/onboarding-challenge-level.test.ts`
- Modify: `src/routes/__tests__/onboarding-eat-times.test.ts`
- Modify: `src/routes/__tests__/onboarding-day1-hook.test.ts`

- [ ] **Step 1: Register the two new routes**

In `src/main.ts`, after the existing onboarding `defRoute` calls, add:

```ts
defRoute('/onboarding/purpose', wrap(() => import('./routes/onboarding/purpose')));
defRoute('/onboarding/known-from', wrap(() => import('./routes/onboarding/known-from')));
```

- [ ] **Step 2: Update `baseline.ts` to navigate to `/onboarding/purpose`**

In `src/routes/onboarding/baseline.ts`, find the `navigate('/onboarding/challenge-level')` (after profile patch) and replace with `navigate('/onboarding/purpose')`.

- [ ] **Step 3: Update `challenge-level.ts` back button + progress**

In `src/routes/onboarding/challenge-level.ts`:
- Change `createProgress(4, 6)` → `createProgress(5, 8)`
- Change back-btn navigate target from `/onboarding/baseline` → `/onboarding/purpose`

- [ ] **Step 4: Update `eat-times.ts` next + progress**

In `src/routes/onboarding/eat-times.ts`:
- Change `createProgress(5, 6)` → `createProgress(6, 8)`
- Change continue-btn navigate target from `/onboarding/day1-hook` → `/onboarding/known-from`

- [ ] **Step 5: Update `day1-hook.ts` progress**

In `src/routes/onboarding/day1-hook.ts`, change `createProgress(6, 6)` → `createProgress(8, 8)`.

- [ ] **Step 6: Also update earlier onboarding pages' progress totals**

Walk through each existing onboarding route and bump the second arg of `createProgress` to 8:

- `src/routes/onboarding/oath.ts`           — `createProgress(1, 6)` → `createProgress(1, 8)`
- `src/routes/onboarding/diet-survey.ts`    — `createProgress(2, 6)` → `createProgress(2, 8)`
- `src/routes/onboarding/baseline.ts`       — `createProgress(3, 6)` → `createProgress(3, 8)`

- [ ] **Step 7: Update onboarding tests that assert progress totals**

Each existing onboarding test that does
```ts
expect(el.querySelectorAll('.onb-progress-dot').length).toBe(6);
```
becomes
```ts
expect(el.querySelectorAll('.onb-progress-dot').length).toBe(8);
```

Likely sites: `onboarding-oath.test.ts`, `onboarding-diet-survey.test.ts`, `onboarding-baseline.test.ts`, `onboarding-challenge-level.test.ts`, `onboarding-eat-times.test.ts`, `onboarding-day1-hook.test.ts`.

Also update any tests that assert `expect(navigate).toHaveBeenCalledWith('/onboarding/...')` for routes whose next target changed (baseline → purpose, eat-times → known-from).

- [ ] **Step 8: Run all tests**

Run: `npx vitest run --reporter=default`
Expected: all pass.

- [ ] **Step 9: Run dev server and walk through onboarding manually**

Run: `npm run dev` (background)
- Register a brand-new user
- Walk through all 8 steps, confirm progress bar shows X/8 at each step
- Confirm purpose + known_from end up in drust via `call_rpc('profile_for_user', { user_id: <new> })`

- [ ] **Step 10: Commit**

```bash
git add src/main.ts src/routes/onboarding/ src/routes/__tests__/
git commit -m "feat(onboarding): wire 6→8 step flow with new purpose + known-from screens"
```

---

## Task 7: Day-1 hook upgrade — diet-typed egg + rule readout

**Files:**
- Modify: `src/routes/onboarding/day1-hook.ts`
- Modify: `src/routes/__tests__/onboarding-day1-hook.test.ts`
- Modify: `src/styles/globals.css`

- [ ] **Step 1: Update the test for the new content**

In `src/routes/__tests__/onboarding-day1-hook.test.ts`, replace the "renders" test with content assertions that depend on `$profile`:

```ts
import { $profile } from '@/store/user';

beforeEach(() => {
  vi.clearAllMocks();
  $user.set({ id: 7, username: 'k', displayName: 'k' });
  $profile.set({
    id: 7, username: 'k', display_name: 'k',
    oath_signed_at: null, challenge_started_at: null,
    diet_type: 'vegan', challenge_level: 2,
    eat_times: null, known_from: null, baseline: null, purpose: 'environment',
    level: 1, current_xp: 0, accumulated_xp: 0, stage: 'egg', mood: 'normal',
    strikes: 0, poisoned_until: null,
    gems: 0, total_earned: 0, card_count: 0, fragment_count: 0,
  });
});

it('shows diet-typed egg + level rule + purpose line', () => {
  const el = day1Hook();
  expect(el.querySelector('.day1-egg')?.getAttribute('data-tint')).toBe('vegan');
  expect(el.textContent).toContain('三餐無肉，3 次容錯');
  expect(el.textContent).toContain('每替代一公斤肉');
});

it('falls back to neutral content when profile is incomplete', () => {
  $profile.set(null);
  const el = day1Hook();
  expect(el.querySelector('.day1-egg')?.getAttribute('data-tint')).toBe('neutral');
});
```

- [ ] **Step 2: Run test, expect fail**

Run: `npx vitest run src/routes/__tests__/onboarding-day1-hook.test.ts`
Expected: assertions about `data-tint`, `三餐無肉`, `每替代` fail.

- [ ] **Step 3: Implement upgraded day-1 hook**

Replace the body of `src/routes/onboarding/day1-hook.ts`:

```ts
/**
 * Onboarding step 8 — Day-1 hook.
 *
 * Final scene: tinted egg keyed by diet_type, challenge rule keyed by
 * challenge_level, purpose line keyed by user_profiles.purpose. The CTA
 * stamps users.challenge_started_at via drust and routes to /check-in.
 */
import { navigate } from '@/router';
import { createProgress } from '@/components/Progress';
import { setChallengeStartedAt } from '@/store/ui';
import { $user, $profile } from '@/store/user';

const LEVEL_RULES: Record<number, string> = {
  1: '每天 1 餐無肉就算達標',
  2: '三餐無肉，3 次容錯機會',
  3: '三餐無肉，零容錯，極限意志力',
};

const PURPOSE_LINES: Record<string, string> = {
  body: '為了照顧自己的身體，從一餐開始。',
  environment: '每替代一公斤肉，地球少燒 60 kg CO₂。',
  vow: '每一餐都是寫給未來的承諾。',
};

const DIET_TINT: Record<string, string> = {
  vegan: 'vegan',
  vegetarian: 'vegetarian',
  flexitarian: 'flexitarian',
  omnivore: 'omnivore',
};

export default function day1Hook(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'onb-screen day1';
  const p = $profile.get();
  const tint = (p?.diet_type && DIET_TINT[p.diet_type]) ?? 'neutral';
  const ruleLine = LEVEL_RULES[p?.challenge_level ?? 0] ?? '依你選擇的步調挑戰 30 天。';
  const purposeLine = PURPOSE_LINES[p?.purpose ?? ''] ?? '跟著精靈一起探索蔬食。';

  wrap.innerHTML = `
    <div class="onb-header">
      ${createProgress(8, 8).outerHTML}
    </div>
    <div class="day1-body">
      <div class="fog-overlay"></div>
      <div class="day1-egg" data-tint="${tint}">🥚</div>
      <div class="day1-content">
        <h1 class="day1-title">你獲得了一顆守護者蛋</h1>
        <ul class="day1-rules">
          <li>📅 30 天連續挑戰</li>
          <li>🥗 ${ruleLine}</li>
          <li>🎯 ${purposeLine}</li>
        </ul>
        <p class="day1-text">
          灰霧濃重，蛋殼裡的精靈正等待你<br/>
          請立即開始你的第一次打卡！
        </p>
        <button class="btn text-btn-m btn-primary btn-l text-btn-l" id="enter-btn">
          <span class="ms">photo_camera</span>
          開始打卡
        </button>
      </div>
    </div>
  `;

  wrap.querySelector('#enter-btn')?.addEventListener('click', () => {
    const u = $user.get();
    if (u) void setChallengeStartedAt(u.id);
    navigate('/check-in');
  });

  return wrap;
}
```

- [ ] **Step 4: Add tints + breathing keyframe to `globals.css`**

Append after the existing `.day1-` rules:

```css
.day1-egg {
  font-size: 96px;
  animation: day1-breathe 4s ease-in-out infinite;
  filter: drop-shadow(0 4px 12px rgba(0,0,0,0.15));
  transition: filter 0.4s ease;
}
.day1-egg[data-tint="vegan"]       { filter: hue-rotate(0deg)   saturate(1.1) drop-shadow(0 4px 16px rgba(34,197,94,0.4)); }
.day1-egg[data-tint="vegetarian"]  { filter: hue-rotate(330deg) saturate(0.9) drop-shadow(0 4px 16px rgba(244,114,182,0.4)); }
.day1-egg[data-tint="flexitarian"] { filter: hue-rotate(50deg)  saturate(1.0) drop-shadow(0 4px 16px rgba(250,204,21,0.4)); }
.day1-egg[data-tint="omnivore"]    { filter: hue-rotate(0deg)   saturate(0.8) drop-shadow(0 4px 16px rgba(239,68,68,0.4)); }
.day1-egg[data-tint="neutral"]     { filter: grayscale(0.4) drop-shadow(0 4px 12px rgba(0,0,0,0.15)); }
@keyframes day1-breathe {
  0%, 100% { transform: scale(1); }
  50%      { transform: scale(1.04); }
}
.day1-rules {
  list-style: none; padding: 0; margin: var(--space-3) 0;
  display: flex; flex-direction: column; gap: var(--space-2);
  font-size: var(--text-mini-size); color: var(--color-foreground-alt);
  text-align: left; max-width: 280px;
}
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run src/routes/__tests__/onboarding-day1-hook.test.ts`
Expected: pass.

- [ ] **Step 6: Run full suite**

Run: `npx vitest run`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/routes/onboarding/day1-hook.ts src/routes/__tests__/onboarding-day1-hook.test.ts src/styles/globals.css
git commit -m "feat(onboarding): day-1 hook reads diet/level/purpose for tinted egg + rule readout"
```

---

## Task 8: New `/check-in/fail` route

**Files:**
- Create: `src/routes/check-in/fail.ts`
- Create: `src/routes/check-in/__tests__/fail.test.ts`
- Modify: `src/main.ts`
- Modify: `src/styles/globals.css`

- [ ] **Step 1: Write the failing test**

Create `src/routes/check-in/__tests__/fail.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/router', () => ({ navigate: vi.fn() }));

import fail from '../fail';
import * as router from '@/router';
import { $today } from '@/store/today';
import { $checkin, setMealIndex } from '@/store/checkin';

const mockedRouter = router as unknown as { navigate: ReturnType<typeof vi.fn> };

describe('check-in/fail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    $today.set({ dayNumber: 5, totalXpToday: 0, missionsDone: [], luckyColor: '' });
    $checkin.set({
      imageDataUrl: null, items: [], scan: null, lastResult: null,
      mealIndex: 2, veganType: null, wasMeatReplaced: false,
    });
  });

  it('renders fail copy, Try Again, and 回首頁 buttons', () => {
    const el = fail();
    expect(el.textContent).toContain('蔬食餐不能有肉');
    expect(el.querySelector('#try-again')).not.toBeNull();
    expect(el.querySelector('#go-home')).not.toBeNull();
  });

  it('writes meal_fail mission for the current meal slot on mount', () => {
    fail();
    expect($today.get().missionsDone).toContain('meal_fail:lunch');
  });

  it('Try Again navigates to /check-in', () => {
    const el = fail();
    el.querySelector<HTMLButtonElement>('#try-again')?.click();
    expect(mockedRouter.navigate).toHaveBeenCalledWith('/check-in');
  });

  it('回首頁 navigates to /home', () => {
    const el = fail();
    el.querySelector<HTMLButtonElement>('#go-home')?.click();
    expect(mockedRouter.navigate).toHaveBeenCalledWith('/home');
  });

  it('handles meal_index 1 / 3 too', () => {
    setMealIndex(1);
    fail();
    expect($today.get().missionsDone).toContain('meal_fail:breakfast');
  });
});
```

- [ ] **Step 2: Run, expect import-fail**

Run: `npx vitest run src/routes/check-in/__tests__/fail.test.ts`
Expected: FAIL.

- [ ] **Step 3: Create `src/routes/check-in/fail.ts`**

```ts
/**
 * Check-in failure screen — shown when the user confirms 是 to "這是肉嗎".
 *
 * Records meal_fail:{slot} into daily_progress so /profile can later
 * surface 容錯次數. Try Again returns to /check-in (resetting the draft);
 * 回首頁 backs out entirely.
 */
import { navigate } from '@/router';
import { resetCheckin, $checkin } from '@/store/checkin';
import { markMissionDone } from '@/store/today';

const MEAL_SLOT: Record<number, string> = {
  1: 'breakfast',
  2: 'lunch',
  3: 'dinner',
};

export default function fail(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'checkin-screen checkin-fail';
  wrap.innerHTML = `
    <div class="fail-body">
      <div class="fail-emoji" aria-hidden="true">🍖🚫</div>
      <h1 class="fail-title">蔬食餐不能有肉</h1>
      <p class="fail-text">嗚嗚嗚嗚嗚⋯⋯<br/>下一餐記得不能吃肉哦～</p>
      <div class="fail-actions">
        <button class="btn text-btn-m btn-secondary btn-l text-btn-l" id="try-again">Try Again</button>
        <button class="btn text-btn-m btn-primary btn-l text-btn-l" id="go-home">回首頁</button>
      </div>
    </div>
  `;

  const slot = MEAL_SLOT[$checkin.get().mealIndex] ?? 'lunch';
  markMissionDone(`meal_fail:${slot}`, 0);

  wrap.querySelector('#try-again')?.addEventListener('click', () => {
    resetCheckin();
    navigate('/check-in');
  });
  wrap.querySelector('#go-home')?.addEventListener('click', () => {
    resetCheckin();
    navigate('/home');
  });

  return wrap;
}
```

- [ ] **Step 4: Register the route in `src/main.ts`**

Add (after other check-in routes):

```ts
defRoute('/check-in/fail', wrap(() => import('./routes/check-in/fail')));
```

- [ ] **Step 5: Add styles in `globals.css`**

Append:

```css
.checkin-fail {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  min-height: 70vh; padding: var(--space-6) var(--space-4); gap: var(--space-4);
}
.fail-emoji { font-size: 64px; }
.fail-title { font-size: var(--text-h2-size); font-weight: var(--font-weight-black); color: var(--color-error, #d63b3b); margin: 0; }
.fail-text  { font-size: var(--text-mini-size); color: var(--color-foreground-alt); text-align: center; line-height: 1.7; }
.fail-actions { display: flex; gap: var(--space-3); width: 100%; max-width: 360px; }
.fail-actions .btn { flex: 1; }
```

- [ ] **Step 6: Run tests, expect pass**

Run: `npx vitest run src/routes/check-in/__tests__/fail.test.ts`
Expected: 5 tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/routes/check-in/fail.ts src/routes/check-in/__tests__/fail.test.ts src/main.ts src/styles/globals.css
git commit -m "feat(check-in): /check-in/fail screen + meal_fail mission key"
```

---

## Task 9: result.ts — fail redirect + lucky:hit mark

**Files:**
- Modify: `src/routes/check-in/result.ts`
- Modify: `src/routes/check-in/__tests__/result.test.ts` (if asserting alert)

- [ ] **Step 1: Replace `alert()` with route navigation**

In `src/routes/check-in/result.ts`, find the `meat-yes` handler:

```ts
wrap.querySelector('#meat-yes')?.addEventListener('click', () => {
  resetCheckin();
  alert('今天的挑戰失敗了，明天再加油！');
  navigate('/home');
});
```

Replace with:

```ts
wrap.querySelector('#meat-yes')?.addEventListener('click', () => {
  navigate('/check-in/fail');
});
```

(Don't `resetCheckin()` here — fail screen needs `mealIndex` to record the right slot, and resets draft itself on its handlers.)

- [ ] **Step 2: Add lucky:hit mark in submit path**

In `src/routes/check-in/result.ts`, find `submitCheckin` and after the existing `markMissionDone(...)` line:

```ts
markMissionDone(`meal:${d.mealIndex === 1 ? 'breakfast' : d.mealIndex === 2 ? 'lunch' : 'dinner'}`, xp);
```

Add:

```ts
if (luckyMatch) {
  markMissionDone('lucky:hit', 0);
}
```

- [ ] **Step 3: Update or add a test asserting the new behaviour**

In `src/routes/check-in/__tests__/result.test.ts`, add a test (mock `markMissionDone` or read `$today` after calling):

```ts
it('marks lucky:hit when palette matches today luckyColor', async () => {
  // setup: $today.luckyColor = 'red', items contain a red food
  // ...trigger confirm-btn click...
  await vi.waitFor(() => expect($today.get().missionsDone).toContain('lucky:hit'));
});

it('navigates to /check-in/fail when user confirms meat', () => {
  // setup: scan contains a meat item
  // ...click meat-yes...
  expect(mockedRouter.navigate).toHaveBeenCalledWith('/check-in/fail');
});
```

(Existing test file already mocks router and stores; mirror the existing patterns.)

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/routes/check-in/__tests__/result.test.ts`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add src/routes/check-in/result.ts src/routes/check-in/__tests__/result.test.ts
git commit -m "feat(check-in): meat-fail routes to /check-in/fail; lucky:hit mission persists"
```

---

## Task 10: success.ts — 3-act animation + Share button

**Files:**
- Modify: `src/routes/check-in/success.ts`
- Modify: `src/routes/check-in/__tests__/success.test.ts`
- Modify: `src/styles/globals.css`

- [ ] **Step 1: Write the failing test**

Replace / extend `src/routes/check-in/__tests__/success.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/router', () => ({ navigate: vi.fn() }));

import success from '../success';
import * as router from '@/router';
import { $checkin, setLastResult } from '@/store/checkin';
import { $today } from '@/store/today';

const mockedRouter = router as unknown as { navigate: ReturnType<typeof vi.fn> };

describe('check-in/success', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    $today.set({ dayNumber: 5, totalXpToday: 20, missionsDone: ['meal:lunch'], luckyColor: '' });
    setLastResult({ xpEarned: 20, luckyColorMatched: false, fogReductionPct: 3 });
  });

  it('renders xp burst, progress, and pet/fog acts', () => {
    const el = success();
    expect(el.querySelector('.xp-burst')).not.toBeNull();
    expect(el.querySelector('.success-progress')).not.toBeNull();
    expect(el.querySelector('.success-pet')).not.toBeNull();
  });

  it('progresses through act-1 → act-2 → act-3 classes', () => {
    const el = success();
    expect(el.classList.contains('act-1')).toBe(true);
    vi.advanceTimersByTime(1100);
    expect(el.classList.contains('act-2')).toBe(true);
    vi.advanceTimersByTime(1000);
    expect(el.classList.contains('act-3')).toBe(true);
    vi.advanceTimersByTime(1000);
    expect(el.classList.contains('settled')).toBe(true);
  });

  it('clicking the body before settled jumps to settled', () => {
    const el = success();
    el.querySelector<HTMLElement>('.success-body')?.click();
    expect(el.classList.contains('settled')).toBe(true);
  });

  it('renders Share + Continue when settled', () => {
    const el = success();
    vi.advanceTimersByTime(3500);
    expect(el.querySelector('#share')).not.toBeNull();
    expect(el.querySelector('#next')).not.toBeNull();
  });

  it('Share button copies summary on click (clipboard fallback)', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    const el = success();
    vi.advanceTimersByTime(3500);
    el.querySelector<HTMLButtonElement>('#share')?.click();
    await vi.waitFor(() => expect(writeText).toHaveBeenCalled());
  });
});
```

- [ ] **Step 2: Run, expect failures**

Run: `npx vitest run src/routes/check-in/__tests__/success.test.ts`
Expected: missing `.success-progress`, missing act classes, no `#share`.

- [ ] **Step 3: Re-author `success.ts`**

Replace the file:

```ts
/**
 * Check-in step 4 — celebration.
 *
 * Three sequenced acts:
 *   ACT 1 (0–1000ms): +XP burst floats up from the pet
 *   ACT 2 (1000–2000ms): 30-day progress fills up to today
 *   ACT 3 (2000–3000ms): pet absorbs the energy, fog clears by fog_pct
 *
 * Tap anywhere before ACT 3 settles → jump to settled state. Then the
 * Continue + Share buttons appear at the bottom.
 */
import { navigate } from '@/router';
import { $checkin, resetCheckin } from '@/store/checkin';
import { $today } from '@/store/today';

const MEAL_LABEL: Record<number, string> = { 1: '早餐', 2: '午餐', 3: '晚餐' };

export default function success(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'checkin-screen checkin-success act-1';
  const r = $checkin.get().lastResult;
  if (!r) {
    wrap.innerHTML = `
      <div class="checkin-body checkin-fallback">
        <p>沒有可顯示的打卡結果。</p>
        <button class="btn text-btn-m btn-primary btn-l text-btn-l" id="back">回首頁</button>
      </div>
    `;
    wrap.querySelector('#back')?.addEventListener('click', () => navigate('/home'));
    return wrap;
  }

  const replaced = $checkin.get().wasMeatReplaced;
  const today = $today.get().dayNumber;
  const segments = Array.from({ length: 30 }, (_, i) => i + 1)
    .map((d) => `<span class="seg ${d <= today ? 'fill' : ''} ${d === today ? 'now' : ''}"></span>`)
    .join('');

  wrap.innerHTML = `
    <div class="success-body">
      <div class="xp-burst" aria-hidden="true">
        <span class="xp-bubble xp-1">+${r.xpEarned} XP</span>
        ${r.luckyColorMatched ? '<span class="xp-bubble xp-2">幸運色 +15 XP</span>' : ''}
        ${replaced ? '<span class="xp-bubble xp-3">替代為植物肉</span>' : ''}
      </div>
      <div class="success-progress" aria-label="30-day progress">${segments}</div>
      <div class="success-pet">🐸</div>
      <h1 class="success-title">打卡成功！</h1>
      <p class="success-text">
        守護者吸收了 <strong>${r.xpEarned} XP</strong> 的真實能量。<br/>
        灰霧消散 <strong>${r.fogReductionPct}%</strong>。
      </p>
      <div class="success-actions">
        <button class="btn text-btn-m btn-secondary btn-l text-btn-l" id="share">
          <span class="ms">share</span>分享成果
        </button>
        <button class="btn text-btn-m btn-primary btn-l text-btn-l" id="next">繼續守護</button>
      </div>
    </div>
  `;

  const acts = [
    { ms: 1000, cls: 'act-2' },
    { ms: 2000, cls: 'act-3' },
    { ms: 3000, cls: 'settled' },
  ];
  const timers: number[] = [];
  for (const { ms, cls } of acts) {
    timers.push(window.setTimeout(() => {
      wrap.classList.remove('act-1', 'act-2', 'act-3');
      wrap.classList.add(cls);
    }, ms));
  }

  function settle() {
    timers.forEach(window.clearTimeout);
    wrap.classList.remove('act-1', 'act-2', 'act-3');
    wrap.classList.add('settled');
  }
  wrap.querySelector('.success-body')?.addEventListener('click', settle, { once: true });

  wrap.querySelector('#next')?.addEventListener('click', () => {
    timers.forEach(window.clearTimeout);
    resetCheckin();
    navigate('/home');
  });

  wrap.querySelector('#share')?.addEventListener('click', () => {
    void shareSummary(today, r.xpEarned, r.luckyColorMatched);
  });

  return wrap;
}

async function shareSummary(day: number, xp: number, lucky: boolean): Promise<void> {
  const meal = MEAL_LABEL[$checkin.get().mealIndex] ?? '一餐';
  const text = `我在 Yummi Go 完成第 D${day} 天 ${meal} +${xp} XP${lucky ? ' 🍀' : ''}`;
  try {
    if (navigator.share) {
      await navigator.share({ title: 'Yummi Go', text });
      return;
    }
  } catch {
    /* user cancel — fall through */
  }
  if (navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text);
      window.alert('已複製到剪貼簿');
      return;
    } catch {
      /* fall through */
    }
  }
  window.alert(text);
}
```

- [ ] **Step 4: Add act CSS**

In `src/styles/globals.css`, append (or replace existing `.success-` rules):

```css
.checkin-success .success-body { cursor: pointer; }
.checkin-success.act-1 .success-progress,
.checkin-success.act-1 .success-pet,
.checkin-success.act-1 .success-title,
.checkin-success.act-1 .success-text,
.checkin-success.act-1 .success-actions { opacity: 0; transform: translateY(8px); }
.checkin-success.act-2 .success-progress { opacity: 1; transform: translateY(0); transition: 0.5s ease; }
.checkin-success.act-2 .success-pet,
.checkin-success.act-2 .success-title,
.checkin-success.act-2 .success-text,
.checkin-success.act-2 .success-actions { opacity: 0; }
.checkin-success.act-3 .success-pet,
.checkin-success.act-3 .success-title,
.checkin-success.act-3 .success-text { opacity: 1; transform: translateY(0); transition: 0.5s ease; animation: pet-glow 1.6s ease-in-out; }
.checkin-success.act-3 .success-actions { opacity: 0; }
.checkin-success.settled .success-progress,
.checkin-success.settled .success-pet,
.checkin-success.settled .success-title,
.checkin-success.settled .success-text,
.checkin-success.settled .success-actions { opacity: 1; transform: translateY(0); transition: 0.4s ease; }

.success-progress {
  display: grid; grid-template-columns: repeat(30, 1fr); gap: 2px; width: 100%; max-width: 360px;
}
.success-progress .seg {
  height: 6px; border-radius: 3px; background: var(--color-neutral-light-active);
}
.success-progress .seg.fill { background: var(--color-primary); }
.success-progress .seg.now  { background: var(--color-secondary); transform: scaleY(1.6); }

@keyframes pet-glow {
  0% { filter: drop-shadow(0 0 0 rgba(34,197,94,0)); }
  50% { filter: drop-shadow(0 0 18px rgba(34,197,94,0.6)); }
  100% { filter: drop-shadow(0 0 0 rgba(34,197,94,0)); }
}

.success-actions { display: flex; gap: var(--space-3); width: 100%; max-width: 360px; }
.success-actions .btn { flex: 1; }
```

- [ ] **Step 5: Run tests, expect pass**

Run: `npx vitest run src/routes/check-in/__tests__/success.test.ts`
Expected: 5 pass.

- [ ] **Step 6: Commit**

```bash
git add src/routes/check-in/success.ts src/routes/check-in/__tests__/success.test.ts src/styles/globals.css
git commit -m "feat(check-in): 3-act success animation + Share button"
```

---

## Task 11: Home lucky-card hit indicator

**Files:**
- Modify: `src/routes/home.ts`
- Modify: `src/routes/__tests__/home.test.ts`
- Modify: `src/styles/globals.css`

- [ ] **Step 1: Write the failing test**

Append to `src/routes/__tests__/home.test.ts`:

```ts
it('lucky-card flips to "已命中" state when missionsDone includes lucky:hit', () => {
  const el = home();
  document.body.appendChild(el);
  $today.set({ dayNumber: 1, totalXpToday: 35, missionsDone: ['lucky:hit'], luckyColor: 'red' });
  const card = el.querySelector<HTMLElement>('#lucky-card')!;
  expect(card.classList.contains('hit')).toBe(true);
  expect(card.querySelector('[data-bind="lucky-status"]')?.textContent).toContain('已命中');
  el.remove();
});
```

- [ ] **Step 2: Run, expect fail**

Run: `npx vitest run src/routes/__tests__/home.test.ts`
Expected: missing `.hit` class.

- [ ] **Step 3: Modify home.ts**

In `src/routes/home.ts`, find the `lucky-card` HTML:

```html
<section class="lucky-card" id="lucky-card" role="button" tabindex="0">
  <div class="lucky-card-emoji" data-bind="lucky-emoji">🎨</div>
  <div class="lucky-card-body">
    <div class="lucky-card-title">今日幸運色</div>
    <div class="lucky-card-color" data-bind="lucky-label">未設定</div>
  </div>
  <span class="ms lucky-card-arrow">arrow_forward</span>
</section>
```

Replace with:

```html
<section class="lucky-card" id="lucky-card" role="button" tabindex="0">
  <div class="lucky-card-emoji" data-bind="lucky-emoji">🎨</div>
  <div class="lucky-card-body">
    <div class="lucky-card-title">今日幸運色</div>
    <div class="lucky-card-color" data-bind="lucky-label">未設定</div>
    <div class="lucky-card-status" data-bind="lucky-status"></div>
  </div>
  <span class="ms lucky-card-arrow">arrow_forward</span>
</section>
```

In `renderToday(t)`, append (after the existing meal-dot block):

```ts
const luckyHit = t.missionsDone.includes('lucky:hit');
const luckyCard = $$('#lucky-card');
if (luckyCard) luckyCard.classList.toggle('hit', luckyHit);
const luckyStatusEl = $$('[data-bind="lucky-status"]');
if (luckyStatusEl) luckyStatusEl.textContent = luckyHit ? '✓ 已命中 +15 XP' : '';
```

- [ ] **Step 4: CSS for hit state**

Append to `globals.css`:

```css
.lucky-card.hit {
  border: 1.5px solid var(--color-secondary);
  box-shadow: 0 0 0 3px rgba(250,146,23,0.2);
}
.lucky-card-status {
  font-size: var(--text-caption-size);
  font-weight: var(--font-weight-extrabold);
  color: var(--color-secondary-dark);
}
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run src/routes/__tests__/home.test.ts`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/routes/home.ts src/routes/__tests__/home.test.ts src/styles/globals.css
git commit -m "feat(home): lucky-card '已命中' indicator + hit border"
```

---

## Task 12: Meal-notifier library

**Files:**
- Create: `src/lib/meal-notifier.ts`
- Create: `src/lib/__tests__/meal-notifier.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/meal-notifier.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseEatTimes, computeMatchKey } from '../meal-notifier';

describe('meal-notifier helpers', () => {
  describe('parseEatTimes', () => {
    it('parses a JSON string of meal-time map', () => {
      const out = parseEatTimes('{"breakfast":"08:00","lunch":"12:30","dinner":"19:00"}');
      expect(out).toEqual({ breakfast: '08:00', lunch: '12:30', dinner: '19:00' });
    });

    it('returns null for null/empty/malformed input', () => {
      expect(parseEatTimes(null)).toBeNull();
      expect(parseEatTimes('')).toBeNull();
      expect(parseEatTimes('not-json')).toBeNull();
    });
  });

  describe('computeMatchKey', () => {
    it('returns the slot when within ±5 min of (mealtime - 10 min)', () => {
      // meal at 12:30, target = 12:20, now = 12:18 → 2 min before target → match
      const now = new Date('2026-05-08T12:18:00+08:00');
      expect(computeMatchKey({ lunch: '12:30' }, now)).toBe('lunch');
    });

    it('returns null when no slot is within ±5 min', () => {
      const now = new Date('2026-05-08T15:00:00+08:00');
      expect(computeMatchKey({ lunch: '12:30' }, now)).toBeNull();
    });

    it('picks lunch over breakfast when lunch is the closer match', () => {
      const now = new Date('2026-05-08T12:21:00+08:00'); // 1 min after 12:20 target
      expect(computeMatchKey({ breakfast: '08:00', lunch: '12:30' }, now)).toBe('lunch');
    });
  });
});
```

- [ ] **Step 2: Run, expect import-fail**

Run: `npx vitest run src/lib/__tests__/meal-notifier.test.ts`
Expected: FAIL.

- [ ] **Step 3: Create `src/lib/meal-notifier.ts`**

```ts
/**
 * In-tab meal reminder. Polls every 60s; when "now" lands within ±5 min
 * of (mealtime − 10 min) and Notification permission is granted, fires a
 * Notification once per slot per local date.
 *
 * Tab-only — no service worker, no push backend. Acceptable for prototype.
 * Spec: 2026-05-08-prototype-polish-design.md §3.6
 */
import { $profile } from '@/store/user';

const POLL_MS = 60_000;
const WINDOW_MS = 5 * 60_000;
const LEAD_MS = 10 * 60_000; // fire 10 min before meal time

const MEAL_LABEL: Record<string, string> = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
};

export function parseEatTimes(raw: string | null): Record<string, string> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed as Record<string, string>;
  } catch {
    return null;
  }
}

/**
 * Pure helper: which meal slot is currently in the notification window?
 * Returns null if no slot is within ±5 min of (mealtime − 10 min).
 * If multiple match, returns the one closest in time.
 */
export function computeMatchKey(
  eatTimes: Record<string, string>,
  now: Date,
): string | null {
  let bestKey: string | null = null;
  let bestDiff = Infinity;
  for (const [key, hhmm] of Object.entries(eatTimes)) {
    const [h, m] = hhmm.split(':').map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) continue;
    const target = new Date(now);
    target.setHours(h, m, 0, 0);
    target.setTime(target.getTime() - LEAD_MS);
    const diff = Math.abs(now.getTime() - target.getTime());
    if (diff <= WINDOW_MS && diff < bestDiff) {
      bestDiff = diff;
      bestKey = key;
    }
  }
  return bestKey;
}

export function setupMealNotifier(): () => void {
  const fired = new Map<string, string>(); // key → 'YYYY-MM-DD'
  let timer: number | null = null;

  function tick() {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission !== 'granted') return;
    const eatTimes = parseEatTimes($profile.get()?.eat_times ?? null);
    if (!eatTimes) return;
    const now = new Date();
    const key = computeMatchKey(eatTimes, now);
    if (!key) return;
    const today = now.toISOString().slice(0, 10);
    if (fired.get(key) === today) return;
    fired.set(key, today);
    try {
      new Notification(`該打卡了 — ${MEAL_LABEL[key] ?? key}`, {
        body: '走進廚房，今天的能量等你補進精靈體內 🍃',
        icon: '/icon-192.png',
      });
    } catch (err) {
      console.warn('[meal-notifier] Notification failed:', err);
    }
  }

  timer = window.setInterval(tick, POLL_MS);
  tick();
  return () => {
    if (timer !== null) {
      window.clearInterval(timer);
      timer = null;
    }
  };
}

export async function requestMealNotificationPermission(): Promise<NotificationPermission> {
  if (typeof Notification === 'undefined') return 'denied';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}
```

- [ ] **Step 4: Run tests, expect pass**

Run: `npx vitest run src/lib/__tests__/meal-notifier.test.ts`
Expected: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/meal-notifier.ts src/lib/__tests__/meal-notifier.test.ts
git commit -m "feat(notifier): in-tab Notification scheduler keyed off eat_times"
```

---

## Task 13: Boot wire-up + permission ask

**Files:**
- Modify: `src/main.ts`
- Modify: `src/routes/onboarding/eat-times.ts`
- Modify: `src/routes/profile/settings.ts`

- [ ] **Step 1: Wire `setupMealNotifier` into boot**

In `src/main.ts`, in the `boot` async function, after `setupDaySync()`:

```ts
import { setupMealNotifier } from './lib/meal-notifier';
// ...
async function boot() {
  await bootstrapFromStorage();
  setupDaySync();
  setupInstallPrompt();
  setupMealNotifier();          // NEW
  startRouter();
}
```

- [ ] **Step 2: Ask for permission on the eat-times screen**

In `src/routes/onboarding/eat-times.ts`, find the continue-btn handler and update:

```ts
import { requestMealNotificationPermission } from '@/lib/meal-notifier';
// ...
wrap.querySelector('#continue-btn')?.addEventListener('click', async () => {
  const u = $user.get();
  if (!u) { navigate('/login'); return; }
  const eatTimes: Record<string, string> = {};
  wrap.querySelectorAll<HTMLInputElement>('.meal-input').forEach(input => {
    eatTimes[input.dataset.key!] = input.value;
  });
  try { await updateProfile(u.id, { eat_times: JSON.stringify(eatTimes) }); } catch { /* soft fail */ }
  // Ask once; outcome stored by the browser, not by us.
  void requestMealNotificationPermission();
  navigate('/onboarding/known-from');  // see Task 6
});
```

- [ ] **Step 3: Add a re-ask button to Settings**

In `src/routes/profile/settings.ts`, after the "用餐提醒" section, add:

```ts
// Inside the innerHTML template, append a new section:
<section class="settings-section">
  <span class="settings-label">推播提醒</span>
  <button class="btn text-btn-m btn-secondary btn-sm" id="ask-notif">允許用餐前 10 分鐘提醒</button>
  <span class="settings-hint" id="notif-status"></span>
</section>
```

After the form is mounted, wire it up:

```ts
import { requestMealNotificationPermission } from '@/lib/meal-notifier';
// ...
const askBtn = wrap.querySelector<HTMLButtonElement>('#ask-notif');
const statusEl = wrap.querySelector<HTMLElement>('#notif-status');
function reflectPermission() {
  if (typeof Notification === 'undefined') {
    if (statusEl) statusEl.textContent = '此瀏覽器不支援';
    if (askBtn) askBtn.disabled = true;
  } else if (statusEl) {
    statusEl.textContent =
      Notification.permission === 'granted' ? '已開啟' :
      Notification.permission === 'denied'  ? '已封鎖（請至瀏覽器設定開啟）' :
      '尚未設定';
  }
}
reflectPermission();
askBtn?.addEventListener('click', async () => {
  await requestMealNotificationPermission();
  reflectPermission();
});
```

- [ ] **Step 4: Run all tests**

Run: `npx vitest run`
Expected: all pass.

- [ ] **Step 5: Manual smoke**

Run: `npm run dev`. Walk through onboarding to eat-times → confirm browser asks for Notification permission. Set lunchtime to 5 min from now, wait for notification.

- [ ] **Step 6: Commit**

```bash
git add src/main.ts src/routes/onboarding/eat-times.ts src/routes/profile/settings.ts
git commit -m "feat(notifier): wire setupMealNotifier on boot + ask permission post-onboarding"
```

---

## Task 14: Challenge-level enforcement — RPC + counts

**Files:**
- DDL: drust RPC `meal_fail_count` (via MCP `create_rpc`)
- Modify: `src/api/profile.ts`
- Modify: `src/api/__tests__/profile.test.ts`

- [ ] **Step 1: Create RPC `meal_fail_count(user_id)`**

Use drust MCP `create_rpc`:

```sql
SELECT
  CAST(SUM(
    CASE WHEN missions_done LIKE '%meal_fail:breakfast%' THEN 1 ELSE 0 END
   +CASE WHEN missions_done LIKE '%meal_fail:lunch%'     THEN 1 ELSE 0 END
   +CASE WHEN missions_done LIKE '%meal_fail:dinner%'    THEN 1 ELSE 0 END
  ) AS INTEGER) AS fails
FROM daily_progress
WHERE user_id = :user_id
```

Params: `[{name: 'user_id', type: 'integer', required: true}]`. anon_callable: true.

- [ ] **Step 2: Verify RPC returns sane data**

Use `call_rpc` with `{user_id: 4}`. Expect `rows: [[N]]` where N is whatever count the demo data has (0 if nothing failed).

- [ ] **Step 3: Add `mealFailCount` API helper**

In `src/api/profile.ts`, append:

```ts
export async function mealFailCount(userId: number): Promise<number> {
  try {
    const result = await drust.rpc('meal_fail_count', { user_id: userId });
    const rows = drust.rpcRows<{ fails: number }>(result);
    return rows[0]?.fails ?? 0;
  } catch (err) {
    console.warn('[profile] meal_fail_count failed:', err);
    return 0;
  }
}
```

- [ ] **Step 4: Test the API helper**

Append to `src/api/__tests__/profile.test.ts`:

```ts
describe('mealFailCount', () => {
  it('returns the fails count from meal_fail_count RPC', async () => {
    mockedDrust.rpc.mockResolvedValueOnce({
      column_names: ['fails'], rows: [[3]], row_count: 1, truncated: false,
    });
    mockedDrust.rpcRows.mockReturnValueOnce([{ fails: 3 }]);
    expect(await mealFailCount(7)).toBe(3);
    expect(mockedDrust.rpc).toHaveBeenCalledWith('meal_fail_count', { user_id: 7 });
  });

  it('returns 0 (and does not throw) on drust error', async () => {
    mockedDrust.rpc.mockRejectedValueOnce(new Error('boom'));
    expect(await mealFailCount(7)).toBe(0);
  });
});
```

Add `mealFailCount` to the import line.

- [ ] **Step 5: Run tests**

Run: `npx vitest run src/api/__tests__/profile.test.ts`
Expected: all pass (existing + 2 new).

- [ ] **Step 6: Commit**

```bash
git add src/api/profile.ts src/api/__tests__/profile.test.ts
git commit -m "feat(api): meal_fail_count RPC + mealFailCount helper"
```

---

## Task 15: Profile 容錯次數 card + Home pill

**Files:**
- Modify: `src/routes/profile/index.ts`
- Modify: `src/routes/home.ts`
- Modify: `src/styles/globals.css`

- [ ] **Step 1: Add tolerance card to Profile**

In `src/routes/profile/index.ts`:

```ts
import { mealFailCount } from '@/api/profile';
```

Inside the route, alongside other state:

```ts
let serverFails = 0;
```

Compute tolerance descriptor (pure function):

```ts
function describeTolerance(level: number | null | undefined, fails: number): {
  show: boolean; total: number | null; used: number; broken: boolean; label: string;
} {
  if (level === 1 || !level) return { show: false, total: null, used: fails, broken: false, label: '' };
  const total = level === 2 ? 3 : 0;
  const used = fails;
  const broken = used > total;
  const label = total > 0 ? `已用 ${Math.min(used, total)} / ${total}` : (used > 0 ? '已失守' : '零容錯');
  return { show: true, total, used, broken, label };
}
```

Add a render slot in `wrap.innerHTML` after the stats grid:

```html
<section class="tolerance-card" id="tolerance" hidden></section>
```

A `renderTolerance` function:

```ts
function renderTolerance() {
  const p = $profile.get();
  const tol = describeTolerance(p?.challenge_level ?? null, serverFails);
  const el = wrap.querySelector<HTMLElement>('#tolerance')!;
  if (!tol.show) { el.hidden = true; return; }
  el.hidden = false;
  el.classList.toggle('broken', tol.broken);
  el.innerHTML = `
    <div class="tolerance-row">
      <span class="ms">shield</span>
      <strong>等級 ${p?.challenge_level} 容錯次數</strong>
      <span class="tolerance-label">${tol.label}</span>
    </div>
  `;
}
```

In the existing `renderAll`, add `renderTolerance()`. In the post-mount async block (where `serverCheckIns` is fetched), also fetch `mealFailCount(u.id)`:

```ts
try {
  serverFails = await mealFailCount(u.id);
  renderTolerance();
} catch {
  /* soft */
}
```

- [ ] **Step 2: Add Home challenge-level pill**

In `src/routes/home.ts`, add `$profile` to the imports (likely already present) and add a pill element next to the day badge.

In the existing `home-greeting` template, find:

```html
<div class="home-greeting-day">
  D<span data-bind="day">1</span><span class="home-day-of">/30</span>
</div>
```

Replace with:

```html
<div class="home-greeting-day">
  D<span data-bind="day">1</span><span class="home-day-of">/30</span>
  <span class="tolerance-pill" id="tolerance-pill" hidden></span>
</div>
```

Add a render function and bind it to `$profile`:

```ts
function renderTolerancePill(level: number | null) {
  const pill = $$('#tolerance-pill');
  if (!pill) return;
  if (!level || level === 1) {
    pill.hidden = true;
    return;
  }
  pill.hidden = false;
  // Home shows "等級 N" only — Profile is the place for the actual fail count.
  pill.textContent = `等級 ${level}`;
}
bind(wrap, $profile, (p) => renderTolerancePill(p?.challenge_level ?? null));
```

- [ ] **Step 3: CSS**

Append to `globals.css`:

```css
.tolerance-card {
  background: var(--color-card); padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md); margin-top: var(--space-3);
  border: 1px solid var(--color-neutral-light-active);
}
.tolerance-card.broken { border-color: var(--color-error, #d63b3b); }
.tolerance-row { display: flex; align-items: center; gap: var(--space-2); font-size: var(--text-mini-size); }
.tolerance-label { margin-left: auto; font-weight: var(--font-weight-extrabold); color: var(--color-secondary-dark); }
.tolerance-card.broken .tolerance-label { color: var(--color-error, #d63b3b); }

.tolerance-pill {
  background: var(--color-neutral-light-active); padding: 2px 8px; border-radius: var(--radius-pill);
  font-size: var(--text-caption-size); font-weight: var(--font-weight-bold);
  color: var(--color-neutral-darker);
}
```

- [ ] **Step 4: Run all tests**

Run: `npx vitest run`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/routes/profile/index.ts src/routes/home.ts src/styles/globals.css
git commit -m "feat(challenge): tolerance card on profile + level pill on home"
```

---

## Task 16: Settings build footer

**Files:**
- Modify: `src/routes/profile/settings.ts`
- Modify: `src/styles/globals.css`

- [ ] **Step 1: Append the footer to the Settings template**

In `src/routes/profile/settings.ts`, just before the closing `</div>` of `.settings-body`, add:

```html
<footer class="settings-footer">
  Yummi Go v${__APP_VERSION__} · 建置於 ${formatBuildTime()}
</footer>
```

And add the helper at module scope:

```ts
function formatBuildTime(): string {
  try {
    const d = new Date(__BUILD_TIME__);
    return d.toLocaleString('zh-TW');
  } catch {
    return __BUILD_TIME__;
  }
}
```

- [ ] **Step 2: Style**

Append to `globals.css`:

```css
.settings-footer {
  margin-top: var(--space-6);
  padding: var(--space-3) 0;
  text-align: center;
  font-size: var(--text-caption-size);
  color: var(--color-neutral-darker);
  opacity: 0.7;
}
```

- [ ] **Step 3: Manual sanity**

Run: `npm run build`
Open `dist/index.html` source, confirm `__APP_VERSION__` was inlined as `"0.0.0"` (or whatever package.json says).

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/routes/profile/__tests__/settings.test.ts`
Expected: pass (vitest.config define in Task 2 prevents undefined-global errors).

- [ ] **Step 5: Commit**

```bash
git add src/routes/profile/settings.ts src/styles/globals.css
git commit -m "feat(settings): version + build-time footer"
```

---

## Task 17: Reviews verification (item 8 — no new code)

**Files:**
- (read-only verification)

- [ ] **Step 1: Walk through the review submission flow**

Run dev server (`npm run dev`). Navigate to `/map`, click any restaurant, click "寫評論". Fill in rating + text, submit.

- [ ] **Step 2: Verify the row landed**

Use drust MCP `count_rows('restaurant_reviews')`. Expect at least 1 row.

- [ ] **Step 3: Verify the listing**

Navigate to `/profile/reviews`. Expect to see the review with the restaurant name resolved via `getRestaurant`.

- [ ] **Step 4: If verification passes, no code change needed**

Move on. If verification fails, file a follow-up task — the `restaurant_reviews_for_restaurant` RPC may be needed (out of scope for this plan).

- [ ] **Step 5: No commit**

Verification only.

---

## Task 18: STORAGE.md update + final sweep

**Files:**
- Modify: `docs/STORAGE.md`

- [ ] **Step 1: Update field references**

In `docs/STORAGE.md`'s "user_profiles" section, add a row:

```
| purpose | get_user_full / profile_for_user | onboarding/purpose updateProfile | NEW — Body / Environment / Vow / null |
```

In the daily_progress section, add new mission keys:

```
- `meal_fail:{slot}` — confirmed-meat fail; no XP credit
- `lucky:hit` — recorded when a check-in's lucky_color_matched=1; no XP credit (XP already on the meal mission)
```

In the "Authentication / authorisation (prototype scope)" or after the migration history, add a row:

```
- 2026-05-08 (prototype polish):
  - Added `user_profiles.purpose` column
  - Added `meal_fail_count` RPC
  - Updated `get_user_full` and `profile_for_user` RPCs to include purpose
  - New mission keys in daily_progress.missions_done JSON: `meal_fail:*`, `lucky:hit`
  - localStorage map unchanged
```

- [ ] **Step 2: Run full test sweep**

Run: `npx vitest run`
Expected: all tests pass; new test count > 357.

- [ ] **Step 3: Run typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 4: Run production build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 5: End-to-end smoke**

Run: `npm run dev` (background). Walk all 8 onboarding steps as a brand-new user. Then on Home, complete the daily quiz, do one meal check-in (with a lucky-color match if possible), verify:
- Quiz bubble flips to 已完成
- Lucky-card shows ✓ 已命中
- Meal-dot ticks
- Tolerance pill on Home shows "等級 N"

Do one meat-confirmed check-in (`meat-yes`) → land on /check-in/fail. After clicking 回首頁, verify drust:
- `daily_progress.missions_done` contains `meal_fail:lunch`
- `meal_fail_count(user_id)` returns 1

- [ ] **Step 6: Commit + final tag**

```bash
git add docs/STORAGE.md
git commit -m "docs(storage): document purpose column + new mission keys + meal_fail_count RPC"
```

---

## Self-review checklist

The 10 spec items map to tasks as follows:

| Spec § | Item | Task(s) |
|---|---|---|
| 1 | Onboarding 挑戰目的 + 來源調查 | Task 1, 3, 4, 5, 6 |
| 2 | Per-meal Share button | Task 10 |
| 3 | Meat-fail UX upgrade | Task 8, 9 |
| 4 | Reward chain animation | Task 10 |
| 5 | Day-1 hook upgrade | Task 7 |
| 6 | PWA-ish Notification API | Task 12, 13 |
| 7 | challenge_level enforcement | Task 14, 15 |
| 8 | /profile/reviews verification | Task 17 |
| 9 | Lucky-card hit indicator | Task 9 (write), Task 11 (render) |
| 10 | Settings build info | Task 2, 16 |

All 10 covered. STORAGE.md update in Task 18.
