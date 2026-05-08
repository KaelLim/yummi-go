# Yummi Go PWA Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a complete Yummi Go PWA (5 modules) backed by drust, sufficient to demo the spec end-to-end with mock food scanning and OSM-based map.

**Architecture:** Vite + Vanilla TS + nanostores reactive state + Workbox SW. Hash routing with file-based route modules. drust REST + RPC for backend (no Firebase, no JWT). Pre-seed quiz/challenge/restaurant content from techfile CSVs.

**Tech Stack:** Vite 5, TypeScript 5, nanostores, Leaflet, vite-plugin-pwa, Vitest (tests), Material Symbols (icons), Nunito + Noto Sans TC.

**Reference:** See `docs/plans/2026-05-07-yummi-go-pwa-design.md` for the full design.

---

## Phase 0 — Project Init (Tasks 1-6)

### Task 1: Create project folder + git

**Files:**
- Create: `yummi-go-pwa/`

**Steps:**
1. `mkdir yummi-go-pwa && cd yummi-go-pwa`
2. `git init -b main`
3. `npm create vite@latest . -- --template vanilla-ts` (when prompted, select `vanilla-ts`)
4. `npm install`
5. Verify `npm run dev` works at http://localhost:5173
6. Commit: `git add -A && git commit -m "feat: bootstrap Vite + vanilla TS"`

### Task 2: Install runtime deps

**Steps:**
1. `npm install nanostores leaflet`
2. `npm install -D @types/leaflet vite-plugin-pwa workbox-window`
3. `npm install -D vitest @vitest/ui jsdom @testing-library/dom`
4. Commit: `git add package.json package-lock.json && git commit -m "feat: add nanostores, leaflet, vite-plugin-pwa, vitest"`

### Task 3: tsconfig + paths

**Files:**
- Modify: `yummi-go-pwa/tsconfig.json`

**Add `paths` so `@/...` resolves to `src/...`:**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUnusedLocals": false,
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] },
    "lib": ["ES2022", "DOM", "DOM.Iterable"]
  },
  "include": ["src", "scripts"]
}
```

Also create `vite.config.ts`:

```typescript
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Yummi Go 好味走走',
        short_name: 'Yummi Go',
        theme_color: '#1d5937',
        background_color: '#fef9ed',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        runtimeCaching: [
          { urlPattern: /^https:\/\/tool\.tzuchi-org\.tw\/.*/, handler: 'NetworkFirst' },
          { urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/, handler: 'CacheFirst' },
          { urlPattern: /^https:\/\/(a|b|c)\.tile\.openstreetmap\.org\/.*/, handler: 'CacheFirst' },
        ],
      },
    }),
  ],
});
```

Commit: `git add tsconfig.json vite.config.ts && git commit -m "chore: tsconfig paths + vite-pwa config"`

### Task 4: Folder skeleton

```bash
cd yummi-go-pwa/src
mkdir -p api store lib components routes/onboarding routes/map routes/check-in routes/tasks routes/profile routes/challenge styles
```

Move existing `style.css` → `src/styles/globals.css`. Copy `../tokens.css` → `src/styles/tokens.css`.

Update `src/main.ts`:
```typescript
import './styles/tokens.css';
import './styles/globals.css';
console.log('Yummi Go boot');
```

Commit: `git add -A && git commit -m "chore: scaffold folder structure"`

### Task 5: Vitest config + smoke test

**Files:**
- Create: `vitest.config.ts`
- Create: `src/__tests__/smoke.test.ts`

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import path from 'path';
export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  test: { environment: 'jsdom', globals: true },
});
```

```typescript
// src/__tests__/smoke.test.ts
import { describe, it, expect } from 'vitest';
describe('smoke', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

Add npm script: `"test": "vitest"`, `"test:run": "vitest run"`.

Run `npm run test:run` → expect PASS.

Commit: `git add -A && git commit -m "chore: vitest setup + smoke test"`

### Task 6: index.html + Material Symbols + fonts

**Files:**
- Modify: `index.html`

```html
<!doctype html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
  <meta name="theme-color" content="#1d5937" />
  <link rel="icon" href="/icon-192.png" />
  <link rel="apple-touch-icon" href="/icon-192.png" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Noto+Sans+TC:wght@300;500;700;900&display=swap" rel="stylesheet" />
  <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,400..700,0..1,-50..200" rel="stylesheet" />
  <title>Yummi Go 好味走走</title>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

Run `npm run dev`, verify head loads, no console errors.

Commit: `git add index.html && git commit -m "feat: setup HTML shell with fonts + theme-color"`

---

## Phase 1 — Drust Schema + Seed (Tasks 7-12) ✅ **DONE 2026-05-07**

> **Status:** Phase 1 已於 2026-05-07 完成（在主要 Yummi Go 專案資料夾中執行）。
> - 12 個 collections 已建立（all `anon_caps: ["select","insert","update","delete"]`）
> - 4 個 anon-callable RPCs：`login`、`get_user_full`、`random_quiz`、`get_day_script`
> - Seed 結果：`restaurants`=12、`challenge_scripts`=30 (Day 1-30)、`quiz_questions`=95
> - Seed 腳本保留在 `_seed_drust.py`（含 rate-limit retry）
>
> 後續 PWA 開發可直接跳到 Phase 2（純邏輯 libs）。

### Task 7: Create 11 collections via MCP

Use `mcp__drust__create_collection` for each (call sequentially):

