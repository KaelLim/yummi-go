# Yummi Go PWA — 設計文件

**日期**：2026-05-07
**狀態**：✅ 設計確認（brainstorming 階段完成）
**作者**：Claude + 用戶協作

## 0. 背景與目標

Yummi Go「好味走走」原規劃為 React Native + Expo 行動 app（spec v1.4）。本文件規劃**改為 PWA 形式**的 MVP 實作，以利在現有條件下快速 demo 並具備裝桌面圖示等實用功能。

**核心約束**
- ✅ 以 PWA 形式呈現（installable、offline-capable）
- ✅ 後端使用 **drust**（SQLite-based BaaS），取代 Firebase
- ✅ Auth 簡化為 username + password（drust RPC），不接 Google / Apple OAuth
- ✅ 食物 AI 辨識**作假**（pre-defined mock food bank）
- ✅ 其他功能盡量對齊 spec 規格書 v1.4

**參考資料**
- `techfile/全球蔬食推動專案_App 產品規格書.md`（spec v1.4）
- `techfile/yummygo_spec_v1.4.docx`（補充規格）
- `techfile/Yummi Go Content Database.xlsx - {30天挑戰腳本/Quiz/積分制度}.csv`
- `design.md`（色彩 + 字型 token）
- `workflow.md`（已完成的流程圖）
- `tokens.css`（CSS variables）
- `prototype.html`（已完成的 vanilla 原型）
- `_codex_techfile.md`（codex 對全 techfile 的摘要）

---

## 1. 架構總覽

### Tech Stack

| 層 | 選用 | 理由 |
|---|---|---|
| Bundler | **Vite 5** | 快速 dev、production build、生態系豐富 |
| 語言 | **TypeScript** | 型別安全、5 模組規模 vanilla JS 易出錯 |
| State | **nanostores**（4 KB） | reactive store，無需裝 framework |
| Router | 自寫 hash router（~50 LoC） | 零依賴、Service Worker 友善 |
| PWA | **vite-plugin-pwa**（Workbox） | 自動產 SW + manifest |
| Map | **Leaflet + OpenStreetMap** | 免費、無需 API key |
| 後端 | **drust** REST + RPC | 已部署、一站式 BaaS |
| 樣式 | 原生 CSS + tokens.css | 沿用既有設計系統 |
| 圖示 | **Material Symbols Rounded**（Google Fonts） | 已用於 prototype.html |
| 字體 | **Nunito + Noto Sans TC** | spec 指定 |

### 不裝的東西
- ❌ React / Vue / Svelte（vanilla TS + nanostores 足夠）
- ❌ Tailwind（用 design tokens 直接寫 CSS）
- ❌ Google Maps（用 OSM 替代）
- ❌ Firebase（drust 取代）
- ❌ JWT / bcrypt（簡化 auth）

### 檔案結構

```
yummi-go-pwa/
├── public/
│   ├── manifest.webmanifest
│   ├── icon-192.png  icon-512.png
│   └── pet/                     寵物圖（已上傳 drust，這裡放本地副本作 fallback）
├── src/
│   ├── main.ts                  進入點
│   ├── router.ts                hash router
│   ├── store/
│   │   ├── user.ts              $user, $profile
│   │   ├── pet.ts               $pet, $gems
│   │   ├── today.ts             $today, $challenge
│   │   └── ui.ts                $ui (theme, devMode, timeMultiplier)
│   ├── api/
│   │   ├── drust.ts             fetch wrapper, RPC calls
│   │   ├── auth.ts              register / login / logout
│   │   └── seed.ts              一次性 seed scripts (dev only)
│   ├── lib/
│   │   ├── pet-evolution.ts     stage / mood 計算 → 圖層
│   │   ├── xp-calc.ts           daily XP 上限 / Gem / 碎片邏輯
│   │   ├── lucky-color.ts       食材色 vs 當日色比對
│   │   ├── mock-ai.ts           假食物辨識
│   │   └── time.ts              時間倍速（demo）
│   ├── components/              共用 UI
│   │   ├── Button.ts  Card.ts  ChoiceCard.ts  NavBar.ts  TabBar.ts
│   │   ├── PetView.ts           寵物 + 灰霧 + 進度
│   │   └── XpBurst.ts  LoadingScanner.ts
│   ├── routes/
│   │   ├── splash.ts  login.ts  register.ts
│   │   ├── onboarding/{oath,diet-survey,baseline,challenge-level,eat-times,day1-hook}.ts
│   │   ├── home.ts
│   │   ├── map/{index,detail,review}.ts
│   │   ├── check-in/{index,scanning,result,success}.ts
│   │   ├── tasks/{index,quiz,makeup}.ts
│   │   ├── profile/{index,settings,reviews,baseline}.ts
│   │   └── challenge/day-30.ts
│   └── styles/
│       ├── tokens.css           已存在
│       └── globals.css
├── scripts/
│   ├── seed-collections.ts      建 drust schema
│   ├── seed-quiz.ts             140 題 → drust
│   ├── seed-challenge.ts        30 天腳本 → drust
│   └── seed-restaurants.ts      自編 10-15 家
├── package.json  vite.config.ts  tsconfig.json
├── README.md
└── .env                         drust tokens
```

