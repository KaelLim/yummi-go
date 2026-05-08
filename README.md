# Yummi Go 好味走走

A 30-day vegan-challenge PWA: photograph each meal, feed your guardian, watch the grey fog lift. Built as a prototype on Vite + vanilla TypeScript with a [drust](https://tool.tzuchi-org.tw/drust/) BaaS backend.

## Stack

- **Frontend** — Vite 8 + vanilla TS, hash-router (`src/router.ts`), nanostores
- **Map** — Leaflet + OpenStreetMap tiles
- **PWA** — vite-plugin-pwa (Workbox) + Web App Manifest + install prompt
- **Tests** — Vitest + jsdom (`@testing-library/dom`)
- **Backend** — drust multi-tenant SQLite, REST + RPC over a single anon token
- **Deployment target** — static host (Cloudflare Pages / Netlify / Vercel work as-is)

## Quickstart

```bash
git clone <your-fork>
cd yummigo
npm install

# Copy the example and fill in your tenant + anon token.
cp .env.example .env

npm run dev              # http://localhost:5173/
npm run test:run         # 280+ tests via vitest
npm run build            # tsc --noEmit + vite build → dist/
```

Required env (`.env`):

```
VITE_DRUST_BASE=https://tool.tzuchi-org.tw/drust/t/<TENANT_ID>
VITE_DRUST_ANON_TOKEN=drust_<ANON_TOKEN>
```

The anon token ends up in the bundle by design (prototype-grade auth). For a real launch, route through a server proxy.

## Layout

```
src/
├── api/           drust REST client + per-domain modules (auth, profile, pet, check-ins, content, reviews, wallet)
├── components/    Layout, TabBar, Progress, PetView, DevPanel, InstallPrompt
├── lib/           pure utilities (xp-calc, pet-evolution, lucky-color, baseline-impact, time, hash, storage, csv, mock-ai, lifecycle, env)
├── routes/        screens grouped by phase (splash, login, register, onboarding/*, home, check-in/*, map, restaurant-*, tasks/*, profile/*, day-30)
├── store/         nanostores (user, pet, today, ui, checkin)
├── styles/        tokens.css + globals.css
└── main.ts        boot + route table
```

## drust schema (12 collections)

| Collection           | Purpose                                                  |
|----------------------|----------------------------------------------------------|
| users                | login + display name                                     |
| user_profiles        | diet type, baseline meat ratios, eat-times, oath flags   |
| pet_states           | level / stage / mood / current xp / accumulated xp       |
| gem_balances         | balance + total earned/spent                             |
| makeup_cards         | card_count + fragment_count                              |
| check_ins            | per-meal log (food items, nutrition JSON, lucky match)   |
| daily_progress       | reserved (currently unused)                              |
| quiz_questions       | 95 seeded questions                                      |
| quiz_attempts        | per-attempt log                                          |
| restaurants          | 12 seeded restaurants                                    |
| restaurant_reviews   | rating + text + photo_id + status                        |
| challenge_scripts    | 30-day script (greeting, action_type, lucky color, …)    |

Anon-callable RPCs:
- `login(username, password_hash)`
- `get_user_full(user_id)` — joined profile + pet + gems + cards
- `get_day_script(day_number)`
- `random_quiz()`

### drust quirks (worked around in `src/api/drust.ts`)

- `list` endpoint **silently ignores** filter query strings (`?id=eq.X`, `?filter[*]=X`, etc.) and **caps at 20 rows**. Only `sort` is honored.
  - Single-record lookups go through `drust.get(coll, id)` (path-based GET).
  - Foreign-key lookups (`profile by user_id`, `pet by user_id`, etc.) fetch the page and filter client-side. Documented inline; once a table exceeds the cap, route through a server-side RPC.
- `quic` egress can be blocked on some networks. For Cloudflare quick tunnels, force HTTP/2:
  ```bash
  cloudflared tunnel --protocol http2 --url http://localhost:5173
  ```

## Dev mode

Append `?dev` to any URL:

- Floating wrench fab opens a panel for time-mode swap (real / compressed 30s-per-day / manual), manual-day slider 1-30, theme toggle, and quick deeplinks to the five tabs + day-30.

## Mock systems (no real models / cameras)

- **AI scanner** (`src/lib/mock-ai.ts`) — fakes a 2-second pipeline, returns 3-6 random ingredients drawn from a 30-item bank with a configurable meat rate.
- **Pet evolution** (`src/lib/pet-evolution.ts`) — single frog PNG + CSS filters per stage (egg shell overlay, baby scale 0.6, youth 1.0, adult 1.2 + crown, max 1.4 + hue rotation).
- **Lucky color** (`src/lib/lucky-color.ts`) — DB stores Traditional Chinese (`紅色`, `黃色/橘色`); `normalizeLuckyColor` maps to canonical English keys for matching against food colors.
- **Time progression** (`src/lib/time.ts`) — three modes for demoing the 30-day arc in 15 minutes (compressed mode = 30 seconds per day).

## Deployment

Any static host with SPA fallback works. The router is hash-based, so even sites without a real rewrite rule will function — but the hash style is preserved on direct URL hits.

Includes:
- `public/_redirects` — Netlify-style fallback (`/*` → `/index.html` 200)
- `public/_headers` — basic Cloudflare Pages cache hints

Build artifacts land in `dist/`.

```bash
npm run build
npx wrangler pages deploy dist     # Cloudflare Pages (named project)
# OR
netlify deploy --dir=dist --prod
```

Either platform also needs the two `VITE_*` env values at build time.

## Testing the full 30-day flow in 2 minutes

1. `npm run dev`
2. Register a new account (it bootstraps profile / pet / gems / cards rows automatically)
3. Click through the 6 onboarding screens
4. Append `?dev` to the URL, swap to **manual** time mode
5. Drag the day slider, take a photo via /check-in, watch the pet level up + fog lift
6. At day 30, hit the trophy on /profile to see the impact-report card

## License

Prototype — not for production redistribution.
