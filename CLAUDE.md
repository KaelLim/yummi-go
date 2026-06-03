# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Dev server → http://localhost:5173/
npm run build        # tsc --noEmit + vite build → dist/
npm run preview      # Preview production build locally
npm run test         # Vitest watch mode
npm run test:run     # Single test run (CI)
npm run deploy       # Build + deploy to Cloudflare Pages via wrangler
```

No separate lint command — TypeScript strict mode (`tsc --noEmit`) enforces correctness at build time.

**Environment setup:**
```bash
cp .env.example .env
# Set VITE_DRUST_BASE and VITE_DRUST_ANON_TOKEN
```

## Architecture

Yummi Go 好味走走 is a 30-day vegan-challenge PWA. Stack: Vite 8 + vanilla TypeScript, nanostores for state, hash-based SPA router, drust SQLite BaaS for persistence, Cloudflare Pages for hosting.

### Data flow

```
drust (authoritative SQLite)
  → bootstrapFromStorage on app boot
  → nanostores atoms (reactive, in-memory)
  → vanilla TS components (DOM mutation, no framework)
```

### Key layers

**`src/api/`** — drust HTTP client + domain modules (`auth`, `pet`, `check-ins`, `wallet`, `xp-wallet`, `content`, `reviews`, `events`). Core client in `drust.ts`. Four anon RPCs: `login`, `get_user_full`, `get_day_script`, `random_quiz`.

**`src/store/`** — 7 nanostores atoms: `$user/$profile/$isLoggedIn` (identity), `$pet/$gems` (pet + wallet), `$today/$challenge` (current day), `$ui` (theme/dev/time mode), `$checkin` (draft meal during photo flow). `day-sync.ts` auto-advances day at midnight.

**`src/router.ts`** — Hash-based (`#/home`, `#/check-in`). Each route is a lazy-imported module with a default export. Most routes wrap in `createLayout()` in `src/components/Layout.ts` to preserve TabBar across navigation.

**`src/routes/`** — 20+ screens: `splash` → `login`/`register` → `onboarding/` (7 steps) → `home` → `check-in/` (5 steps) → `map`, `tasks/`, `profile/`, `day-30`. Dev flow visualizer at `routes/dev/flows.ts`.

**`src/lib/`** — Pure utilities: `pet-evolution.ts` (5 stages, LV1–100, 30–150 XP per level), `xp-calc.ts` (meal → XP), `mock-ai.ts` (fake food scanner, no real ML), `time.ts` (3 modes: real / compressed 30s-per-day / manual slider), `hash.ts` (sha256 password), `storage.ts` (localStorage keys).

**`src/components/`** — Layout shell, TabBar (5 tabs), PetView (SVG + CSS stage filters), DevPanel (floating debug), InstallPrompt (PWA), and design-system widgets (Button, Card, Modal, Sheet, Progress, Tag, Banner, FilterChip).

### drust quirks

- The `list` endpoint ignores filter query strings (`?id=eq.X`) and caps results at 20 rows. Single-record lookups use path-based GET; FK lookups fetch the page and filter client-side.
- Once a table exceeds the row cap, route fetches through a server-side RPC instead.

### Auth

Prototype-grade: anon token lives in the bundle. Password hashed as `sha256(password + ':' + username)`. Guest accounts use auto-generated `guest_<hex>` credentials. Session stored in localStorage under `KEYS.USER_ID`.

### Dev mode

Append `?dev` to any URL to enable DevPanel (floating wrench). Supports time-mode toggle (real / compressed / manual), day slider 1–30, and theme toggle. Compressed mode runs the full 30-day arc in ~15 minutes.

### Testing

79 test files, 280+ tests. Uses Vitest + jsdom + @testing-library/dom. Setup file: `src/test-setup.ts`. Tests cover store subscriptions, route resolution, component snapshots, and mock drust responses.

### Path alias

`@/*` maps to `./src/*` (configured in `tsconfig.json` and `vite.config.ts`).

## Docs

Detailed documentation lives in `docs/`:
- `STORAGE.md` — field-by-field reference for all 12 drust collections
- `design-system.md` — color palette and typography rules
- `workflow.md` — user flow diagrams (onboarding + daily loop)
- `plans/` — implementation specs and 78-task breakdown
- `superpowers/` — deep-dive architecture docs
