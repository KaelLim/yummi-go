# Pet Sprite System + Full design.md Token Adoption — Design Spec

- **Date**: 2026-05-08
- **Branch**: `main`
- **Source of truth**:
  - `docs/design-system.md` (canonical design tokens — primary/secondary/neutrals/semantic + typography scale)
  - `docs/spec/spec-v1.4.txt` lines 542–593 (canonical pet evolution stages)
  - `design-assets/extracted/psd-previews/frog-2.png` (visual style reference for codex cli prompts)

---

## 1. Goals

Two parallel, but bundled, deliverables:

### 1A. Pet sprite system

Replace the single hard-coded `/public/pet-frog.png` (used by `PetView`, `profile/index`, `day-30`) with a 21-cell sprite matrix that maps `($pet.stage, $pet.mood)` to the correct artwork. Generate the artwork via codex cli using a 21-row prompt table that this spec defines; the user runs codex manually and drops PNGs into `/public/pet/<stage>/<mood>.png`.

### 1B. Full design.md token adoption

Migrate the codebase from raw `font-size: NNpx` / `padding: NNpx` / `border-radius: NNpx` declarations to `var(--text-*-size)` / `var(--space-*)` / `var(--radius-*)` from `src/styles/tokens.css`, AND adopt the `.text-h1 / .text-body / .text-btn-*` utility classes (currently 0% adoption) on component markup.

After both deliverables ship, design.md adoption rate ≈ 1.0 and the pet feels alive across its 5-stage evolution arc.

---

## 2. Non-goals

- **Multi-species selection.** Single species (frog), per spec-v1.4 ("守護者" is one entity).
- **Animation.** Each cell is a single static PNG. Stage/mood transitions are instant swaps.
- **New pet stages or new moods.** Stage list = spec-v1.4's 5 (`egg / baby / youth / adult / final`). Mood list = current code's 5 (`normal / happy / weak / critical / evolve`).
- **Backend or DB schema changes.** `pet_states.stage` and `pet_states.mood` columns already exist; no migrations.
- **Sprite sheet (single big PNG).** Each cell is its own file — codex cli generates one image at a time and a sprite-sheet workflow doesn't fit that.
- **Line-height token.** Out of scope for this iteration — line-heights stay raw.
- **Replacing existing color tokens.** `--color-*` adoption is already at 283 uses; this spec doesn't touch color.

---

## 3. Architecture

### 3.1 Sprite system data flow

```
                    $pet store (already exists)
                          │
                          │ { stage: 'baby', mood: 'happy', ... }
                          ▼
                ┌──────────────────────┐
                │  PetView component   │
                │  ProfileAvatar       │  ← three callers, all use the same helper
                │  Day30Pet            │
                └──────────┬───────────┘
                           │
                           ▼
            ┌──────────────────────────────────┐
            │  src/lib/pet-sprites.ts (NEW)    │
            │  spriteFor(stage, mood) → string │
            │  AVAILABLE map encodes which     │
            │  cells exist; missing moods      │
            │  fall back to 'normal' for that  │
            │  stage.                          │
            └──────────┬───────────────────────┘
                       │
                       ▼
            /public/pet/<stage>/<mood>.png   (21 static files)
```

### 3.2 File layout

```
public/pet/
├─ egg/
│  ├─ normal.png
│  └─ crack.png            ← egg's "evolve" mood maps to crack
├─ baby/
│  ├─ normal.png
│  ├─ happy.png
│  ├─ weak.png
│  ├─ critical.png
│  └─ evolve.png
├─ youth/                  (5 files, same shape as baby)
├─ adult/                  (5 files, same shape as baby)
└─ final/
   ├─ normal.png
   ├─ happy.png
   ├─ weak.png
   └─ critical.png         ← no evolve (max evolution)

Total: 2 + 5 + 5 + 5 + 4 = 21 PNGs
```

`/public/pet-frog.png` is kept temporarily during Phase 1 as a 404 fallback, deleted at end of Phase 3.

### 3.3 Image specs

| Property | Value | Rationale |
|---|---|---|
| Format | PNG, alpha channel | Transparent background lets pet sit over `--color-background` cream |
| Dimensions | 1024×1024 | Renders crisp at 2× retina (current usage caps around 200×200 in DOM) |
| Composition | Centered, ~80% canvas fill, leave 10% padding | Gives breathing room for shadow/glow effects via CSS |
| Background | Fully transparent | No solid bg, no shadow baked into PNG |