```
users (username TEXT UNIQUE, password_hash TEXT, display_name TEXT, oath_signed_at TEXT, created_at TEXT)
user_profiles (user_id INTEGER, diet_type TEXT, challenge_level INTEGER, eat_times TEXT, known_from TEXT, baseline TEXT)
pet_states (user_id INTEGER, level INTEGER, current_xp INTEGER, accumulated_xp INTEGER, stage TEXT, mood TEXT, last_fed_at TEXT)
gem_balances (user_id INTEGER, balance INTEGER, total_earned INTEGER, total_spent INTEGER)
makeup_cards (user_id INTEGER, card_count INTEGER, fragment_count INTEGER)
check_ins (user_id INTEGER, day_number INTEGER, meal_index INTEGER, timestamp TEXT, food_items TEXT, nutrition TEXT, vegan_type TEXT, was_meat_replaced INTEGER, lucky_color_matched INTEGER, xp_earned INTEGER, gems_earned INTEGER)
daily_progress (user_id INTEGER, day_number INTEGER, missions_done TEXT, total_xp INTEGER, lucky_color TEXT, completed_at TEXT)
quiz_attempts (user_id INTEGER, question_id INTEGER, answer TEXT, correct INTEGER, attempted_at TEXT)
restaurant_reviews (user_id INTEGER, restaurant_id INTEGER, rating INTEGER, text TEXT, photo_id TEXT, vegan_type TEXT, status TEXT, created_at TEXT)
restaurants (name TEXT, address TEXT, lat REAL, lng REAL, place_type TEXT, pin_color TEXT, is_partner INTEGER, partner_discount TEXT)
quiz_questions (source TEXT, category TEXT, question TEXT, option_a TEXT, option_b TEXT, option_c TEXT, correct_answer TEXT, explanation TEXT)
challenge_scripts (day_number INTEGER, lucky_color TEXT, greeting TEXT, action_type TEXT, task_description TEXT, bonus_challenge TEXT, fog_reduction_pct INTEGER)
```

Verify with `mcp__drust__list_collections` → expect 12 collections (11 above + auto-counts).

### Task 8: Create auth RPCs via MCP

Call `mcp__drust__create_rpc` three times:

**RPC 1: register**
```sql
-- name: register
-- params: $1=username TEXT, $2=password_hash TEXT, $3=display_name TEXT
-- anon_callable: true
INSERT INTO users (username, password_hash, display_name, created_at)
VALUES ($1, $2, $3, datetime('now'))
RETURNING id;
```
(Then write a stored procedure or chain inserts for default rows in user_profiles/pet_states/gem_balances/makeup_cards. drust may need separate RPC or do client-side after register.)

**RPC 2: login**
```sql
-- name: login
-- params: $1=username TEXT, $2=password_hash TEXT
-- anon_callable: true
SELECT id, display_name FROM users WHERE username = $1 AND password_hash = $2 LIMIT 1;
```

**RPC 3: bootstrap_user** (called immediately after register to seed default rows)
```sql
-- name: bootstrap_user
-- params: $1=user_id INTEGER
-- anon_callable: true
-- (Multi-statement; if drust doesn't support, split or do client-side)
INSERT INTO user_profiles (user_id) VALUES ($1);
INSERT INTO pet_states (user_id, level, current_xp, accumulated_xp, stage, mood) VALUES ($1, 1, 0, 0, 'egg', 'normal');
INSERT INTO gem_balances (user_id, balance, total_earned, total_spent) VALUES ($1, 0, 0, 0);
INSERT INTO makeup_cards (user_id, card_count, fragment_count) VALUES ($1, 0, 0);
```

Verify with `mcp__drust__list_rpc`.

### Task 9: Verify schema with sample insert

Use `mcp__drust__call_rpc` to test `register` with dummy values, then `bootstrap_user`, then query `users` to confirm. Then `mcp__drust__delete_record` to clean.

Commit (in design folder, not yummi-go-pwa): `git add -A && git commit -m "feat: drust schema + auth RPCs created (admin task, no code)"`

### Task 10: Seed quiz_questions from CSV

**Files:**
- Create: `yummi-go-pwa/scripts/seed-quiz.ts`
- Create: `yummi-go-pwa/.env`

`.env`:
```
DRUST_BASE=https://tool.tzuchi-org.tw/drust/t/fec8119d-0231-40f7-a7d6-c580ad312e96
DRUST_ADMIN_TOKEN=drust_fnP0LgDqudndlocHNG3yHbMQTpGQEY_qMdqbVWayqHg
DRUST_ANON_TOKEN=drust_GaKEqSNtWqoo9fMofnbxZn2ymDZPDVrXFYhfkmDbv3M
```

`scripts/seed-quiz.ts`:
```typescript
import fs from 'node:fs';
import path from 'node:path';
import 'dotenv/config';

const CSV = path.resolve('../techfile/Yummi Go Content Database.xlsx - Quiz Database Default (Traditional CH).csv');
const BASE = process.env.DRUST_BASE!;
const TOKEN = process.env.DRUST_ADMIN_TOKEN!;

function parseCSV(text: string): string[][] {
  // simple CSV with quoted fields supporting embedded commas/newlines
  const rows: string[][] = []; let cur: string[] = []; let field = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i+1] === '"') { field += '"'; i++; } else if (c === '"') q = false; else field += c; }
    else { if (c === '"') q = true; else if (c === ',') { cur.push(field); field = ''; } else if (c === '\n') { cur.push(field); rows.push(cur); cur = []; field = ''; } else if (c !== '\r') field += c; }
  }
  if (field || cur.length) { cur.push(field); rows.push(cur); }
  return rows;
}

async function main() {
  const text = fs.readFileSync(CSV, 'utf-8');
  const rows = parseCSV(text).slice(1).filter(r => r[3]); // skip header, require Question
  console.log(`Parsed ${rows.length} questions`);

  for (const r of rows) {
    const [source, , category, question, a, b, c, correct, explanation] = r;
    const body = {
      source: source || '',
      category: category || '',
      question: question || '',
      option_a: a || '',
      option_b: b || '',
      option_c: c || '',
      correct_answer: correct || '',
      explanation: explanation || '',
    };
    const res = await fetch(`${BASE}/collections/quiz_questions/records`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) console.error('FAIL', await res.text());
  }
  console.log('Done');
}
main();
```