---

## 2. 資料模型（drust collections）

11 個 collections。

### 2.1 用戶資料（5）

| Collection | 欄位 |
|---|---|
| `users` | id (auto), username (unique), password_hash, display_name, oath_signed_at, created_at |
| `user_profiles` | user_id (FK), diet_type (vegan/vegetarian/flexitarian/omnivore), challenge_level (1/2/3), eat_times (JSON `{breakfast:"08:00",lunch:"12:30",dinner:"19:00"}`), known_from, baseline (JSON `{beef:0.3,pork:0.4,lamb:0.05,chicken:0.25}`) |
| `pet_states` | user_id (FK), level, current_xp, accumulated_xp, stage (egg/baby/youth/adult/max), mood (normal/happy/weak/critical/evolve), last_fed_at |
| `gem_balances` | user_id (FK), balance, total_earned, total_spent |
| `makeup_cards` | user_id (FK), card_count, fragment_count |

### 2.2 行為紀錄（4）

| Collection | 欄位 |
|---|---|
| `check_ins` | user_id (FK), day_number, meal_index (1/2/3), timestamp, food_items (JSON), nutrition (JSON), vegan_type, was_meat_replaced (bool), lucky_color_matched (bool), xp_earned, gems_earned |
| `daily_progress` | user_id (FK), day_number, missions_done (JSON), total_xp, lucky_color, completed_at |
| `quiz_attempts` | user_id (FK), question_id (FK), answer, correct (bool), attempted_at |
| `restaurant_reviews` | user_id (FK), restaurant_id (FK), rating (1-5), text, photo_id (drust file), vegan_type, status (pending/verified/rejected), created_at |

### 2.3 內容資料（3，pre-seed）

| Collection | 欄位 | 來源 |
|---|---|---|
| `restaurants` | name, address, lat, lng, place_type, pin_color (gray/green/blue), is_partner, partner_discount | 自編 10-15 家台北素食 |
| `quiz_questions` | source (ProVeg/慈濟), category, question, option_a/b/c, correct_answer, explanation | `Quiz Database*.csv`（~140 題）|
| `challenge_scripts` | day_number (1-30), lucky_color, greeting, action_5r_or_painpoint, task_description, bonus_challenge, fog_reduction_pct | `30天挑戰腳本與每日任務.csv` |

---

## 3. Auth 設計

**簡化原則**：不上 bcrypt / JWT，用 SHA-256 + drust RPC，prototype demo 等級。

### Register 流程
1. 用戶輸入 username + password + display name
2. 客戶端 `hash = SHA-256(password + ":" + username)`（用 username 當 salt）
3. 呼叫 RPC `register(username, hash, displayName)`
4. RPC 內：
   - 檢查 username 唯一
   - INSERT users → 取得 user_id
   - INSERT 預設 user_profiles / pet_states (LV1, 0 XP) / gem_balances (0) / makeup_cards (0,0)
5. 回傳 user_id → 前端寫 localStorage
6. 跳轉 `#/onboarding/oath`

### Login 流程
1. SHA-256(password + ":" + username)
2. RPC `login(username, hash)` → SELECT user_id, display_name FROM users WHERE ... AND password_hash = ?
3. 回傳 user_id → 寫 localStorage
4. 跳 `#/home`

### 後續所有查詢
- 從 localStorage 拿 user_id → 加進 query 條件
- 例：`SELECT * FROM check_ins WHERE user_id = ?`