---

## 4. Sprite map + fallback rules (`src/lib/pet-sprites.ts`)

```ts
import type { PetStage } from './pet-evolution';

export type PetMood = 'normal' | 'happy' | 'weak' | 'critical' | 'evolve';

const AVAILABLE: Record<PetStage, ReadonlyArray<PetMood>> = {
  egg:   ['normal', 'evolve'],
  baby:  ['normal', 'happy', 'weak', 'critical', 'evolve'],
  youth: ['normal', 'happy', 'weak', 'critical', 'evolve'],
  adult: ['normal', 'happy', 'weak', 'critical', 'evolve'],
  final: ['normal', 'happy', 'weak', 'critical'],
};

export function spriteFor(stage: PetStage, mood: PetMood): string {
  const moods = AVAILABLE[stage];
  const resolved: PetMood = moods.includes(mood) ? mood : 'normal';
  // Egg's evolve mood maps to crack.png (not evolve.png) — it's the
  // "about to hatch" state, not a generic glow.
  const filename =
    stage === 'egg' && resolved === 'evolve' ? 'crack' : resolved;
  return `/pet/${stage}/${filename}.png`;
}
```

**Fallback semantics:**

| Stage | Mood asked | File served | Why |
|---|---|---|---|
| `egg` | `happy` / `weak` / `critical` | `egg/normal.png` | Eggs have no facial expression — fall back to neutral |
| `egg` | `evolve` | `egg/crack.png` | Special filename for the cracking state |
| `final` | `evolve` | `final/normal.png` | Already max — no further evolution |
| any | unknown string (defensive) | `<stage>/normal.png` | Future-proof against bad data |

**Why `AVAILABLE` not type-narrowing per stage:** simpler runtime check than 5 separate union types; the type system can't statically express "egg has only normal/evolve" without leaking type ergonomics into every caller. Centralized check is fine.

---

## 5. PetView refactor

### 5.1 Current (in `src/components/PetView.ts:32`)

```ts
<img class="pet-frog" src="/pet-frog.png" alt="守護者" draggable="false" />
```

Plus CSS in `src/styles/globals.css`:

```css
.pet-stage-egg .pet-shell { display: block; }     /* shows 🥚 emoji */
.pet-stage-egg .pet-frog { display: none; }
.pet-stage-baby .pet-frog { transform: scale(0.6); }
.pet-stage-youth .pet-frog { transform: scale(1.0); }
.pet-stage-adult .pet-frog { transform: scale(1.2); }
.pet-stage-max .pet-frog { transform: scale(1.4); animation: pet-rainbow ... }
.pet-mood-happy .pet-frog { filter: saturate(1.3) brightness(1.05); }
.pet-mood-weak .pet-frog { filter: saturate(0.5) brightness(0.95); }
.pet-mood-critical .pet-frog { filter: grayscale(0.8) brightness(0.85); }
.pet-mood-evolve .pet-frog { filter: drop-shadow(0 0 24px rgba(246, 252, 167, 0.8)); }
```

### 5.2 After

Component reads `$pet.stage / $pet.mood`, calls `spriteFor()`, sets `<img src>` directly. No more emoji shell, no more CSS scaling per stage, no more CSS filters per mood — the new artwork bakes those qualities in.

Three caller sites all migrate the same way:

| File | Line | Old | New |
|---|---|---|---|
| `src/components/PetView.ts` | ~32 | `src="/pet-frog.png"` | `src={spriteFor(stage, mood)}` (re-bound on store change) |
| `src/routes/profile/index.ts` | ~81 | hard-coded `src="/pet-frog.png"` + emoji shell at L82 | same `spriteFor()` call; emoji shell deleted |
| `src/routes/day-30.ts` | ~48 | hard-coded `src="/pet-frog.png"` | `src={spriteFor('final', 'happy')}` (day-30 always shows max-evolution celebrating) |

