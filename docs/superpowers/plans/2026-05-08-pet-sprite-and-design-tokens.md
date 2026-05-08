# Pet Sprite System + Full design.md Token Adoption — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single hard-coded `/pet-frog.png` with a 21-cell sprite matrix indexed by `($pet.stage, $pet.mood)`, then complete the design.md token migration (typography + spacing + radius) so the codebase reaches ~100% token adoption.

**Architecture:** Sprite system uses a centralized `src/lib/pet-sprites.ts` helper + 21 static PNGs at `public/pet/<stage>/<mood>.png`. Token migration is mechanical — replace raw px values with `var(--text-*-size)` / `var(--space-*)` / `var(--radius-*)`, with round-up rules for off-token values per spec § 7–9. Three sequential phases for sprite (1: refactor, 2: drop PNGs, 3: cleanup) and three for tokens (α: typography, β: spacing, γ: radius). Each phase is independently committable.

**Tech Stack:** TypeScript, Vite, vanilla DOM, nanostores, vitest+jsdom.

**Naming convention note:** The spec § 6.2 uses `final` for the 5th pet stage; the existing codebase uses `'max'` (see `src/lib/pet-evolution.ts:10`). This plan follows the codebase. File paths use `/pet/max/<mood>.png`. The spec's `final` references map 1:1 to `max` here.

**Reference spec:** `docs/superpowers/specs/2026-05-08-pet-sprite-and-design-tokens-design.md`

---

## File Structure

**Create:**
- `src/lib/pet-sprites.ts` — `spriteFor(stage, mood)` helper + AVAILABLE map (Task 1)
- `src/lib/__tests__/pet-sprites.test.ts` — unit tests (Task 1)
- `public/pet/egg/normal.png`, `public/pet/egg/crack.png` (Task 4 — codex output)
- `public/pet/baby/{normal,happy,weak,critical,evolve}.png` (Task 4)
- `public/pet/youth/{normal,happy,weak,critical,evolve}.png` (Task 4)
- `public/pet/adult/{normal,happy,weak,critical,evolve}.png` (Task 4)
- `public/pet/max/{normal,happy,weak,critical}.png` (Task 4)

**Modify:**
- `src/components/PetView.ts` — call `spriteFor()`, add `onerror` fallback (Task 2)
- `src/components/__tests__/PetView.test.ts` — update to assert `<img src>` (Task 2)
- `src/routes/profile/index.ts:81-82` — call `spriteFor`, drop emoji shell (Task 3)
- `src/routes/day-30.ts:48` — `spriteFor('max', 'happy')` (Task 3)
- `src/styles/globals.css` — Phase 3 removes `.pet-stage-*`, `.pet-mood-*`, `@keyframes pet-rainbow` (Task 5); Phase α replaces 161 raw `font-size` (Task 7); Phase β replaces 106 raw `padding`/`margin` (Task 10); Phase γ replaces 102 raw `border-radius` (Task 12)
- `src/styles/tokens.css` — add `--text-mini-size`, `--text-display-size` (Task 6) and `--radius-xl` (Task 11)
- Various `.ts` route files — utility class adoption on markup (Task 9)

**Delete (Task 5 only):**
- `public/pet-frog.png`

---

## Task 1: Create `pet-sprites` helper (TDD)

**Files:**
- Create: `src/lib/pet-sprites.ts`
- Test: `src/lib/__tests__/pet-sprites.test.ts`

- [ ] **Step 1: Write the failing test file**

Create `src/lib/__tests__/pet-sprites.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { spriteFor, type PetMood } from '@/lib/pet-sprites';
import type { PetStage } from '@/lib/pet-evolution';

describe('spriteFor', () => {
  describe('happy paths', () => {
    const cases: Array<[PetStage, PetMood, string]> = [
      ['egg',   'normal',   '/pet/egg/normal.png'],
      ['egg',   'evolve',   '/pet/egg/crack.png'],
      ['baby',  'normal',   '/pet/baby/normal.png'],
      ['baby',  'happy',    '/pet/baby/happy.png'],
      ['baby',  'weak',     '/pet/baby/weak.png'],
      ['baby',  'critical', '/pet/baby/critical.png'],
      ['baby',  'evolve',   '/pet/baby/evolve.png'],
      ['youth', 'normal',   '/pet/youth/normal.png'],
      ['youth', 'happy',    '/pet/youth/happy.png'],
      ['youth', 'weak',     '/pet/youth/weak.png'],
      ['youth', 'critical', '/pet/youth/critical.png'],
      ['youth', 'evolve',   '/pet/youth/evolve.png'],
      ['adult', 'normal',   '/pet/adult/normal.png'],
      ['adult', 'happy',    '/pet/adult/happy.png'],
      ['adult', 'weak',     '/pet/adult/weak.png'],
      ['adult', 'critical', '/pet/adult/critical.png'],
      ['adult', 'evolve',   '/pet/adult/evolve.png'],
      ['max',   'normal',   '/pet/max/normal.png'],
      ['max',   'happy',    '/pet/max/happy.png'],
      ['max',   'weak',     '/pet/max/weak.png'],
      ['max',   'critical', '/pet/max/critical.png'],
    ];
    it.each(cases)('spriteFor(%s, %s) -> %s', (stage, mood, expected) => {
      expect(spriteFor(stage, mood)).toBe(expected);
    });
  });

  describe('fallbacks', () => {
    it('egg falls back to normal for happy/weak/critical', () => {
      expect(spriteFor('egg', 'happy')).toBe('/pet/egg/normal.png');
      expect(spriteFor('egg', 'weak')).toBe('/pet/egg/normal.png');
      expect(spriteFor('egg', 'critical')).toBe('/pet/egg/normal.png');
    });

    it('max falls back to normal for evolve (no further evolution)', () => {
      expect(spriteFor('max', 'evolve')).toBe('/pet/max/normal.png');
    });

    it('unknown stage defaults to egg/normal (defensive)', () => {
      expect(spriteFor('bogus' as PetStage, 'normal')).toBe('/pet/egg/normal.png');
    });
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

```bash
npm test -- src/lib/__tests__/pet-sprites.test.ts
```

Expected: tests fail with "Cannot find module '@/lib/pet-sprites'" or similar.

- [ ] **Step 3: Implement `pet-sprites.ts`**

Create `src/lib/pet-sprites.ts`:

```ts
/**
 * Pet sprite resolution — maps ($pet.stage, $pet.mood) to a PNG path under
 * /public/pet/<stage>/<mood>.png. Centralizes fallback rules so PetView,
 * Profile and Day-30 share one source of truth.
 *
 * AVAILABLE encodes which (stage, mood) combinations have art. Unavailable
 * combinations fall back to that stage's 'normal' cell. The egg stage's
 * 'evolve' mood is rendered by a special filename ('crack') because the
 * art is qualitatively different (crack lines, not a glow).
 */