⚠️ **資安說明**：drust anon token 給定後任何人都能呼叫所有 anon RPC。本方案**僅限 prototype**，正式上線需改用：
- bcrypt 取代 SHA-256
- drust user-scoped tokens（如有支援）
- 或加入 Cloudflare Worker / 後端中介層

---

## 4. 路由與導航

### Hash routes

```
#/                            → splash → login or home
#/login                       登入
#/register                    註冊

#/onboarding/oath             綠色承諾簽署
#/onboarding/diet-survey      飲食習慣 + 吃肉頻率（合一頁）
#/onboarding/baseline         減碳 baseline（牛/豬/羊/雞 比例 sliders）
#/onboarding/challenge-level  挑戰等級 LV1/2/3（含容錯說明）
#/onboarding/eat-times        早午晚進食時間
#/onboarding/day1-hook        首日 hook：灰霧 + 蛋 + 強制 tooltip 引導打卡

#/home                        首頁（寵物 + 今日進度）
#/map                         地圖（OSM tiles + 三色圖釘 + 篩選 chip）
#/map/restaurant/:id          餐廳詳情頁
#/map/restaurant/:id/review   寫評論

#/check-in                    拍照 / 相簿
#/check-in/scanning           AI 辨識動畫
#/check-in/result             結果確認（可編輯食材）
#/check-in/success            打卡成功 + XP 動畫

#/tasks                       任務列表（今日 / 5R / 補簽 segment）
#/tasks/quiz                  蔬食學堂 Quiz（隨機 1 題）
#/tasks/makeup                補簽卡 / 碎片合成

#/profile                     個人頁（月曆 + 累積數據）
#/profile/settings            設定
#/profile/reviews             我的評論
#/profile/baseline            減碳成績單

#/challenge/day-30            30 天結算（寶箱二選一 + Impact Report）
```

### 底部 5 tab（spec 對齊）

| Tab | route | 圖示 |
|---|---|---|
| 首頁 | `#/home` | `home` |
| 地圖 | `#/map` | `map` |
| **打卡（中央凸起）** | `#/check-in` | `photo_camera` |
| 任務 | `#/tasks` | `task_alt` |
| 我的 | `#/profile` | `person` |

---

## 5. 全域狀態（nanostores）

```typescript
// store/user.ts
export const $user = atom<{id, username, displayName} | null>(null);
export const $profile = atom<{dietType, challengeLevel, eatTimes, baseline} | null>(null);

// store/pet.ts
export const $pet = atom<{level, currentXp, accumulatedXp, stage, mood}>({...});
export const $gems = atom<{balance, fragments, makeupCards}>({...});

// store/today.ts
export const $today = atom<{dayNumber, missionsDone, luckyColor, totalXpToday}>({...});
export const $challenge = atom<{scripts: Day[], currentDayIndex}>({...});

// store/ui.ts
export const $ui = atom<{theme, devMode, timeMultiplier, currentTab}>({...});
```

**生命週期**
- 啟動：drust 拉資料 → 寫 store
- 寫操作：optimistic update → drust API → 失敗 rollback
- 離線：寫 IndexedDB queue → 上線時 flush

---

## 6. 五大模組功能

### 🏠 首頁 Home
- Hero 寵物 + 灰霧 overlay（依連續未打卡天數加深 0%/30%/60%）
- 等級進度條（current XP / next level XP）
- 今日狀態卡：日數 D{n}/30、streak、餐次圓點（早 ✓ 午 ✓ 晚 ?）
- 幸運色卡：今日色 + 已尋找 ?/1 + CTA「打開地圖找紫色食物」
- 知識氣泡：每日 quiz 入口
- 寵物對話 bubble（依 mood）

### 🗺️ 地圖 Map
- Leaflet + OSM
- 三色圖釘（灰=待評論 / 綠=已評論 / 藍=合作）
- 篩選 chip：素別（全素/蛋奶素/五辛素/鍋邊素）+ 餐廳類別（中/西/咖啡/日/泰/甜點）
- 圖釘 click → 卡片縮圖 + 店名 → 進詳情頁
- 詳情頁：店家資訊 + 評論列表 + 上傳評論 + 檢舉 5 選項
- **「評論即打卡」**：上傳評論時可勾選「同時當作今日打卡照」→ 雙重 XP +20 評論 +30 打卡