Add npm scripts:
```json
"seed:quiz": "node --import tsx scripts/seed-quiz.ts",
```

Install tsx + dotenv: `npm install -D tsx dotenv`

Run `npm run seed:quiz` → verify with MCP `count_rows` on `quiz_questions` (~140).

Commit: `git add -A && git commit -m "feat: seed quiz_questions from CSV"`

### Task 11: Seed challenge_scripts from CSV

**Files:**
- Create: `yummi-go-pwa/scripts/seed-challenge.ts`

Similar CSV-parsing pattern targeting `30天挑戰腳本與每日任務.csv`. Map columns: 天數 → day_number, 今日幸運色 → lucky_color (extract first line after split by 換行), 每日首頁挑戰問候語 → greeting, 建議搭配之環保任務 → action_type + task_description + bonus_challenge.

Add `"seed:challenge": "..."`. Run, verify ~30 rows in MCP.

Commit: `git add -A && git commit -m "feat: seed challenge_scripts from CSV"`

### Task 12: Seed restaurants (self-authored)

**Files:**
- Create: `yummi-go-pwa/scripts/seed-restaurants.ts`

12 hardcoded entries:

```typescript
const RESTAURANTS = [
  { name: '蓮香齋', address: '台北市中正區羅斯福路一段18號', lat: 25.0339, lng: 121.5197, place_type: 'chinese', pin_color: 'green', is_partner: 0 },
  { name: 'Veganday 純素之日', address: '台北市大安區忠孝東路四段181巷7-1號', lat: 25.0418, lng: 121.5526, place_type: 'western', pin_color: 'green', is_partner: 1, partner_discount: '8 折' },
  { name: '小小樹食 大安店', address: '台北市大安區四維路14巷6號', lat: 25.0353, lng: 121.5480, place_type: 'western', pin_color: 'green', is_partner: 0 },
  { name: 'Plants 純植物餐廳', address: '台北市大安區安和路一段21巷23號', lat: 25.0375, lng: 121.5494, place_type: 'western', pin_color: 'green', is_partner: 1, partner_discount: '免費飲品' },
  { name: '禪風茶樓', address: '台北市信義區松壽路11號', lat: 25.0364, lng: 121.5683, place_type: 'chinese', pin_color: 'gray', is_partner: 0 },
  { name: '草盛園', address: '台北市中山區雙城街9-1號', lat: 25.0641, lng: 121.5238, place_type: 'chinese', pin_color: 'green', is_partner: 0 },
  { name: 'Ooh Cha Cha 自然食', address: '台北市中正區羅斯福路二段102號', lat: 25.0289, lng: 121.5184, place_type: 'cafe', pin_color: 'green', is_partner: 1, partner_discount: '9 折' },
  { name: '麵食主義 信義店', address: '台北市信義區信義路四段30巷', lat: 25.0335, lng: 121.5523, place_type: 'chinese', pin_color: 'gray', is_partner: 0 },
  { name: '養心茶樓', address: '台北市中山區松江路128號', lat: 25.0531, lng: 121.5328, place_type: 'chinese', pin_color: 'green', is_partner: 0 },
  { name: 'About Animals', address: '台北市大安區光復南路180巷5號', lat: 25.0426, lng: 121.5577, place_type: 'cafe', pin_color: 'gray', is_partner: 0 },
  { name: '鈺善閣 素 養生宴', address: '台北市中正區北平東路14號', lat: 25.0463, lng: 121.5223, place_type: 'chinese', pin_color: 'green', is_partner: 0 },
  { name: '松山素食家', address: '台北市松山區八德路四段692號', lat: 25.0498, lng: 121.5773, place_type: 'chinese', pin_color: 'green', is_partner: 1, partner_discount: '加贈飲品' },
];
```

Run, verify 12 rows.

Commit: `git add -A && git commit -m "feat: seed 12 sample restaurants in Taipei"`

---

## Phase 2 — Pure Logic Libs (Tasks 13-22, TDD)

### Task 13: hash util

**Files:**
- Create: `src/lib/hash.ts`
- Test: `src/lib/__tests__/hash.test.ts`

**Step 1: Write failing test**
```typescript
// hash.test.ts
import { describe, it, expect } from 'vitest';
import { sha256Salted } from '../hash';
describe('sha256Salted', () => {
  it('hashes consistently', async () => {
    const a = await sha256Salted('foo', 'bar');
    const b = await sha256Salted('foo', 'bar');
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
  });
  it('differs by salt', async () => {
    const a = await sha256Salted('pw', 'alice');
    const b = await sha256Salted('pw', 'bob');
    expect(a).not.toBe(b);
  });
});
```

**Step 2:** `npm run test:run hash` → FAIL

**Step 3: Implement**
```typescript
// hash.ts
export async function sha256Salted(password: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(password + ':' + salt);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}
```

**Step 4:** Run again → PASS