import type { PetStage } from './pet-evolution';

export type PetMood = 'normal' | 'happy' | 'weak' | 'critical' | 'evolve';

const AVAILABLE: Record<PetStage, ReadonlyArray<PetMood>> = {
  egg:   ['normal', 'evolve'],
  baby:  ['normal', 'happy', 'weak', 'critical', 'evolve'],
  youth: ['normal', 'happy', 'weak', 'critical', 'evolve'],
  adult: ['normal', 'happy', 'weak', 'critical', 'evolve'],
  max:   ['normal', 'happy', 'weak', 'critical'],
};

export function spriteFor(stage: PetStage, mood: PetMood): string {
  const moods = AVAILABLE[stage];
  if (!moods) return '/pet/egg/normal.png';
  const resolved: PetMood = moods.includes(mood) ? mood : 'normal';
  const filename =
    stage === 'egg' && resolved === 'evolve' ? 'crack' : resolved;
  return `/pet/${stage}/${filename}.png`;
}
```

- [ ] **Step 4: Run tests, verify pass**

```bash
npm test -- src/lib/__tests__/pet-sprites.test.ts
```

Expected: 24 tests pass (21 happy paths + 3 fallback groups).

- [ ] **Step 5: Run full type check**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/pet-sprites.ts src/lib/__tests__/pet-sprites.test.ts
git commit -m "feat(pet): add pet-sprites helper + AVAILABLE matrix"
```

---

## Task 2: Refactor `PetView` to use `spriteFor` + onerror fallback

**Files:**
- Modify: `src/components/PetView.ts`
- Modify: `src/components/__tests__/PetView.test.ts`

- [ ] **Step 1: Update tests first to describe new behaviour**

Replace `src/components/__tests__/PetView.test.ts` contents with:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createPetView, fogOpacityForMissedDays } from '../PetView';
import { $pet } from '@/store/pet';

describe('PetView', () => {
  beforeEach(() => {
    $pet.set(null);
  });

  it('renders .pet-view with default egg/normal sprite when $pet is null', () => {
    const { el } = createPetView();
    const img = el.querySelector<HTMLImageElement>('img.pet-frog');
    expect(el.classList.contains('pet-view')).toBe(true);
    expect(img).not.toBeNull();
    expect(img!.getAttribute('src')).toBe('/pet/egg/normal.png');
  });

  it('contains accessory and fog overlay slots', () => {
    const { el } = createPetView();
    expect(el.querySelector('.pet-accessory')).not.toBeNull();
    expect(el.querySelector('.fog-overlay')).not.toBeNull();
  });

  it('updates <img src> to the sprite for current $pet.stage and mood', () => {
    const { el } = createPetView();
    document.body.appendChild(el);
    const img = el.querySelector<HTMLImageElement>('img.pet-frog')!;

    $pet.set({ level: 19, currentXp: 0, accumulatedXp: 1000, stage: 'youth', mood: 'happy' });
    expect(img.getAttribute('src')).toBe('/pet/youth/happy.png');

    $pet.set({ level: 80, currentXp: 0, accumulatedXp: 9999, stage: 'max', mood: 'evolve' });
    expect(img.getAttribute('src')).toBe('/pet/max/normal.png');

    el.remove();
  });

  it('falls back to egg/normal for unknown stage values', () => {
    const { el } = createPetView();
    document.body.appendChild(el);
    const img = el.querySelector<HTMLImageElement>('img.pet-frog')!;
    $pet.set({ level: 1, currentXp: 0, accumulatedXp: 0, stage: 'bogus' as never, mood: 'whatever' as never });
    expect(img.getAttribute('src')).toBe('/pet/egg/normal.png');
    el.remove();
  });

  it('falls back to /pet-frog.png on image load error', () => {
    const { el } = createPetView();
    document.body.appendChild(el);
    const img = el.querySelector<HTMLImageElement>('img.pet-frog')!;
    $pet.set({ level: 6, currentXp: 0, accumulatedXp: 100, stage: 'baby', mood: 'happy' });
    expect(img.getAttribute('src')).toBe('/pet/baby/happy.png');
    img.dispatchEvent(new Event('error'));
    expect(img.getAttribute('src')).toContain('/pet-frog.png');
    el.remove();
  });

  it('setFogOpacity writes the custom property and clamps to [0,1]', () => {
    const { el, setFogOpacity } = createPetView();
    const fog = el.querySelector<HTMLElement>('.fog-overlay')!;
    setFogOpacity(0.5);
    expect(fog.style.getPropertyValue('--fog-opacity')).toBe('0.5');
    setFogOpacity(2);
    expect(fog.style.getPropertyValue('--fog-opacity')).toBe('1');
    setFogOpacity(-1);
    expect(fog.style.getPropertyValue('--fog-opacity')).toBe('0');
  });

  it('fogOpacityForMissedDays maps spec values', () => {
    expect(fogOpacityForMissedDays(0)).toBe(0);
    expect(fogOpacityForMissedDays(1)).toBe(0.3);
    expect(fogOpacityForMissedDays(2)).toBe(0.6);
    expect(fogOpacityForMissedDays(5)).toBe(0.6);
  });
});
```

Removed assertions: `pet-stage-*` and `pet-mood-*` class checks, `pet-shell` element check (egg shell is gone — sprite handles it).

- [ ] **Step 2: Run tests, verify they fail**

```bash
npm test -- src/components/__tests__/PetView.test.ts
```

Expected: most fail because the implementation still uses old class-based approach + hard-coded src.

- [ ] **Step 3: Replace `src/components/PetView.ts` body**

Replace the file contents with:

```ts
/**
 * Pet hero view — sprite-driven illustration that swaps art based on
 * ($pet.stage, $pet.mood). Resolution is centralized in lib/pet-sprites.
 *
 * On image load error (e.g., codex hasn't generated that cell yet),
 * falls back to /pet-frog.png so the UI never shows a broken image.
 *
 * Subscribes to $pet via bind() so subscribers auto-cleanup when the
 * element is removed from the DOM (no leaks across navigations).
 */