### 📷 打卡 Check-in
- `getUserMedia()` 拍照 OR 從相簿選
- 預覽：重新拍 / 進行分析
- AI scanning（mock）：fake loading 2 秒 → 隨機 3-6 食材
- 結果頁：食材列表（可編輯數值 / 新增食物 / 選素別）
- 含肉確認分支：偵測「肉？」→ 是 → 任務失敗 / 否 → 替代為植物肉
- 成功頁：XP 動畫 + 灰霧 -1%（CSS animation）

### ✅ 任務 Tasks
- 三個 segment：**今日任務 / 5R / 補簽**
- 今日任務（依 challenge_scripts[currentDay]）
  - 飲食打卡 +30 / 餐 +50 / 3 餐 → CTA 跳 #/check-in
  - 環保行動 +15（勾選環保餐具）
  - 今日幸運色 +15（拍照命中時自動勾）
  - Daily Quiz +15 → CTA 跳 #/tasks/quiz
  - 餐廳評論 +20 → CTA 跳 #/map
- 5R segment：依當日是 Refuse/Reuse/Reduce/Recycle/Repair 顯示對應任務
- 補簽 segment：碎片進度（每 100 XP 溢出 = 1）+ 補簽卡庫存（用 Gem 換）
- Quiz 頁：從 quiz_questions 隨機 1 題 → 答 → 顯示講解 → +15 XP

### 👤 個人頁 Profile
- 用戶名片（頭像 + 名稱 + 素別 tag）
- 月曆 view：每日打卡狀態（單葉 / 幸運草 / 印章）
- 累積數據卡片：總天數、總餐數、總減碳量（kg CO2e）
- 我的評論 list
- 設定：編輯資料 / 提醒排程 / 登出

---

## 7. Mock 系統

### 🤖 Mock AI 食物辨識
食材庫含 30 種，每筆有 colors[]、isVeg、營養素：
```typescript
const FOOD_BANK = [
  {name:'生菜', cal:32, protein:80, carb:20, fat:5, fiber:103, isVeg:true, colors:['green','white']},
  {name:'番茄', cal:120, ..., isVeg:true, colors:['red']},
  {name:'雞胸肉', cal:165, ..., isVeg:false, colors:['white']},  // 故意混
  ...
];
function mockScan() {
  const count = randInt(3, 6);
  const items = sample(FOOD_BANK, count);
  const hasMeat = items.some(f => !f.isVeg);
  return {items, hasMeat};
}
```

### 🐸 Mock Pet Evolution
單一 frog 圖（已上傳 drust）+ CSS filter 模擬 5 階段：
| Stage | LV | 視覺處理 |
|---|---|---|
| Egg | 1-5 | frog 隱藏 + 蛋殼 SVG overlay + 慢慢搖晃動畫 |
| Baby | 6-18 | frog scale 0.6 + 柔光 gradient + 飛舞粒子 |
| Youth | 19-39 | frog scale 1.0（原始） |
| Adult | 40-79 | frog scale 1.2 + 皇冠 SVG |
| Max | 80-100 | frog scale 1.4 + rainbow `hue-rotate` 動畫 + sparkle |