CSS to remove from `src/styles/globals.css`:
- `.pet-shell` styles for egg fallback (no longer needed)
- All `.pet-stage-* .pet-frog` transform rules
- All `.pet-mood-* .pet-frog` filter rules
- `@keyframes pet-rainbow` (final stage's CSS rainbow effect — replaced by static art)

What stays in CSS:
- `.pet-view` outer sizing
- `.pet-frog` base image rules (width/height/object-fit)
- `.pet-accessory` overlay slot

### 5.3 lifecycle.bind integration

PetView already uses `lifecycle.bind` to subscribe to `$pet` (per the existing pattern in the codebase). The `<img>` src must update when stage/mood changes. Implementation: store the `<img>` ref via `data-bind="pet-img"` and inside the bind callback, set `imgEl.src = spriteFor(s.stage, s.mood)`.

---

## 6. codex cli prompt table

### 6.1 Prompt template

Every row uses this skeleton:

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

### 6.2 21-row matrix

| # | Stage | Mood | File path | STAGE_DESCRIPTION | MOOD_DESCRIPTION | POSE |
|---:|---|---|---|---|---|---|
| 1 | egg | normal | `pet/egg/normal.png` | a smooth pale-cream egg with subtle warm-orange speckles, sitting upright on its rounded base, no face | calm, neutral, slight blush of warmth | egg upright, gently rocked left |
| 2 | egg | crack | `pet/egg/crack.png` | the same pale-cream egg, but with two visible jagged cracks branching across the top half; a tiny fragment of green peeks through one crack | excited, about-to-hatch energy | egg upright, faint motion lines suggesting wobble |
| 3 | baby | normal | `pet/baby/normal.png` | a small chubby green frog hatchling, ~2:1 head-to-body ratio, big round eyes, simple smile | calm, content | sitting on hind legs, hands resting in front |
| 4 | baby | happy | `pet/baby/happy.png` | same baby frog | beaming smile, eyes squinted upward in joy, a small sparkle near one cheek | both arms raised slightly outward |
| 5 | baby | weak | `pet/baby/weak.png` | same baby frog | drooping eyes, tiny mouth turned down, slumped posture | sitting, head tilted forward, one hand on belly |
| 6 | baby | critical | `pet/baby/critical.png` | same baby frog | wide worried eyes, anxious open mouth, single sweat-drop on forehead | hands clasped near chest, body slightly curled |
| 7 | baby | evolve | `pet/baby/evolve.png` | same baby frog with a soft warm aura | determined eyes, slight smile, body subtly glowing | standing on hind legs, arms outstretched |
| 8 | youth | normal | `pet/youth/normal.png` | medium-sized green frog, taller and slimmer than baby, ~3:1 head-to-body, more defined limbs | calm, observant | standing upright, arms at sides |
| 9 | youth | happy | `pet/youth/happy.png` | same youth frog | wide grin, eyes closed in joy | one arm raised in a wave |
| 10 | youth | weak | `pet/youth/weak.png` | same youth frog | tired half-lidded eyes, small frown | shoulders slumped, leaning slightly |
| 11 | youth | critical | `pet/youth/critical.png` | same youth frog | distressed eyes, open frown, beads of sweat | one hand to forehead, body tilted back |
| 12 | youth | evolve | `pet/youth/evolve.png` | same youth frog with a brighter warm-yellow aura around silhouette | determined, eyes wide with resolve | both arms raised, looking upward |
| 13 | adult | normal | `pet/adult/normal.png` | full-grown green frog, balanced proportions ~4:1, more refined detail, subtle leaf-pattern on shoulders | confident, calm authority | standing tall, hands at sides |
| 14 | adult | happy | `pet/adult/happy.png` | same adult frog | warm smile, gentle squinted eyes | arms open in a welcoming gesture |
| 15 | adult | weak | `pet/adult/weak.png` | same adult frog | weary expression, lowered eyes | stooped posture, one hand on knee |
| 16 | adult | critical | `pet/adult/critical.png` | same adult frog | alarmed eyes wide open, mouth tight | both hands raised defensively, body slightly back |
| 17 | adult | evolve | `pet/adult/evolve.png` | same adult frog with a strong golden aura, faint particle effects | resolved, eyes bright with energy | arms raised triumphantly, looking up |
| 18 | final | normal | `pet/final/normal.png` | radiant green frog with subtle gold-leaf accents on shoulders and a small floating leaf or halo above its head | serene pride, eyes warm and steady | standing gracefully, one hand on chest |
| 19 | final | happy | `pet/final/happy.png` | same final-form frog | radiant smile, eyes squinted in pure joy, gentle sparkles around | both arms raised in celebration |
| 20 | final | weak | `pet/final/weak.png` | same final-form frog (the gold accents are slightly dimmer) | tired smile, eyes half-closed | sitting cross-legged, hands on knees |
| 21 | final | critical | `pet/final/critical.png` | same final-form frog (gold accents very faint) | concerned eyes, lips pressed | standing, one hand reaching toward viewer |

### 6.3 Generation workflow

1. User opens codex cli.
2. For each row, paste the template + that row's STAGE/MOOD/POSE substituted in.
3. Save the output to the file path in column 4.
4. After all 21 are generated, smoke-test by loading `/pet/baby/happy.png` etc. directly in browser.
5. Re-generate any cells that don't match the style.

---

## 7. design.md token adoption — Phase α (typography)

### 7.1 Inventory (from grep on `src/styles/globals.css`)

161 raw `font-size` declarations using these unique values:

| Raw px | Token match | Action |
|---:|---|---|
| 12 | `--text-caption-size` ✓ | Direct replace `var(--text-caption-size)` |
| 16 | `--text-body-size` ✓ | Direct replace |
| 18 | `--text-button-m-size` ✓ | Direct replace |
| 20 | `--text-button-l-size` ✓ | Direct replace |
| 24 | `--text-h3-size` / `--text-button-xl-size` ✓ | Direct replace (pick by semantic role) |
| 28 | `--text-h2-size` ✓ | Direct replace |
| 48 | `--text-title-size` ✓ | Direct replace |
| 10, 11 | none | Round up to 12 (`--text-caption-size`) — accept tiny visual change |
| 13, 14, 15 | none | Round to 16 — but this is a **2–3px visual increase**; alternative: add `--text-mini-size: 14px` token. Decision: **add `--text-mini-size: 14px`** so labels/captions don't bloom |
| 17 | `--text-button-m-size` (18) ✓ | Round up to 18 |
| 22 | none | Round down to `--text-button-l-size` (20) |
| 26, 30, 32, 44 | none | These are uncommon one-offs in splash/auth headers. Decision: **add `--text-display-size: 32px`** for splash titles; round 26→28, 30→33, 44→48 |
| 56, 64, 100, 120 | none | These are emoji icon sizes (e.g., `.oath-icon`), not text. Leave raw with `/* emoji icon size */` comment |

**Net new tokens added** in `src/styles/tokens.css`:

```css
--text-mini-size:    14px;  /* below body, used for labels and dense UI */
--text-display-size: 32px;  /* between h2 and title, used for splash hero */
```

### 7.2 Utility class adoption

Currently 0% — none of `text-title / text-h1 / text-h2 / text-h3 / text-body / text-caption / text-btn-xl / text-btn-l / text-btn-m` are referenced in `.ts` files. After Phase α, the 161 raw declarations split into:

- **Most** consumed by adding the appropriate utility class to the markup (e.g., onboarding `<h1 class="text-h2">…</h1>` instead of `.onb-title { font-size: 28px; font-weight: 800 }` in CSS)
- **Remaining** scoped CSS cases use the var directly: `font-size: var(--text-body-size); font-weight: var(--text-body-weight-cjk);`

### 7.3 Font-weight

Currently 5 unique raw values: 500, 600, 700, 800, 900. All match tokens (`--font-weight-medium / -semibold / -bold / -extrabold / -black`). Direct replace, no rounding needed.

### 7.4 Latin-only override

Splash title `.splash-title` currently uses `font-weight: 900` — this is the Nunito Black weight per design.md spec. Apply utility class with `is-latin` modifier: `<h1 class="text-title is-latin">Yummi Go 好味走走</h1>`.

---

## 8. design.md token adoption — Phase β (spacing)

### 8.1 Inventory

106 raw `padding/margin: NNpx` declarations using these values:

| Raw px | Token match | Action |
|---:|---|---|
| 4 | `--space-1` ✓ | Direct |
| 8 | `--space-2` ✓ | Direct |
| 12 | `--space-3` ✓ | Direct |
| 16 | `--space-4` ✓ | Direct |
| 20 | `--space-5` ✓ | Direct |
| 24 | `--space-6` ✓ | Direct |
| 32 | `--space-8` ✓ | Direct |
| 40 | `--space-10` ✓ | Direct |
| 6 | none | Round up to 8 (`--space-2`) — diff is 2px, low risk |
| 10 | none | Round up to `--space-3` (12). Apply uniformly — don't split vertical/horizontal cases, that complicates review. |
| 14 | none | Round up to `--space-4` (16). |
| 18 | none | Round up to `--space-5` (20). Both 16 and 20 are equidistant; prefer rounding **up** so layouts breathe rather than tighten. |
| (multi-value shorthand, e.g. `padding: 8px 14px`) | mixed | Each component rounds per the rules above (→ `padding: var(--space-2) var(--space-4)` for that example). |
| 1, 2, 3 | none | These are border widths (e.g., `padding: 1px 0` for tab divider). Leave raw — they're not spacing. |

**Net new tokens added**: zero. Round to closest existing scale.

### 8.2 Multi-value padding

Many declarations are shorthand: `padding: 8px 14px;` — these become `padding: var(--space-2) var(--space-4);` (per the round-up rule, 14→16). Spot-check the most prominent buttons after migration; if any look noticeably looser, override with a one-off raw value rather than dragging a half-step token into the system.

---

## 9. design.md token adoption — Phase γ (radius)

### 9.1 Inventory

102 raw `border-radius` declarations:

| Raw px | Token match | Action |
|---:|---|---|
| 8 | `--radius-sm` ✓ | Direct |
| 16 | `--radius-md` ✓ | Direct |
| 24 | `--radius-lg` ✓ | Direct |
| 999, 9999 | `--radius-pill` ✓ | Direct |
| 10 | none | Round up to `--radius-md` (16). Apply uniformly. |
| 12, 14 | none | Round up to `--radius-md` (16). |
| 18 | none | Round up to `--radius-lg` (24). Same rule as spacing — round up so corners feel softer rather than tighter. |
| 28, 32 | none | Add `--radius-xl: 32px`? Or round to 24? Decision: **add `--radius-xl: 32px`** — large pill-like cards (e.g., daily mission card) need a distinct value |
| 2, 3, 4 | none | Tiny radii on icons / accents. Leave raw with comment — they're not "card-shaped" |

**Net new tokens added**:

```css
--radius-xl: 32px;  /* large rounded cards (daily mission, hero pill) */
```

---

## 10. Error handling & edge cases

### 10.1 Missing image fallback

When the browser fails to load `/pet/<stage>/<mood>.png` (HTTP 404 — image not yet generated by codex), the `<img>` triggers `onerror`. Implementation: bind a single `onerror` handler that swaps to `/pet-frog.png` (the legacy file kept as fallback during Phase 1–2, deleted in Phase 3 once all 21 are confirmed loading).

```ts
imgEl.addEventListener('error', () => {
  if (imgEl.src.endsWith('/pet-frog.png')) return; // already at fallback
  imgEl.src = '/pet-frog.png';
});
```

### 10.2 Bad data in `pet_states`

If `$pet.stage` somehow contains an unknown string (e.g., from a future schema mismatch), `spriteFor` defaults to the `egg/normal.png` path because `AVAILABLE[unknownStage]` is `undefined`. Defensive check:

```ts
if (!AVAILABLE[stage]) return '/pet/egg/normal.png';
```

### 10.3 Cache poisoning

If we ever regenerate art and want users on the deployed PWA to see the new version, the service worker must invalidate. Two options:
- Append `?v=N` query string on each release
- Use Workbox's CacheFirst with a `version` parameter in the SW config

For the initial deploy this isn't relevant (first time these paths exist). Document for future updates: "When a sprite cell is regenerated, bump `PET_SPRITE_VERSION` in `src/lib/pet-sprites.ts` so cached entries are skipped."

---

## 11. Testing

### 11.1 Unit tests (vitest)

`src/lib/__tests__/pet-sprites.test.ts` — new file:

- `spriteFor('egg', 'normal')` → `/pet/egg/normal.png`
- `spriteFor('egg', 'happy')` → `/pet/egg/normal.png` (fallback)
- `spriteFor('egg', 'evolve')` → `/pet/egg/crack.png` (special)
- `spriteFor('baby', 'happy')` → `/pet/baby/happy.png`
- `spriteFor('final', 'evolve')` → `/pet/final/normal.png` (fallback)
- `spriteFor('final', 'critical')` → `/pet/final/critical.png`
- All 21 valid combinations resolve to the file paths matching § 3.2

### 11.2 Component tests

Update `src/components/__tests__/PetView.test.ts`:

- After mounting with `$pet = { stage: 'baby', mood: 'happy' }`, `<img src>` ends with `/pet/baby/happy.png`
- After `$pet.set({ stage: 'youth', mood: 'normal' })`, `<img src>` updates to `/pet/youth/normal.png`
- Removed assertions: no longer check for `🥚` shell text or scale CSS class

### 11.3 Integration / smoke

After the 21 PNGs are dropped in, manually verify:

- Home route shows correct sprite for current `$pet`
- Profile shows the same sprite
- Day-30 shows `final/happy`
- Dev panel "Pet LV1" reset → page should re-render with `egg/normal`

### 11.4 Visual regression

Out of scope for this iteration — no screenshot diff infra. Manual eye-check after each phase.

---

## 12. Implementation phasing

The spec is bundled, but the implementation is sequenced to keep each phase verifiable:

| Phase | Subject | Verification |
|---|---|---|
| **1** | `lib/pet-sprites.ts` + `PetView` refactor + `onerror` fallback to legacy `/pet-frog.png` | Unit tests pass; UI looks unchanged (still shows old frog because new files don't exist yet) |
| **2** | Drop 21 PNGs into `/public/pet/<stage>/<mood>.png` (codex cli output) | Open each file in browser; cycle stages via dev panel and visually verify each cell |
| **3** | Delete `/public/pet-frog.png`, remove `.pet-stage-*` CSS scaling, remove `.pet-mood-*` CSS filters, remove `@keyframes pet-rainbow` | Full UI walk; all stages/moods visually correct without CSS effects |
| **α** | Typography adoption: utility classes + `var(--text-*-size)` + `var(--font-weight-*)` (with new `--text-mini-size`, `--text-display-size`) | Visual diff against baseline; type-check; tests pass |
| **β** | Spacing adoption: 106 raw → `var(--space-*)` with rounding | Visual diff; layout regression check |
| **γ** | Radius adoption: 102 raw → `var(--radius-*)` (with new `--radius-xl`) | Visual diff |

Phases 1–3 (sprite) and α–γ (tokens) are independent — α can start in parallel with Phase 1. The implementation plan should sequence them so each lands in its own commit for clean review.

---

## 13. Risks & open items

| # | Risk | Mitigation |
|---|---|---|
| 1 | codex cli generates 21 frogs that don't visually match each other | Generate baseline `egg/normal.png` and `final/normal.png` first; if they read as the "same character" the rest of the prompts work; if not, refine the style reference paragraph and regenerate |
| 2 | Round-down spacing (Phase β) makes some buttons feel cramped | Spot-check the 5 most prominent CTAs after migration; if any look broken, override to a one-off raw value |
| 3 | New utility class adoption (Phase α) causes specificity wars with existing class-name CSS | Where conflict arises, prefer the utility class and remove the duplicate CSS rule; do not add `!important` |
| 4 | `final/happy` for day-30 looks too similar to `final/normal` | If indistinguishable, regenerate `final/happy` with an obviously celebratory pose |
| 5 | Service worker caches the old `/pet-frog.png` during Phase 2 | Manual hard-reload during local testing; documented in § 10.3 for future regenerations |

---

## 14. Out-of-spec future work

Worth noting so they aren't sneaked into this implementation:

- **Multi-species**: spec-v1.4 doesn't define species selection; if PM wants 3 species later it's a clean addition (just add `species` to `$pet` and to `spriteFor`)
- **Idle / blink animation**: 2-frame blink loop on the eyes; would need `<video>` or sprite-frame swap, well out of scope
- **Lottie / SVG version**: would scale better but requires a totally different art pipeline
- **`@keyframes pet-rainbow`**: removed in Phase 3 — if a celebratory effect is wanted at LV80+, the new `final/happy` art should bake it in, not CSS

---

## 15. Acceptance

This spec is complete when:

- All 13 sections above describe concrete, testable work
- 21 codex prompt rows are ready to paste
- File paths and code APIs are unambiguous
- The implementation can be split across 6 phases (1, 2, 3, α, β, γ) and each phase has its own verification step

Next: `superpowers:writing-plans` translates this spec into a sequenced implementation plan.