import { $pet, type PetStoreShape } from '@/store/pet';
import { bind } from '@/lib/lifecycle';
import { spriteFor, type PetMood } from '@/lib/pet-sprites';
import type { PetStage } from '@/lib/pet-evolution';

export interface PetViewHandle {
  el: HTMLElement;
  setFogOpacity: (value: number) => void;
}

export function createPetView(): PetViewHandle {
  const wrap = document.createElement('div');
  wrap.className = 'pet-view';
  wrap.innerHTML = `
    <img class="pet-frog" src="${spriteFor('egg', 'normal')}" alt="守護者" draggable="false" />
    <div class="pet-accessory" aria-hidden="true"></div>
    <div class="fog-overlay" style="--fog-opacity:0"></div>
  `;

  const img = wrap.querySelector<HTMLImageElement>('img.pet-frog')!;
  img.addEventListener('error', () => {
    if (img.src.endsWith('/pet-frog.png')) return;
    img.src = '/pet-frog.png';
  });

  function applyState(p: PetStoreShape | null) {
    const stage = (p?.stage ?? 'egg') as PetStage;
    const mood = (p?.mood ?? 'normal') as PetMood;
    img.setAttribute('src', spriteFor(stage, mood));
  }

  bind(wrap, $pet, applyState);

  return {
    el: wrap,
    setFogOpacity(value: number) {
      const fog = wrap.querySelector<HTMLElement>('.fog-overlay');
      if (fog) fog.style.setProperty('--fog-opacity', String(Math.max(0, Math.min(1, value))));
    },
  };
}

/** Map consecutive missed-checkin days to fog opacity per spec (0%/30%/60%). */
export function fogOpacityForMissedDays(missed: number): number {
  if (missed <= 0) return 0;
  if (missed === 1) return 0.3;
  return 0.6;
}
```

Note: removed `STAGES`/`MOODS` arrays, removed class manipulation, removed `.pet-shell` div.

- [ ] **Step 4: Run tests, verify pass**

```bash
npm test -- src/components/__tests__/PetView.test.ts
```

Expected: 7 tests pass.

- [ ] **Step 5: Run full test suite**

```bash
npm test
```

Expected: all tests still pass (no regression in other suites).

- [ ] **Step 6: Run typecheck**

```bash
npm run typecheck
```

Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/components/PetView.ts src/components/__tests__/PetView.test.ts
git commit -m "refactor(pet-view): drive sprite from spriteFor() + onerror fallback"
```

---

## Task 3: Refactor `profile/index.ts` and `day-30.ts` callers

**Files:**
- Modify: `src/routes/profile/index.ts:81-82`
- Modify: `src/routes/day-30.ts:47-48`

- [ ] **Step 1: Read current `profile/index.ts` around line 81**

```bash
sed -n '75,90p' src/routes/profile/index.ts
```

Identify the `<img class="pet-frog" src="/pet-frog.png" .../>` and the adjacent `<div class="pet-shell">🥚</div>`.

- [ ] **Step 2: Update `src/routes/profile/index.ts`**

Add at the top of the file (or alongside other imports):

```ts
import { spriteFor } from '@/lib/pet-sprites';
import type { PetStage } from '@/lib/pet-evolution';
import type { PetMood } from '@/lib/pet-sprites';
```

Replace the markup at line 81-82:

```html
<img class="pet-frog" src="/pet-frog.png" alt="守護者" draggable="false" />
<div class="pet-shell" aria-hidden="true">🥚</div>
```

with:

```html
<img class="pet-frog" data-bind="profile-pet" src="" alt="守護者" draggable="false" />
```

Then in the controller code (where the route subscribes to `$pet`), set the src:

```ts
const petImg = root.querySelector<HTMLImageElement>('[data-bind="profile-pet"]');
if (petImg) {
  petImg.addEventListener('error', () => {
    if (!petImg.src.endsWith('/pet-frog.png')) petImg.src = '/pet-frog.png';
  });
  bind(root, $pet, (p) => {
    const stage = (p?.stage ?? 'egg') as PetStage;
    const mood = (p?.mood ?? 'normal') as PetMood;
    petImg.setAttribute('src', spriteFor(stage, mood));
  });
}
```

If `bind(root, $pet, ...)` already exists in this file for other reasons, fold the sprite update into the existing callback.

- [ ] **Step 3: Update `src/routes/day-30.ts:47-48`**

Replace:

```html
<div class="pet-view pet-stage-max pet-mood-evolve">
  <img class="pet-frog" src="/pet-frog.png" alt="守護者" draggable="false" />
```

with:

```html
<div class="pet-view">
  <img class="pet-frog" src="${spriteFor('max', 'happy')}" alt="守護者" draggable="false" onerror="this.onerror=null;this.src='/pet-frog.png'" />
```

Add `import { spriteFor } from '@/lib/pet-sprites';` at the top of the file.

Rationale: day-30 always shows max-evolution celebrating, so 'max'/'happy' is correct.

- [ ] **Step 4: Run tests**

```bash
npm test
```

Expected: all pass.

- [ ] **Step 5: Run typecheck**

```bash
npm run typecheck
```

Expected: clean.

- [ ] **Step 6: Visual smoke test (manual)**

Start dev server:

```bash
npm run dev
```