5 表情用 CSS filter 切換：normal / happy (saturate 1.3) / weak (saturate 0.5) / critical (grayscale 0.8) / evolve (sparkle ring）

### 🎨 Mock 幸運色
- 食材庫每筆有 `colors[]`（spec 「寬鬆建檔」原則）
- 當日色從 `challenge_scripts[currentDay].lucky_color`
- 打卡後比對：任一食材 colors 包含當日色 → +15 XP + 幸運色 toast

### ⏱️ 時間進度
Dev panel 提供 3 模式：
- **Real-time**：依真實日曆推進
- **Compressed**：每 30 秒 = 1 天（demo 30 天 = 15 分鐘）
- **Manual**：「跳到 Day N」按鈕

---

## 8. PWA 設定

### manifest
```json
{
  "name": "Yummi Go 好味走走",
  "short_name": "Yummi Go",
  "start_url": "/",
  "display": "standalone",
  "theme_color": "#1d5937",
  "background_color": "#fef9ed",
  "icons": [
    {"src":"/icon-192.png","sizes":"192x192","type":"image/png"},
    {"src":"/icon-512.png","sizes":"512x512","type":"image/png"}
  ]
}
```

### Service Worker（Workbox 策略）
- App shell（HTML/CSS/JS）→ cacheFirst
- drust API → networkFirst（offline fallback：上次的快照）
- 圖片 → cacheFirst with 30 天 TTL
- 字體 → cacheFirst with stale-while-revalidate

### 安裝提示
- 偵測 `beforeinstallprompt` event → 自訂 banner「加入主畫面」

### 推播
- v1：in-app banner 模擬（用餐前 1 小時、飢餓提醒等）
- v2：Web Push API（需要 server 端 VAPID key，本 prototype 不做）

---

## 9. Dev panel

右下角 4 按鈕（透明度 40%）：
| 按鈕 | 功能 |
|---|---|
| ⏱ | 切換 day（real-time / compressed / manual） |
| 🐸 | 強制寵物階段（egg/baby/youth/adult/max） |
| ⟳ | Reset 該用戶所有 drust 資料 |
| 📊 | 模擬不同活躍度（100% / 70% / 50%） |

---

## 10. 部署

| 階段 | 命令 | 結果 |
|---|---|---|
| 開發 | `npm run dev` | http://localhost:5173 |
| Build | `npm run build` | `dist/` 靜態檔 |
| Preview | `npm run preview` | 本地測 production build |
| 部署 | TBD | drust 是否提供靜態托管？否則用 GitHub Pages / Vercel / Netlify |

PWA 強制 HTTPS（localhost 例外）。

---

## 11. 開發時程估計

| 階段 | 工時（單人） |
|---|---|
| Schema 建立 + seed CSV | 1.5 h |
| Vite + TS + nanostores 骨架 | 1 h |
| Auth + 全域 state | 2 h |
| Onboarding 7 步 | 3 h |
| Home + Pet evolution | 3 h |
| Map（Leaflet + 評論流程） | 4 h |
| Check-in + mock AI | 3 h |
| Tasks + Quiz | 3 h |
| Profile + 月曆 | 3 h |
| 30 天結算 | 2 h |
| PWA + Dev panel + 樣式 polish | 3 h |
| **合計** | **~28.5 小時** |

可請 codex 平行做的部分：
- Seed scripts（CSV 解析 + drust REST POST）
- Quiz 答題邏輯 + 講解 UI
- 自編 10-15 家台北素食餐廳資料

---

## 12. 與既有產出的銜接

| 既有檔 | 在新 PWA 中的角色 |
|---|---|
| `tokens.css` | 直接搬到 `src/styles/tokens.css` |
| `design.md` | 設計來源文件，不直接改 |
| `workflow.md` | 流程參考，但 spec 後 5 模組架構為主 |
| `prototype.html` | 棄置（已知資訊已轉到此設計）|
| `_assets/pet-frog-front.png` 等 | 上傳到 drust 已完成、PWA 直接引用 URL |
| Drust 上 4 張角色圖 | 已可從 public URL 直接取用 |

---

## 13. 下一步

1. ✅ 設計文件存檔（本文件）
2. ⏭️ **superpowers:writing-plans** 拆出實作 task list
3. ⏭️ 用 MCP 建立 11 個 drust collections + RPC（auth）
4. ⏭️ Vite 專案 init
5. ⏭️ 平行：codex 寫 seed script、自寫骨架
6. ⏭️ 開始開發各模組（依 §11 順序）

---

## 附錄 A — 待釐清項目

從 spec / techfile 找出但未在本設計中決定的：

| # | 項目 | 暫時決定 | 後續確認 |
|---|---|---|---|
| 1 | 等級表三套不一致（MD / DOCX / 積分制度 CSV） | 採用積分制度 CSV 版本 | 確認最終 |
| 2 | Gem 規則衝突（碎片 vs Gem） | 採 CSV：超過 100 XP 直接換 Gem；MD 的「碎片→補簽卡」獨立計算 | 確認與 PM |
| 3 | 幸運色推播：每日全體 vs 依登入天數 | 依登入天數（較易實作） | 確認與 PM |
| 4 | 食物對應顏色資料庫 | 自建 30 種食物 lookup（spec 寬鬆原則） | 後續擴充 |
| 5 | 30 天結算實際內容 | 寶箱二選一（餐廳優惠券 vs 公益捐款）+ 徽章 + Impact Report 圖卡 | 確認與 PM |
| 6 | 餐廳首驗證 +20 還是前兩週 +50 | 前兩週 +50，之後 +20 | 確認與 PM |
| 7 | 檢舉成立獎勵數值 | +20 XP | 確認與 PM |
| 8 | Username vs 寵物名 | 兩者都可 — onboarding 設「寵物名」當主顯示 | 確認與 PM |