**Step 5:** `git add -A && git commit -m "feat(lib): SHA-256 password hash util"`

### Task 14: xp-calc.ts (daily XP rules)

**Files:**
- Create: `src/lib/xp-calc.ts`
- Test: `src/lib/__tests__/xp-calc.test.ts`

Test cases (matches spec積分制度):
```typescript
import { describe, it, expect } from 'vitest';
import { mealXp, dailyTotal, gemFromOverflow, fragmentFromOverflow } from '../xp-calc';

describe('mealXp', () => {
  it('first meal = 20', () => { expect(mealXp(1, 'all-meals')).toBe(20); });
  it('second meal = 20', () => { expect(mealXp(2, 'all-meals')).toBe(20); });
  it('third meal of all-meals = 30', () => { expect(mealXp(3, 'all-meals')).toBe(30); });
  it('extra meal beyond 2-meals plan still rewards 30', () => { expect(mealXp(3, '2-meals')).toBe(30); });
});

describe('gemFromOverflow', () => {
  it('100 XP day → 1 Gem', () => { expect(gemFromOverflow(100)).toBe(1); });
  it('120 XP day → 1 + 20 Gems', () => { expect(gemFromOverflow(120)).toBe(21); });
  it('70 XP day → 0 Gems', () => { expect(gemFromOverflow(70)).toBe(0); });
});

describe('fragmentFromOverflow', () => {
  it('100 XP overflow = 1 fragment', () => { expect(fragmentFromOverflow(200)).toBe(1); });
  it('250 XP overflow = 1 fragment (only every 100)', () => { expect(fragmentFromOverflow(250)).toBe(1); });
  it('300 XP overflow = 2 fragments', () => { expect(fragmentFromOverflow(300)).toBe(2); });
});
```

Implementation:
```typescript
export type ChallengePlan = '1-meal' | '2-meals' | 'all-meals';

export function mealXp(mealIndex: 1 | 2 | 3, plan: ChallengePlan): number {
  if (mealIndex === 1 || mealIndex === 2) return 20;
  return 30;
}

export function dailyTotal(check_ins: number, missions: number, reviews: number): number {
  return check_ins + missions * 15 + reviews * 15;
}

export function gemFromOverflow(dailyXp: number): number {
  if (dailyXp < 100) return 0;
  if (dailyXp === 100) return 1;
  return 1 + (dailyXp - 100);
}

export function fragmentFromOverflow(dailyXp: number): number {
  if (dailyXp <= 100) return 0;
  return Math.floor((dailyXp - 100) / 100);
}
```

Test → PASS. Commit: `git commit -m "feat(lib): xp/gem/fragment calculators"`

### Task 15: pet-evolution.ts

**Files:**
- Create: `src/lib/pet-evolution.ts`
- Test: `src/lib/__tests__/pet-evolution.test.ts`

XP→Level→Stage table (per spec):

```typescript
export const STAGE_THRESHOLDS = [
  { stage: 'egg', minLv: 1, maxLv: 5 },
  { stage: 'baby', minLv: 6, maxLv: 18 },
  { stage: 'youth', minLv: 19, maxLv: 39 },
  { stage: 'adult', minLv: 40, maxLv: 79 },
  { stage: 'max', minLv: 80, maxLv: 100 },
] as const;

export type PetStage = typeof STAGE_THRESHOLDS[number]['stage'];

export function stageFromLevel(level: number): PetStage {
  return STAGE_THRESHOLDS.find(s => level >= s.minLv && level <= s.maxLv)?.stage ?? 'max';
}

// XP per level (compressed; spec offers different tables - using 積分制度 CSV version)
export const XP_PER_LEVEL: Record<number, number> = (() => {
  const map: Record<number, number> = {};
  for (let lv = 1; lv <= 5; lv++) map[lv] = 30;     // Birth: 30 each
  for (let lv = 6; lv <= 12; lv++) map[lv] = 50 + (lv >= 11 ? 10 : 0);  // Baby: 50/60
  for (let lv = 13; lv <= 19; lv++) map[lv] = 80;   // Child: 80
  for (let lv = 20; lv <= 26; lv++) map[lv] = 100;  // Teenager: 100
  for (let lv = 27; lv <= 30; lv++) map[lv] = 150;  // Adult: 150
  return map;
})();

export function levelFromAccumulatedXp(accXp: number): { level: number; currentXp: number } {
  let cumulative = 0;
  for (let lv = 1; lv <= 30; lv++) {
    const need = XP_PER_LEVEL[lv];
    if (accXp < cumulative + need) return { level: lv, currentXp: accXp - cumulative };
    cumulative += need;
  }
  return { level: 30, currentXp: 0 };
}
```

Tests:
```typescript
it('LV1 + 0 XP', () => expect(levelFromAccumulatedXp(0)).toEqual({ level: 1, currentXp: 0 }));
it('LV1 + 29 XP still LV1', () => expect(levelFromAccumulatedXp(29)).toEqual({ level: 1, currentXp: 29 }));
it('30 XP = LV2 + 0', () => expect(levelFromAccumulatedXp(30)).toEqual({ level: 2, currentXp: 0 }));
it('150 XP = LV6 + 0 (egg→baby)', () => expect(levelFromAccumulatedXp(150)).toEqual({ level: 6, currentXp: 0 }));
it('stage at LV1 is egg', () => expect(stageFromLevel(1)).toBe('egg'));
it('stage at LV6 is baby', () => expect(stageFromLevel(6)).toBe('baby'));
it('stage at LV23 is youth', () => expect(stageFromLevel(23)).toBe('youth'));
```