Navigate to `/profile` and `/day-30` (use dev panel to bump day to 30). Both should show the legacy `/pet-frog.png` (because new sprite files don't exist yet — `onerror` fallback fires).

- [ ] **Step 7: Commit**

```bash
git add src/routes/profile/index.ts src/routes/day-30.ts
git commit -m "refactor(pet-view): wire profile + day-30 callers through spriteFor"
```

---

## Task 4: Generate 21 sprite PNGs via codex cli

**Files:**
- Create: `public/pet/egg/normal.png`, `public/pet/egg/crack.png`
- Create: `public/pet/baby/{normal,happy,weak,critical,evolve}.png`
- Create: `public/pet/youth/{normal,happy,weak,critical,evolve}.png`
- Create: `public/pet/adult/{normal,happy,weak,critical,evolve}.png`
- Create: `public/pet/max/{normal,happy,weak,critical}.png`

**This task is performed by the human, not the agent.** The plan documents the steps so the user can execute them outside the implementation loop.

- [ ] **Step 1: Create the directory structure**

```bash
mkdir -p public/pet/egg public/pet/baby public/pet/youth public/pet/adult public/pet/max
```

- [ ] **Step 2: For each of the 21 rows in spec § 6.2, run codex cli with the prompt template**

Prompt template (re-stated from spec § 6.1):

```
Style reference: flat 2D character illustration in the style of the existing
pet-frog asset at /public/pet-frog.png — friendly cartoon frog, thick black
ink outline, soft warm colours (cream, sage green, gentle orange), small white
highlight dots on cheeks and eyes, designed for a children-friendly mobile app.

Subject: a single frog character, [STAGE_DESCRIPTION], expressing [MOOD_DESCRIPTION].
Pose: [POSE].

Composition: square 1024×1024, character centered, occupying ~80% of canvas,
~10% transparent margin on all sides. Fully transparent background (no solid
fill, no shadow, no border). No text, no signature, no UI elements.

Negative prompt: text, letters, watermark, signature, frame, border, background,
photograph, realistic skin texture, multiple characters, weapons.
```

For each of the 21 rows, substitute `[STAGE_DESCRIPTION]`, `[MOOD_DESCRIPTION]`, `[POSE]` with the values from spec § 6.2 and save the output to the file path in column 4 of that table.

The 21 file paths (mapping `final` in spec → `max` here):

```
public/pet/egg/normal.png
public/pet/egg/crack.png
public/pet/baby/normal.png
public/pet/baby/happy.png
public/pet/baby/weak.png
public/pet/baby/critical.png
public/pet/baby/evolve.png
public/pet/youth/normal.png
public/pet/youth/happy.png
public/pet/youth/weak.png
public/pet/youth/critical.png
public/pet/youth/evolve.png
public/pet/adult/normal.png
public/pet/adult/happy.png
public/pet/adult/weak.png
public/pet/adult/critical.png
public/pet/adult/evolve.png
public/pet/max/normal.png
public/pet/max/happy.png
public/pet/max/weak.png
public/pet/max/critical.png
```

- [ ] **Step 3: Style sanity check — generate egg/normal and max/normal first**

If those two read as the "same character" at different ages, the prompt template works for the rest. If they don't, refine the style reference paragraph and regenerate before doing the other 19.

- [ ] **Step 4: Smoke test in browser**

```bash
npm run dev
```

Open `http://localhost:5173/pet/baby/happy.png` directly. It should render. Repeat-spot-check 4–5 random cells.

- [ ] **Step 5: Walk every cell via dev panel**

Use the existing dev panel's level slider to step through stages. Toggle moods using `Pet LV1` reset → grant XP → repeat.

- [ ] **Step 6: Re-generate any cells that look off**

If `final/happy` (i.e., `max/happy`) is too similar to `final/normal`, regenerate per spec § 13 risk #4.

- [ ] **Step 7: Commit the 21 PNGs**

```bash
git add public/pet/
git commit -m "feat(pet): add 21 sprite PNGs (5 stages x N moods)"
```

---

## Task 5: Phase 3 cleanup — remove obsolete CSS + delete legacy PNG + remove fallback

**Files:**
- Modify: `src/styles/globals.css` (remove rules)
- Modify: `src/components/PetView.ts` (remove onerror handler)
- Modify: `src/routes/profile/index.ts` (remove onerror handler)
- Modify: `src/routes/day-30.ts` (remove onerror attr)
- Delete: `public/pet-frog.png`

- [ ] **Step 1: Remove pet-related CSS rules from `globals.css`**

Delete these blocks (use line numbers from current file):

- L389–392: `.pet-stage-egg .pet-shell { display: block; }` and `.pet-stage-egg .pet-frog { display: none; }`
- L391–393: `.pet-stage-baby/youth/adult .pet-frog { transform: scale(...) }`
- L394–397: `.pet-stage-adult .pet-accessory::before { ... }` (if it's the crown/sparkle, evaluate; if you want to keep accessories, leave; otherwise remove)
- L398: `.pet-stage-max .pet-frog { transform: scale(1.4); animation: pet-rainbow ... }`
- L399–403: `@keyframes pet-rainbow { ... }`
- L404–408: `.pet-mood-normal/happy/weak/critical/evolve .pet-frog { filter: ... }`
- Also remove `.pet-shell { font-size: 56px; ... }` at L1058 (was egg fallback emoji styling)

Leave intact:
- `.pet-view` outer container (L371)
- `.pet-shell` rule on L376 — wait, check if any non-profile route still uses `.pet-shell`. If only profile, remove the `.pet-shell` declaration entirely. Profile's emoji shell is gone in Task 3.
- `.pet-frog` base sizing rules (width/height/object-fit) — keep
- `.pet-accessory { position: absolute; ... }` — keep (still a slot for future overlays)

Run `grep -n "pet-shell\|pet-stage-\|pet-mood-\|@keyframes pet-rainbow" src/styles/globals.css` after the edits — should return zero matches.

- [ ] **Step 2: Remove `onerror` handler from `PetView.ts`**

Remove these lines from `src/components/PetView.ts`:

```ts
  img.addEventListener('error', () => {
    if (img.src.endsWith('/pet-frog.png')) return;
    img.src = '/pet-frog.png';
  });
```

Also remove the corresponding test case (`'falls back to /pet-frog.png on image load error'`) from `src/components/__tests__/PetView.test.ts`.

- [ ] **Step 3: Remove `onerror` handler from `profile/index.ts`**

Remove the lines added in Task 3:

```ts
petImg.addEventListener('error', () => {
  if (!petImg.src.endsWith('/pet-frog.png')) petImg.src = '/pet-frog.png';
});
```

- [ ] **Step 4: Remove `onerror` attribute from `day-30.ts`**

Change:

```html
<img class="pet-frog" src="${spriteFor('max', 'happy')}" alt="守護者" draggable="false" onerror="this.onerror=null;this.src='/pet-frog.png'" />
```

to:

```html
<img class="pet-frog" src="${spriteFor('max', 'happy')}" alt="守護者" draggable="false" />
```

- [ ] **Step 5: Delete `public/pet-frog.png`**

```bash
git rm public/pet-frog.png
```

- [ ] **Step 6: Run tests**

```bash
npm test
```

Expected: all pass (one test removed in Step 2).

- [ ] **Step 7: Run typecheck + visual smoke test**

```bash
npm run typecheck
npm run dev
```

Walk all stages via dev panel. Each stage/mood should render correctly without falling through to `/pet-frog.png` (which no longer exists).

- [ ] **Step 8: Commit**

```bash
git add src/styles/globals.css src/components/PetView.ts src/components/__tests__/PetView.test.ts src/routes/profile/index.ts src/routes/day-30.ts
git commit -m "chore(pet): remove legacy CSS scaling/filters + onerror fallback + /pet-frog.png"
```

---

## Task 6: Phase α — Add new typography tokens

**Files:**
- Modify: `src/styles/tokens.css`

- [ ] **Step 1: Open `src/styles/tokens.css` and locate the typography size block (around L102–111)**

The block currently looks like:

```css
--text-title-size:    48px;
--text-h1-size:       33px;
--text-h2-size:       28px;
--text-h3-size:       24px;
--text-body-size:     16px;
--text-caption-size:  12px;
--text-button-xl-size: 24px;
--text-button-l-size:  20px;
--text-button-m-size:  18px;
```

- [ ] **Step 2: Add two new tokens**

Insert after `--text-body-size`:

```css
--text-mini-size:    14px;   /* below body — labels, dense UI rows */
```

And after `--text-caption-size`:

```css
--text-display-size: 32px;   /* between h2 (28) and title (48) — splash hero */
```

Also add the same insertions to `docs/tokens.css` so the canonical file stays in sync (the file at `docs/tokens.css` is treated as authoritative source per the comment header in `src/styles/tokens.css`).

- [ ] **Step 3: Run tests**

```bash
npm test && npm run typecheck
```

Expected: clean (this is a CSS-only addition).

- [ ] **Step 4: Commit**

```bash
git add src/styles/tokens.css docs/tokens.css
git commit -m "feat(tokens): add --text-mini-size (14px) and --text-display-size (32px)"
```

---

## Task 7: Phase α — Migrate raw `font-size` in `globals.css` to tokens

**Files:**
- Modify: `src/styles/globals.css`

- [ ] **Step 1: Build the replacement table**

Per spec § 7.1 mappings, replace `font-size: NNpx` with `font-size: var(--text-X-size)` according to:

| Raw | Replacement |
|---:|---|
| `12px` | `var(--text-caption-size)` |
| `14px` | `var(--text-mini-size)` |
| `16px` | `var(--text-body-size)` |
| `18px` | `var(--text-button-m-size)` |
| `20px` | `var(--text-button-l-size)` |
| `24px` | `var(--text-h3-size)` (or `var(--text-button-xl-size)` for buttons) |
| `28px` | `var(--text-h2-size)` |
| `32px` | `var(--text-display-size)` |
| `33px` | `var(--text-h1-size)` |
| `48px` | `var(--text-title-size)` |
| `10px`, `11px` | `var(--text-caption-size)` (round up to 12) |
| `13px`, `15px` | `var(--text-mini-size)` (round to 14) |
| `17px` | `var(--text-button-m-size)` (round to 18) |
| `22px` | `var(--text-button-l-size)` (round to 20) |
| `26px` | `var(--text-h2-size)` (round to 28) |
| `30px` | `var(--text-h1-size)` (round to 33) |
| `44px` | `var(--text-title-size)` (round to 48) |
| `56px`, `64px`, `100px`, `120px` | **leave as raw** — these are emoji icon sizes, append a comment `/* emoji icon size — not text */` |

For the ambiguous case of `24px` (could be `--text-h3-size` or `--text-button-xl-size`): use `--text-button-xl-size` ONLY when the rule sits inside a button-related class (`.btn`, `.btn-l`, `.btn-xl`, etc.); otherwise use `--text-h3-size`.

- [ ] **Step 2: Apply replacements file-wide**

Open `src/styles/globals.css` and walk top to bottom, replacing every `font-size: NNpx;` per the table above. Do not run sed blindly — the `24px` ambiguity needs human eyeball.

For the emoji icon ones (56/64/100/120), add an inline comment after the value, e.g.:

```css
.success-pet { font-size: 100px; /* emoji icon size — not text */ ... }
```

- [ ] **Step 3: Run tests**

```bash
npm test
```

Expected: pass.

- [ ] **Step 4: Run typecheck**

```bash
npm run typecheck
```

Expected: clean.

- [ ] **Step 5: Visual diff**

```bash
npm run dev
```

Walk these screens manually and eye-check that text sizes look reasonable:
- Splash (`/`)
- Auth login + signup
- Onboarding (each step)
- Home (current day)
- Profile
- Day-30

Most changes should be invisible (token values match the original raw values). The visible deltas come from:
- `13px` → `14px` (form labels, captions): tiny increase
- `15px` → `14px` (auth subtitle): tiny decrease
- `17px` → `18px` (btn-l): tiny increase
- `22px` → `20px` (some headers): tiny decrease
- `30px` → `33px` (auth title): noticeable increase, accept per spec § 7.1
- `44px` → `48px` (splash title): noticeable, accept

If anything looks broken (text overflow, bad alignment), revert that specific declaration to raw and add `/* one-off, not on token scale */` comment.

- [ ] **Step 6: Verify zero raw `font-size` declarations remain except emoji-icon comments**

```bash
grep -nE "font-size:\s*[0-9]+(px|rem|em)" src/styles/globals.css | grep -v "emoji icon size"
```

Expected: empty output.

- [ ] **Step 7: Commit**

```bash
git add src/styles/globals.css
git commit -m "refactor(styles): migrate 161 raw font-size declarations to design tokens"
```

---

## Task 8: Phase α — Migrate raw `font-weight` in `globals.css` to tokens

**Files:**
- Modify: `src/styles/globals.css`

- [ ] **Step 1: Replacement table**

| Raw | Token |
|---:|---|
| `500` | `var(--font-weight-medium)` |
| `600` | `var(--font-weight-semibold)` |
| `700` | `var(--font-weight-bold)` |
| `800` | `var(--font-weight-extrabold)` |
| `900` | `var(--font-weight-black)` |

All current raw values match a token exactly — no rounding needed.

- [ ] **Step 2: Apply replacements**

Replace every `font-weight: NNN;` accordingly. Safe to do mechanically (no semantic ambiguity).

- [ ] **Step 3: Verify zero raw `font-weight` remain**

```bash
grep -nE "font-weight:\s*[0-9]+" src/styles/globals.css
```

Expected: empty.

- [ ] **Step 4: Run tests + typecheck**

```bash
npm test && npm run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add src/styles/globals.css
git commit -m "refactor(styles): migrate raw font-weight declarations to design tokens"
```

---

## Task 9: Phase α — Adopt utility classes on top-level markup

**Files:**
- Modify: `src/routes/splash.ts` (or wherever the splash markup lives)
- Modify: `src/routes/auth/login.ts`, `src/routes/auth/signup.ts`
- Modify: `src/routes/onboarding/*.ts` (6 files)
- Modify: `src/routes/home.ts`, `src/routes/day-30.ts`, `src/routes/profile/index.ts`
- Modify: `src/styles/globals.css` (strip font-related declarations from bespoke classes that now use utility classes)

Goal: where a bespoke CSS class (e.g., `.onb-title`, `.auth-title`, `.splash-title`) only wraps a `font-size + font-weight` pair that matches a utility class, replace the markup so it carries the utility class AND strip those rules from the bespoke class CSS.

- [ ] **Step 1: Identify migration candidates**

Run:

```bash
grep -nE "(font-size|font-weight): var" src/styles/globals.css | head -40
```

A bespoke class is a "candidate" when its only typography-related declarations are `font-size` + `font-weight`. Examples that qualify:

- `.splash-title` → `text-title is-latin` (Latin-only Nunito Black)
- `.auth-title` → `text-h1`
- `.auth-sub` → `text-body` (round-up from 15→16) — already covered by `--text-body`
- `.onb-title` → `text-h2`
- `.onb-sub` → `text-mini`
- `.field-label` → `text-mini`
- `.btn` / `.btn-l` / `.btn-sm` → `text-btn-m` / `text-btn-l` / `text-btn-m`

Bespoke classes that do NOT migrate (because they have other rules layered on, e.g., colour, letter-spacing, line-height): leave alone.

- [ ] **Step 2: Add `text-mini` utility class to `tokens.css`**

The existing utility class block stops at `.text-caption`. Add (near the existing utilities at L166):

```css
.text-mini    { font-family: var(--font-sans); font-size: var(--text-mini-size);    font-weight: var(--text-body-weight-cjk); }
.text-mini.is-latin { font-weight: var(--text-body-weight-latin); }
```

Mirror in `docs/tokens.css`.

- [ ] **Step 3: Walk each route file and apply utility class on markup**

For each file, find the relevant element's `class="..."` attribute and add the utility class. Example for `src/routes/splash.ts` (find the splash title element):

Before:

```ts
`<h1 class="splash-title">Yummi Go 好味走走</h1>`
```

After:

```ts
`<h1 class="splash-title text-title is-latin">Yummi Go 好味走走</h1>`
```

Repeat for:
- Auth login / signup titles → `text-h1`
- Auth subtitles → `text-body`
- Field labels → `text-mini`
- Buttons → `text-btn-m` (or `-l` per size)
- Onboarding title → `text-h2`
- Onboarding sub → `text-mini`

If a `.ts` file uses template-literal classes like `class="splash-title ${maybeActive ? 'is-active' : ''}"`, just append the utility class statically.

- [ ] **Step 4: Strip overlapping rules from bespoke classes in `globals.css`**

For each bespoke class that now has a utility class on its markup, remove the `font-size` and `font-weight` declarations from its CSS rule.

Example — `.splash-title`:

Before:

```css
.splash-title {
  font-size: var(--text-title-size);
  font-weight: var(--font-weight-black);
  color: var(--color-primary-dark);
  letter-spacing: -0.02em;
}
```

After:

```css
.splash-title {
  color: var(--color-primary-dark);
  letter-spacing: -0.02em;
}
```

The font sizing now comes from `text-title is-latin` on the markup.

- [ ] **Step 5: Run tests + typecheck**

```bash
npm test && npm run typecheck
```

Expected: pass.

- [ ] **Step 6: Visual eye-check**

```bash
npm run dev
```

Walk all major screens. Most should look identical. If anything's off, common causes:
- The bespoke class still has a stray `font-size` rule that overrides the utility — re-strip
- The utility class isn't applied because the markup uses dynamic class generation that didn't get touched — append the utility class

- [ ] **Step 7: Commit**

```bash
git add src/styles/tokens.css docs/tokens.css src/styles/globals.css src/routes/
git commit -m "refactor(styles): adopt typography utility classes on markup, strip overlapping CSS"
```

---

## Task 10: Phase β — Migrate raw `padding`/`margin` to spacing tokens

**Files:**
- Modify: `src/styles/globals.css`

- [ ] **Step 1: Replacement table**

Per spec § 8.1, replace each raw value:

| Raw | Token |
|---:|---|
| `4px` | `var(--space-1)` |
| `6px` | `var(--space-2)` (round up to 8) |
| `8px` | `var(--space-2)` |
| `10px` | `var(--space-3)` (round up to 12) |
| `12px` | `var(--space-3)` |
| `14px` | `var(--space-4)` (round up to 16) |
| `16px` | `var(--space-4)` |
| `18px` | `var(--space-5)` (round up to 20) |
| `20px` | `var(--space-5)` |
| `24px` | `var(--space-6)` |
| `32px` | `var(--space-8)` |
| `40px` | `var(--space-10)` |
| `1px`, `2px`, `3px` | **leave as raw** — these are border-width-like values for thin dividers; add `/* hairline, not spacing */` comment if context isn't obvious |

- [ ] **Step 2: Apply replacements**

Walk `src/styles/globals.css` top to bottom. For shorthand declarations like `padding: 8px 14px;`, each component rounds independently → `padding: var(--space-2) var(--space-4);`.

For `margin: 0 0 32px;` → `margin: 0 0 var(--space-8);`. Zeros stay literal `0`.

- [ ] **Step 3: Verify zero raw spacing remain (except hairlines)**

```bash
grep -nE "(padding|margin)[^-:]*:\s*[0-9]+(px|rem|em)" src/styles/globals.css | grep -v "hairline"
```

Expected: empty (or only entries containing `0` literals, which are fine).

- [ ] **Step 4: Run tests + typecheck**

```bash
npm test && npm run typecheck
```

- [ ] **Step 5: Visual eye-check**

```bash
npm run dev
```

Walk every major screen. Watch for cramped buttons (round-up should make things slightly looser, not tighter). If any specific element looks broken:
- Check if it was on a half-step value
- Either accept the new spacing or revert that one declaration to raw with a `/* one-off, off-scale */` comment

- [ ] **Step 6: Commit**

```bash
git add src/styles/globals.css
git commit -m "refactor(styles): migrate 106 raw padding/margin declarations to space tokens"
```

---

## Task 11: Phase γ — Add `--radius-xl` token

**Files:**
- Modify: `src/styles/tokens.css`
- Modify: `docs/tokens.css`

- [ ] **Step 1: Add the new token**

In the radius block of `src/styles/tokens.css` (around L155–159), insert:

```css
--radius-xl:   32px;       /* large rounded cards (daily mission, hero pill) */
```

After the existing `--radius-lg` line.

Mirror in `docs/tokens.css`.

- [ ] **Step 2: Run tests + typecheck**

```bash
npm test && npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add src/styles/tokens.css docs/tokens.css
git commit -m "feat(tokens): add --radius-xl (32px) for large rounded cards"
```

---

## Task 12: Phase γ — Migrate raw `border-radius` to radius tokens

**Files:**
- Modify: `src/styles/globals.css`

- [ ] **Step 1: Replacement table**

Per spec § 9.1:

| Raw | Token |
|---:|---|
| `8px` | `var(--radius-sm)` |
| `10px` | `var(--radius-md)` (round up to 16) |
| `12px` | `var(--radius-md)` (round up to 16) |
| `14px` | `var(--radius-md)` (round up to 16) |
| `16px` | `var(--radius-md)` |
| `18px` | `var(--radius-lg)` (round up to 24) |
| `24px` | `var(--radius-lg)` |
| `28px` | `var(--radius-xl)` (round up to 32) |
| `32px` | `var(--radius-xl)` |
| `999px`, `9999px` | `var(--radius-pill)` |
| `2px`, `3px`, `4px` | **leave as raw** — these are tiny accent radii on icons or small chips; add `/* tiny accent radius — not card-shaped */` comment |

- [ ] **Step 2: Apply replacements**

Walk `src/styles/globals.css` top to bottom.

- [ ] **Step 3: Verify zero raw radii remain (except tiny accents)**

```bash
grep -nE "border-radius:\s*[0-9]+(px|rem|em)" src/styles/globals.css | grep -v "tiny accent"
```

Expected: empty.

- [ ] **Step 4: Run tests + typecheck**

```bash
npm test && npm run typecheck
```

- [ ] **Step 5: Visual eye-check**

```bash
npm run dev
```

Walk major screens. Round-up should make corners slightly softer — generally fine. Watch specifically:
- Daily mission card (was 28px → now 32px): should look slightly more rounded, accept
- Auth error pill (was 12px → now 16px): slightly more pill-like, accept

If any element looks too soft, revert that one declaration to raw with a comment.

- [ ] **Step 6: Commit**

```bash
git add src/styles/globals.css
git commit -m "refactor(styles): migrate 102 raw border-radius declarations to radius tokens"
```

---

## Verification — final acceptance checklist

After Task 12 completes, run this end-to-end sweep:

- [ ] **Step 1: Token adoption rate ~ 1.0**

```bash
grep -cE "var\(--text-" src/styles/globals.css     # was 0, expect > 100
grep -cE "var\(--space-" src/styles/globals.css    # was 0, expect > 80
grep -cE "var\(--radius-" src/styles/globals.css   # was 0, expect > 80
grep -cE "var\(--font-weight-" src/styles/globals.css  # was 0, expect > 30
```

- [ ] **Step 2: All 21 sprite cells render**

Use the dev panel's `Pet LV1` reset + XP grant + day slider to walk every (stage, mood) combo. Each sprite swaps on `$pet` change without a 404 console error.

- [ ] **Step 3: Full test suite green**

```bash
npm test
```

Expected: all green. Should be 285+ tests (283 existing + new pet-sprites tests + revised PetView tests).

- [ ] **Step 4: Type check clean**

```bash
npm run typecheck
```

- [ ] **Step 5: No raw px values where tokens exist**

```bash
# typography
grep -nE "font-size:\s*[0-9]+(px|rem|em)" src/styles/globals.css | grep -v "emoji icon"
# spacing
grep -nE "(padding|margin)[^-:]*:\s*[0-9]+(px|rem|em)" src/styles/globals.css | grep -v "hairline"
# radius
grep -nE "border-radius:\s*[0-9]+(px|rem|em)" src/styles/globals.css | grep -v "tiny accent"
# font-weight
grep -nE "font-weight:\s*[0-9]+" src/styles/globals.css
```

All four should be empty.

- [ ] **Step 6: Tag the milestone**

```bash
git tag design-system-v1
git push origin design-system-v1
```

(Optional — only if the project tags milestones. Otherwise skip.)

---

## Rollback plan

If a phase causes visible regressions you can't pin down:

1. **Token migration phases (α/β/γ)**: revert the single migration commit (`git revert <sha>`). The raw px values come back; tokens stay defined but unused. No data loss.
2. **Sprite phase 1**: revert Task 2 + Task 3 commits — old class-based pet view comes back.
3. **Sprite phase 3 cleanup**: if you discover a sprite cell is broken AFTER deletion of `/pet-frog.png`, revert Task 5 to restore the legacy fallback while you regenerate the broken cell.

---

## Estimated effort

| Phase | Tasks | Time |
|---|---|---|
| 1 (sprite refactor) | 1, 2, 3 | ~2 hours |
| 2 (codex generation) | 4 | ~1–3 hours (depends on iteration count for style consistency) |
| 3 (cleanup) | 5 | ~30 min |
| α (typography) | 6, 7, 8, 9 | ~3 hours |
| β (spacing) | 10 | ~1 hour |
| γ (radius) | 11, 12 | ~1 hour |
| Verification | — | ~30 min |
| **Total** | 12 | **~9–11 hours** |