Test → PASS. Commit: `git commit -m "feat(lib): pet level/stage calc"`

### Task 16: lucky-color.ts

**Files:**
- Create: `src/lib/lucky-color.ts`
- Test: `src/lib/__tests__/lucky-color.test.ts`

```typescript
export const COLORS = ['red','yellow','green','purple','black','white'] as const;
export type LuckyColor = typeof COLORS[number];

export function matchesLucky(foodColors: string[], luckyColor: LuckyColor): boolean {
  // spec: 寬鬆建檔; black/purple count as same group
  if (luckyColor === 'purple' || luckyColor === 'black') {
    return foodColors.some(c => c === 'purple' || c === 'black');
  }
  if (luckyColor === 'yellow') {
    return foodColors.some(c => c === 'yellow' || c === 'orange');
  }
  return foodColors.includes(luckyColor);
}

export function dailyLuckyColor(dayIndex: number): LuckyColor {
  // simple rotation; align with challenge_scripts
  const cycle: LuckyColor[] = ['red','yellow','green','purple','white'];
  return cycle[dayIndex % cycle.length];
}
```

Tests verify rotation + matching. Commit: `git commit -m "feat(lib): lucky color matching"`

### Task 17: mock-ai.ts (food bank + scanner)

**Files:**
- Create: `src/lib/mock-ai.ts`
- Test: `src/lib/__tests__/mock-ai.test.ts`

```typescript
export interface MockFood {
  name: string;
  cal: number; protein: number; carb: number; fat: number; fiber: number;
  isVeg: boolean;
  colors: string[];
  weightG: number;
}

export const FOOD_BANK: MockFood[] = [
  { name: '生菜', cal: 32, protein: 80, carb: 20, fat: 5, fiber: 103, isVeg: true, colors: ['green'], weightG: 32 },
  { name: '番茄', cal: 22, protein: 5, carb: 30, fat: 2, fiber: 12, isVeg: true, colors: ['red'], weightG: 120 },
  { name: '小黃瓜', cal: 16, protein: 6, carb: 8, fat: 1, fiber: 5, isVeg: true, colors: ['green'], weightG: 21 },
  { name: '優格', cal: 60, protein: 35, carb: 15, fat: 8, fiber: 0, isVeg: true, colors: ['white'], weightG: 73 },
  { name: '彩色櫻桃蘿蔔', cal: 18, protein: 4, carb: 8, fat: 1, fiber: 6, isVeg: true, colors: ['red','purple','white'], weightG: 73 },
  { name: '酪梨', cal: 160, protein: 8, carb: 25, fat: 80, fiber: 30, isVeg: true, colors: ['green'], weightG: 100 },
  { name: '紫米飯', cal: 200, protein: 25, carb: 150, fat: 5, fiber: 12, isVeg: true, colors: ['purple','black'], weightG: 100 },
  { name: '南瓜', cal: 26, protein: 5, carb: 30, fat: 1, fiber: 8, isVeg: true, colors: ['yellow','orange'], weightG: 80 },
  { name: '茄子', cal: 25, protein: 4, carb: 25, fat: 1, fiber: 9, isVeg: true, colors: ['purple','white'], weightG: 70 },
  { name: '木耳', cal: 25, protein: 5, carb: 26, fat: 1, fiber: 28, isVeg: true, colors: ['black'], weightG: 50 },
  { name: '玉米', cal: 86, protein: 12, carb: 60, fat: 5, fiber: 8, isVeg: true, colors: ['yellow'], weightG: 100 },
  { name: '雞胸肉', cal: 165, protein: 110, carb: 0, fat: 25, fiber: 0, isVeg: false, colors: ['white'], weightG: 100 },
  { name: '牛肉片', cal: 250, protein: 100, carb: 0, fat: 80, fiber: 0, isVeg: false, colors: ['red'], weightG: 80 },
  { name: '豬肉絲', cal: 200, protein: 80, carb: 0, fat: 70, fiber: 0, isVeg: false, colors: ['red','white'], weightG: 60 },
  // ... 16 more (16+14=30 total)
];

export interface ScanResult {
  items: MockFood[];
  hasMeat: boolean;
  scanFailed: boolean;
}

export function mockScan(seed?: number): ScanResult {
  const rng = seed ?? Math.random();
  if (rng < 0.05) return { items: [], hasMeat: false, scanFailed: true };
  const count = 3 + Math.floor(Math.random() * 4); // 3-6
  const shuffled = [...FOOD_BANK].sort(() => Math.random() - 0.5);
  const items = shuffled.slice(0, count);
  const hasMeat = items.some(i => !i.isVeg);
  return { items, hasMeat, scanFailed: false };
}
```

Tests: items length 3-6, scanFailed has 5% rate (skipped via stubbing), hasMeat is true iff any non-isVeg.

Commit: `git commit -m "feat(lib): mock AI food scanner"`

### Task 18: time.ts (demo time progression)

```typescript
// src/lib/time.ts
import { atom } from 'nanostores';

export const $timeMode = atom<'real'|'compressed'|'manual'>('real');
export const $manualDay = atom<number>(1);
export const $compressedStartedAt = atom<number>(Date.now());

const SECONDS_PER_DAY_COMPRESSED = 30;

export function currentDayNumber(challengeStartedAt: number, mode = $timeMode.get()): number {
  if (mode === 'manual') return $manualDay.get();
  if (mode === 'compressed') {
    const elapsed = (Date.now() - $compressedStartedAt.get()) / 1000;
    return Math.min(30, Math.floor(elapsed / SECONDS_PER_DAY_COMPRESSED) + 1);
  }
  // real
  const days = Math.floor((Date.now() - challengeStartedAt) / 86400000);
  return Math.min(30, days + 1);
}
```

Tests: real mode after 1 day = day 2, compressed after 60s = day 3, manual = $manualDay value.

Commit: `git commit -m "feat(lib): demo time progression"`

### Task 19: baseline-impact.ts (CO2 calc)

```typescript
// src/lib/baseline-impact.ts
// from techfile/全球蔬食推動專案_App 產品規格書.md 附件三
const CO2_KG_PER_KG: Record<string, number> = {
  beef: 99.48, pork: 12.31, lamb: 39.72, chicken: 9.87,
};

export interface Baseline { beef: number; pork: number; lamb: number; chicken: number; }

export function impactSavedKg(weeklyKg: number, baseline: Baseline, plantCo2 = 1.0): number {
  const meatCo2 = (baseline.beef * CO2_KG_PER_KG.beef + baseline.pork * CO2_KG_PER_KG.pork + baseline.lamb * CO2_KG_PER_KG.lamb + baseline.chicken * CO2_KG_PER_KG.chicken) * weeklyKg;
  const plantCo2Total = weeklyKg * plantCo2;
  return Math.max(0, meatCo2 - plantCo2Total);
}
```

Tests with sample baselines. Commit: `git commit -m "feat(lib): CO2 impact calculation"`

### Task 20: csv-parse.ts (shared util)

Move CSV parsing from seed scripts into `src/lib/csv.ts` so it's reusable. Export same `parseCSV(text)`. Tests with quoted fields, embedded newlines.

Commit: `git commit -m "feat(lib): csv parser shared util"`

### Task 21: storage.ts (typed localStorage)

```typescript
// src/lib/storage.ts
export const storage = {
  get<T>(key: string, fallback: T): T {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
  },
  set<T>(key: string, value: T) { localStorage.setItem(key, JSON.stringify(value)); },
  remove(key: string) { localStorage.removeItem(key); },
};

export const KEYS = {
  USER_ID: 'yummi.userId',
  THEME: 'yummi.theme',
  TIME_MODE: 'yummi.timeMode',
  MANUAL_DAY: 'yummi.manualDay',
  CHALLENGE_STARTED_AT: 'yummi.challengeStartedAt',
} as const;
```

Smoke test (jsdom localStorage). Commit: `git commit -m "feat(lib): typed localStorage helper"`

### Task 22: env.ts (typed env)

```typescript
// src/lib/env.ts
export const ENV = {
  DRUST_BASE: import.meta.env.VITE_DRUST_BASE ?? 'https://tool.tzuchi-org.tw/drust/t/fec8119d-0231-40f7-a7d6-c580ad312e96',
  DRUST_ANON_TOKEN: import.meta.env.VITE_DRUST_ANON_TOKEN ?? '',
};
```

Add to `.env`:
```
VITE_DRUST_BASE=https://tool.tzuchi-org.tw/drust/t/fec8119d-0231-40f7-a7d6-c580ad312e96
VITE_DRUST_ANON_TOKEN=drust_GaKEqSNtWqoo9fMofnbxZn2ymDZPDVrXFYhfkmDbv3M
```

Add to `.gitignore`: `.env`. Commit env example: `cp .env .env.example` and stub tokens.

Commit: `git commit -m "feat: env config + .env.example"`

---

## Phase 3 — API Client + Auth (Tasks 23-28)

### Task 23: drust client（已實測正確規格）

**Files:**
- Create: `src/api/drust.ts`
- Test: `src/api/__tests__/drust.test.ts`

> **重要：drust REST 規格（實測 2026-05-07）**
> - 標準 CRUD：`/records/{collection}`、body 包 `{"data": {...}}`
> - RPC：`/rpc/{name}`、body 是平鋪的 params object（**不**是 `{params: [...]}`）
> - DELETE 回 HTTP 204、無 body
> - 所有 12 個 collections 都已開啟 anon CRUD（包含 pet_states），所以 anon token 即可寫入

```typescript
import { ENV } from '@/lib/env';

export interface DrustError { message: string; status: number; }

class DrustClient {
  constructor(private base = ENV.DRUST_BASE, private token = ENV.DRUST_ANON_TOKEN) {}

  private async fetch(path: string, init?: RequestInit): Promise<any> {
    const res = await fetch(`${this.base}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.token}`, ...(init?.headers ?? {}) },
    });
    if (!res.ok) throw { message: await res.text(), status: res.status } as DrustError;
    if (res.status === 204) return null;
    return res.json();
  }

  /** RPC — body is flat params object, e.g. { username: 'x', password_hash: 'y' } */
  rpc<T = any>(name: string, params: Record<string, any> = {}): Promise<{ column_names: string[]; rows: any[][]; row_count: number }> {
    return this.fetch(`/rpc/${name}`, { method: 'POST', body: JSON.stringify(params) });
  }

  /** Insert: body wrapped in {"data": {...}}, returns { id, record } */
  insert(collection: string, data: Record<string, any>): Promise<{ id: number; record: any }> {
    return this.fetch(`/records/${collection}`, { method: 'POST', body: JSON.stringify({ data }) });
  }

  /** Update: PATCH /records/{coll}/{id}, body {"data": {...}} */
  update(collection: string, id: number, data: Record<string, any>): Promise<{ record: any }> {
    return this.fetch(`/records/${collection}/${id}`, { method: 'PATCH', body: JSON.stringify({ data }) });
  }

  /** Delete: DELETE /records/{coll}/{id}, returns null on 204 */
  delete(collection: string, id: number): Promise<void> {
    return this.fetch(`/records/${collection}/${id}`, { method: 'DELETE' });
  }

  /** List with optional filters: ?col=eq.value&limit=50 */
  list<T = any>(collection: string, query: Record<string, string> = {}): Promise<{ records: T[] }> {
    const qs = new URLSearchParams(query).toString();
    return this.fetch(`/records/${collection}${qs ? '?' + qs : ''}`);
  }

  /** Helper: convert RPC rows[][] + column_names → array of objects */
  rpcRows<T = any>(result: { column_names: string[]; rows: any[][] }): T[] {
    return result.rows.map(row => Object.fromEntries(result.column_names.map((c, i) => [c, row[i]]))) as T[];
  }
}

export const drust = new DrustClient();
```

Tests with `vi.fn` mocking fetch. Commit: `git commit -m "feat(api): drust REST client"`

> **重要：rate limit 行為**
> drust 對寫入有 rate limit（觀察到約每秒 ~3-4 次後就會 429 + retry-after）。
> 客戶端用 nanostores 的 optimistic update 規避大部分 UX 問題；批次寫入（e.g. seed scripts）需在 client 內加 250ms delay + 429 backoff。

### Task 24: auth.ts

**Files:**
- Create: `src/api/auth.ts`
- Test: `src/api/__tests__/auth.test.ts`

```typescript
import { drust } from './drust';
import { sha256Salted } from '@/lib/hash';
import { storage, KEYS } from '@/lib/storage';

export async function register(username: string, password: string, displayName: string): Promise<number> {
  const hash = await sha256Salted(password, username);
  const result = await drust.rpc<{ id: number }[]>('register', [username, hash, displayName]);
  const userId = result[0]?.id;
  if (!userId) throw new Error('Register failed');
  await drust.rpc('bootstrap_user', [userId]);
  storage.set(KEYS.USER_ID, userId);
  return userId;
}

export async function login(username: string, password: string): Promise<{ id: number; displayName: string }> {
  const hash = await sha256Salted(password, username);
  const rows = await drust.rpc<{ id: number; display_name: string }[]>('login', [username, hash]);
  const row = rows[0];
  if (!row) throw new Error('Invalid credentials');
  storage.set(KEYS.USER_ID, row.id);
  return { id: row.id, displayName: row.display_name };
}

export function logout() { storage.remove(KEYS.USER_ID); }
export function currentUserId(): number | null { return storage.get<number | null>(KEYS.USER_ID, null); }
```

Tests with mocked drust. Commit: `git commit -m "feat(api): auth register/login/logout"`

### Task 25-28: API modules (one task each)

- Task 25: `src/api/profile.ts` — getProfile / updateProfile / setBaseline
- Task 26: `src/api/pet.ts` — getPet / addXp / updateMood
- Task 27: `src/api/check-ins.ts` — createCheckIn / listCheckIns
- Task 28: `src/api/content.ts` — listChallengeScripts / randomQuiz / listRestaurants

Each: type the interfaces, write integration test against mocked drust, implement, commit.

---

## Phase 4 — Global Stores (Tasks 29-31)

### Task 29: store/user.ts

```typescript
import { atom, computed } from 'nanostores';
import * as authApi from '@/api/auth';
import * as profileApi from '@/api/profile';

export const $user = atom<{id:number;displayName:string} | null>(null);
export const $profile = atom<any>(null);

export const $isLoggedIn = computed($user, u => !!u);

export async function bootstrapFromStorage() {
  const id = authApi.currentUserId();
  if (id) {
    const profile = await profileApi.getProfile(id);
    $user.set({ id, displayName: profile.display_name });
    $profile.set(profile);
  }
}
```

Commit.

### Task 30: store/pet.ts + store/today.ts

Same pattern. Commit each.

### Task 31: store/ui.ts

Theme + time mode + dev mode. Commit.

---

## Phase 5 — Router + Layout Shell (Tasks 32-35)

### Task 32: router.ts

**Files:**
- Create: `src/router.ts`
- Test: `src/__tests__/router.test.ts`

```typescript
import { atom } from 'nanostores';

export const $route = atom<{ path: string; params: Record<string,string> }>({ path: '/', params: {} });

const ROUTES: Array<{ pattern: RegExp; loader: () => Promise<any>; paramNames: string[] }> = [];

export function defRoute(pattern: string, loader: () => Promise<any>) {
  const paramNames: string[] = [];
  const regexStr = '^' + pattern.replace(/:([a-z]+)/g, (_, name) => { paramNames.push(name); return '([^/]+)'; }) + '$';
  ROUTES.push({ pattern: new RegExp(regexStr), loader, paramNames });
}

export function navigate(path: string) {
  if (location.hash !== '#' + path) location.hash = '#' + path;
  resolve();
}

async function resolve() {
  const path = location.hash.slice(1) || '/';
  for (const r of ROUTES) {
    const m = path.match(r.pattern);
    if (m) {
      const params: Record<string,string> = {};
      r.paramNames.forEach((n, i) => params[n] = decodeURIComponent(m[i+1]));
      $route.set({ path, params });
      const mod = await r.loader();
      const root = document.getElementById('app')!;
      root.innerHTML = '';
      root.appendChild(mod.default(params));
      return;
    }
  }
  console.warn('Route not found:', path);
}

export function startRouter() {
  window.addEventListener('hashchange', resolve);
  resolve();
}
```

Tests with simulated hash changes. Commit.

### Task 33: TabBar component

`src/components/TabBar.ts` — render 5-tab footer with center pop-out check-in button. Active state binds to `$route`.

Commit.

### Task 34: Layout shell

`src/components/Layout.ts` — wraps content + TabBar. Hides TabBar on splash/auth/onboarding routes.

Commit.

### Task 35: main.ts wires everything

```typescript
// src/main.ts
import './styles/tokens.css';
import './styles/globals.css';
import { startRouter, defRoute } from './router';
import { bootstrapFromStorage } from './store/user';

defRoute('/', () => import('./routes/splash'));
defRoute('/login', () => import('./routes/login'));
defRoute('/register', () => import('./routes/register'));
// ... all 20+ routes
defRoute('/home', () => import('./routes/home'));
// ...

await bootstrapFromStorage();
startRouter();
```

Commit. Run `npm run dev`, verify hash routing works.

---

## Phase 6-12 — Routes (Tasks 36-70, ~5 tasks per module)

For each route, the pattern:
1. Create `src/routes/<route>.ts` exporting `default(params) => HTMLElement`
2. Use design system classes from tokens.css
3. Bind to stores with `.subscribe()` (cleanup on unmount via `MutationObserver`)
4. Wire CTAs to `navigate('#/...')` or to API calls
5. Smoke test: `it('renders without throwing')`
6. Commit

I won't enumerate all 35+ task details here. Each follows the same template. Refer to **`docs/plans/2026-05-07-yummi-go-pwa-design.md` §6 (五大模組功能)** for the per-screen layout and behaviors.

**High-level grouping:**

- **Phase 6 — Splash + Auth**: Tasks 36-39 (splash, login, register, logout)
- **Phase 7 — Onboarding 6 screens**: Tasks 40-45 (oath, diet-survey, baseline, challenge-level, eat-times, day1-hook). The original spec listed a separate "completion" celebration screen (Task 46), but day1-hook's "開始打卡" CTA already serves as the closing beat — it stamps `CHALLENGE_STARTED_AT` and routes straight to /check-in. Task 46 is dropped; Phase 8 still starts at Task 47.
- **Phase 8 — Home + Pet**: Tasks 47-50 (home layout, PetView component, mood/stage rendering, gray-fog overlay)
- **Phase 9 — Check-in**: Tasks 51-55 (camera capture, scanning animation, result page with edit, success page with XP burst)
- **Phase 10 — Map**: Tasks 56-60 (Leaflet init, marker rendering, filter chips, restaurant detail, review form with photo upload)
- **Phase 11 — Tasks**: Tasks 61-65 (daily missions list, 5R segment, makeup-cards, quiz random, quiz result with explanation)
- **Phase 12 — Profile + Day-30**: Tasks 66-70 (calendar view, accumulated stats, settings, day-30 chest screen, impact report card)

For each route task, the developer should:
- Reference design.md for visual spec
- Use tokens.css variables
- Reuse `Button`, `Card`, `ChoiceCard`, `PetView`, `XpBurst` from `components/`
- Add a smoke test (does it render?)
- Commit

---

## Phase 13 — PWA + Dev Panel (Tasks 71-74)

### Task 71: Manifest icons

Generate `icon-192.png` and `icon-512.png` from frog illustration:

```bash
# from public/ folder
# use ImageMagick if available; otherwise manually create
```

If not available, use placeholder PNG with theme color circle + text.

Commit.

### Task 72: Service Worker validation

Build `npm run build`, serve `npm run preview`, open Chrome DevTools → Application → check:
- Manifest valid
- Service Worker registered
- Cache populated after first load

Commit any fixes.

### Task 73: Install prompt

`src/components/InstallPrompt.ts`:
```typescript
let deferredPrompt: any = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  showBanner();
});
function showBanner() { /* render "加入主畫面" banner with CTA → deferredPrompt.prompt() */ }
```

Add to home screen on first visit. Commit.

### Task 74: Dev panel

`src/components/DevPanel.ts` — bottom-right floating cluster (visible only with `?dev=1` URL param):
- Time mode toggle
- Force pet stage select
- Reset state button (calls `drust.delete` for current user's records)
- Activity simulation buttons

Commit.

---

## Phase 14 — Polish + Deploy Prep (Tasks 75-78)

### Task 75: Lighthouse PWA audit

Run Chrome Lighthouse → PWA audit. Fix all errors. Aim for ≥ 90 score.

Commit.

### Task 76: Cross-browser smoke test

- Chrome / Edge / Safari (mobile + desktop)
- Verify install, offline mode, hash routing, drust API calls

Commit any fixes.

### Task 77: README

`README.md`:
- Project intro (link to design.md)
- Setup: `npm install && cp .env.example .env && npm run dev`
- Test: `npm test`
- Build: `npm run build && npm run preview`
- Deploy: TBD (Vercel/Netlify recommended)
- Drust admin token notes (DO NOT commit)

Commit.

### Task 78: Deploy

Pick target (Vercel / Netlify / GitHub Pages) → push → verify HTTPS PWA installable.

Commit `vercel.json` or equivalent.

---

## Done

Final state:
- Working PWA at `https://yummigo.example.com` (or chosen domain)
- 5 modules functional with mock data
- 30-day challenge demoable in 15 min via compressed time mode
- Installable on iOS Safari + Android Chrome
- ~78 commits, ~28h total

Plan complete and saved to `docs/plans/2026-05-07-yummi-go-pwa-implementation.md`. Two execution options:

**1. Subagent-Driven (this session)** — I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** — Open new session with executing-plans, batch execution with checkpoints

**Which approach?**
