# Yummi Go UX Update Spec v0.3

**版本**：v0.3
**更新日期**：2026.05.21
**目的**：給 Claude Code 用來更新 web prototype，對齊 5/21 規格 audit 後決議的修正項
**範圍**：6 項聚焦修正（皆為 prototype 與最新規格不一致的核對應修）
**前提**：本次只處理數值 / 邏輯層；寵物對話狀態化、飢餓-無聊-虛弱狀態機、下一隻寵物 / 圖鑑、Gem 商城都不在本版範圍

---

## 0. 修正範圍總覽

| # | 項目 | 嚴重度 | 主要檔案 |
|---|---|---|---|
| 1 | 寵物進化模型對齊 30 天 / 5 階段 | Blocker | `src/lib/pet-evolution.ts` |
| 2 | 100 XP 達標獎勵 = 10 Gem（移除重複的 +1）| Major bug | `src/store/today.ts` |
| 3 | 餐點 XP 拆解（20×3 + 獨立 +10 完成獎勵）| Major | `src/lib/xp-calc.ts`、`src/lib/missions.ts` |
| 4 | 評論 XP：每間餐廳首次 20、後續 15 | Major | `src/routes/restaurant-verify.ts`、`restaurant-review.ts` |
| 5 | Lucky Color 7 色 + 每日隨機 | Major | `src/lib/lucky-color.ts` |
| 6 | 補簽灰點存活規則對齊 streak | Major | `src/lib/calendar.ts`、`src/lib/streak.ts` |

---

## 1. 寵物進化模型對齊 30 天 / 5 階段

### 現況
`src/lib/pet-evolution.ts` 仍是 LV1-100 模型：
- Egg 1-5 / Baby 6-18 / Youth 19-39 / Adult 40-79 / Max 80-100

### 規格（First Pet）
- **30 天 / 5 階段** — Egg LV1-5 / Baby LV6-12 / Youth LV13-19 / Teen LV20-26 / Max LV27-30
- 每日 XP 上限 100，平均約 1 LV/day
- 30 天後寵物到達 Max，進入「下一隻寵物」流程（本版只先讓 LV30 顯示為 Max，下一隻寵物的完整流程留 v0.4）

### 修改要點
- `STAGE_THRESHOLDS` 改為 `[5, 12, 19, 26, 30]`
- `XP_PER_LEVEL` 改為 30 XP / LV（總 900 XP = 30 天 × 30 XP 平均；最終數值待規格組 v1.0 校準）
- 移除 LV31+ 相關邏輯（或統一視為 Max）
- 新增 `isFinalStage(LV)` 判定，LV27-30 視為 Max stage
- 寵物階段對應的 sprite / 表情建議：Egg → Baby → Youth → Teen → Max 五張

### 驗收
- LV1-5 顯示 Egg、LV6-12 Baby、LV13-19 Youth、LV20-26 Teen、LV27-30 Max
- 跨階段時觸發既有進化動畫
- LV30 後 XP 進度條停在 100%、不再升級

---

## 2. 移除 100 XP 重複獎勵（+1 Gem bug）

### 現況
`src/store/today.ts` 與 `src/store/pet.ts` 各有一份 100 XP 里程碑邏輯，會同時觸發：
- `pet.ts` 給 +10 Gem（正確、規格內）
- `today.ts` 給 +1 Gem（舊版殘留）

→ 用戶實際進帳 11 Gem，但 milestone popup 顯示 10 Gem。**這是會直接影響經濟系統正確性的 bug，優先處理。**

### 修改要點
- 刪除 `src/store/today.ts` 內：
  - `XP_MILESTONE_KEY`
  - `XP_MILESTONE_GEM_REWARD`
  - `maybeAwardXpMilestone` function
  - 所有呼叫點（約 line 67、line 165）
- 保留 `src/store/pet.ts` 的 `XP_MILESTONE_BONUS_GEMS = 10` 為唯一 100 XP 里程碑來源

### 驗收
- 跨 100 XP 後：Gem 餘額確切 +10（達標）+ 超出 XP × 1（加碼），總值與 popup 顯示完全一致
- 同一天不會重複觸發（由 `crossedTodayCap` 把關）

---

## 3. 餐點 XP 拆解

### 現況
`src/lib/xp-calc.ts` 把第三餐寫成 30 XP（把 +10 完成獎勵內建進去）。

### 規格
- 三餐各 **20 XP**（共 60）
- **完成全日三餐**額外 **+10 XP**（`meal_complete_bonus`），獨立一筆任務記錄
- 單日餐點相關 XP 上限 = 70

### 修改要點
- `mealXp` 改為固定 20（早、午、晚皆同）
- `src/lib/missions.ts` 新增 `meal_complete_bonus` mission row：
  - 條件：當日三餐皆有打卡完成
  - XP：+10
  - 觸發時機：第三餐打卡成功的 `awardXp` 之後立即發放（與第三餐獎勵分開兩筆 transaction）
  - 是否顯示為任務卡：是 — 三餐尚未完成前顯示「完成全日三餐 +10 XP」鼓勵語，完成後標記 done
- +XP 慶祝頁需能個別顯示「完成全日三餐 +10 XP」這筆（與第三餐 +20 分開兩個慶祝畫面，或合併但分行列出）

### 驗收
- 三餐都打卡：當日餐點相關 XP = 20+20+20+10 = 70
- 只完成兩餐：當日餐點相關 XP = 40，無 bonus 任務 done
- 第三餐打卡後：先看到 +20 XP，再看到 +10 XP 完成獎勵

---

## 4. 評論 XP：每間餐廳首次 20、後續 15

### 現況
- `src/routes/restaurant-verify.ts:36` 與 `restaurant-review.ts` 寫死 `REVIEW_XP = 20`
- 沒有判定是否為該餐廳的首次評論

### 規格
- 同一用戶 × 同一間餐廳 — **首次評論 = 20 XP**
- 同一用戶 × 同一間餐廳 — **第二次以後評論 = 15 XP**
- 跨餐廳不影響：去新店家還是 20

### Launch Boost（前 2 週）⚠️ 待最終確認是否啟用
- 暫定規格：上線後**前 2 週**地圖驗證、留評論皆 **= 50 XP**（取代 base，不疊加）
- 2 週後恢復：地圖驗證 = 20、評論 = 20 首評 / 15 後續
- 由 server-side 時間判定 launch window，避免用戶調手機時鐘鑽漏洞
- **狀態**：Sydney 仍在評估是否啟用 launch boost，工程實作時請保留 feature flag 以便日後切換

### 修改要點
- 新增 helper：`hasReviewedRestaurant(userId, restaurantId)`（查 reviews collection；若 drust 尚未有 user × restaurant 索引，可先 client-side filter）
- 評論送出時：
  - `!hasReviewedRestaurant` → +20 XP
  - else → +15 XP
- 任務卡 / 評論按鈕的 XP 顯示需動態：首次評該店「+20 XP（首評）」、之後「+15 XP」
- 文案池待文案資料庫補（不在本版）

### 驗收
- A 餐廳第一次評：+20，A 餐廳第二次評：+15
- B 餐廳第一次評：+20（與 A 無關）
- 評論完後返回 A 餐廳頁，再次評論的 XP 顯示應為 +15

---

## 5. Lucky Color：7 色 + 每日隨機

### 現況
- `src/lib/lucky-color.ts` 只有 6 色：橘併進黃、黑併進紫
- 來源是 `challenge_scripts` 靜態 RPC（每天哪一色是設計好的），非隨機

### 規格
- **7 色**：紅、黃、橘、綠、紫、黑、白
- **每日隨機抽 1 色**（每用戶獨立、每日獨立）
- 同一用戶同一天的 lucky color **固定**（不刷新會換、跨日才換）
- 用 `userId + dateKey` 做 seed，保證 idempotent

### 修改要點
- `COLORS` 改為 `['red', 'yellow', 'orange', 'green', 'purple', 'black', 'white']`
- 移除「橘 → 黃、黑 → 紫」的合併邏輯
- 新增 `pickDailyLuckyColor(userId, dateKey)`：用簡單 hash（如 djb2 / md5）seed，模 7 取色
- 不再讀 `challenge_scripts` 的 lucky_color 欄位（欄位可保留但忽略）
- 視覺：7 色 swatch + 任務卡背景樣式需備齊（橘色、黑色、白色為新增）

### 驗收
- 同一天連續開 app 多次：lucky color 不變
- 跨日 / 不同用戶：色彩可能不同
- 長期觀察（手動切日 30 次）：7 色都有機會出現，分佈大致均勻

---

## 6. 補簽灰點存活規則對齊 streak

### 現況
- `src/lib/calendar.ts:46` 用 `MAKEUP_WINDOW_DAYS = 3` 寫死 3 日視窗
- 超過 3 天的灰點直接消失
- 補簽資料只存 localStorage（沒進 drust）

### 規格
- 灰點存活條件：**streak 還活著就活著**（不論距今幾天）
- streak 死亡瞬間（連續 4 天未補簽）：**所有現存灰點轉 lost**（變一般白底數字 / 不可補）
- 補簽直接從 Gem 扣（無「補簽卡」物品）
- 月度重置定價：當月 1-3 次補簽 = 100 Gem / 第 4 次起 = 300 Gem（既有邏輯，沿用）

### 修改要點
- 移除 `MAKEUP_WINDOW_DAYS` 寫死的 3 日視窗
- `calendar.ts` 計算「該日是否仍可補」：判定 streak 是否仍活著（即連續未補天數 < 4）
- `streak.ts` 偵測到 streak 死亡時，呼叫 sweep function 把所有現存灰點轉 lost 狀態
- 補簽資料 drust 化建議獨立 ticket，本版可暫留 localStorage 不擋

### 驗收
- 用戶 5/1 漏簽、5/2-5/10 正常打卡：5/1 灰點還在、可付 Gem 補
- 用戶 5/1-5/4 連續漏簽（streak 死）：5/1-5/4 全部變 lost、無法再補
- streak 活著時，補簽超過 1 個月前的灰點也應允許（spec 並無時間上限）
- 補簽成功後 streak 維持連續

---

## 7. 不在本版範圍（明確排除）

| 項目 | 原因 | 預計處理時機 |
|---|---|---|
| 寵物對話狀態化（state-driven dialogue） | 規格、文案皆未到位 | v0.4 或更晚 |
| 飢餓 / 無聊 / 虛弱狀態機 | 工程量大、需後端 server timestamp 配合 | v0.4 |
| 下一隻寵物 / 圖鑑頁 | 60 天節奏 + Gem 解鎖機制細節仍在整理 | v0.4 |
| Gem 商城物品與定價 | 商城設計未開始 | v0.5 |
| 跨 100 XP 模式切換完整 popup 行為 | 規格組仍在 review；本版只修數字 | 待規格定案 |

---

## 8. 驗收清單（Smoke Test）

工程實作完成後，請逐項驗證：

- [ ] **100 XP**：跨 100 XP 一次後，Gem 進帳精確 = 10（不是 11），popup 顯示與實際進帳一致
- [ ] **餐點 XP**：三餐都打卡 → 餐點相關 XP = 70；兩餐打卡 → = 40
- [ ] **餐點完成 bonus**：第三餐打卡後，看到 +20 XP 接著 +10 XP 完成獎勵
- [ ] **評論 XP**：A 餐廳首評 +20、二評 +15；B 餐廳首評 +20（與 A 獨立）
- [ ] **Lucky Color**：同日重開 app 色彩不變；跨日色彩可能改變；7 色都有機會出現
- [ ] **寵物階段**：LV5 → Egg, LV6 → Baby, LV12 → Baby, LV13 → Youth, LV30 → Max
- [ ] **寵物進化**：跨階段（5→6、12→13、19→20、26→27）觸發既有進化動畫
- [ ] **補簽灰點**：streak 活著時，1 個月前的灰點仍可補；streak 死亡瞬間所有灰點變 lost

---

## 9. 版本紀錄

| 版本 | 日期 | 變更 |
|---|---|---|
| v0.2 | 2026.05.18 | 5/18 內部對焦會議後的 UX 決議（Home / TabBar / Tasks / 補簽 / Quest / 寵物 / Day 30 等）|
| v0.3 | 2026.05.21 | 基於 5/21 prototype audit 的 6 項聚焦修正：寵物進化模型 30 天/5 階段、100 XP 雙獎勵 bug、餐點 XP 拆解（20×3+10）、評論首次 20 後續 15、Lucky Color 7 色每日隨機、補簽灰點存活對齊 streak。寵物對話狀態化、飢餓/無聊/虛弱狀態機、下一隻寵物、Gem 商城都留 v0.4 以後。|
| v0.3.1 | 2026.05.21 | 補充 §4 Launch Boost：上線前 2 週地圖驗證/評論皆 = 50 XP（取代 base，不疊加），2 週後恢復 20 / 20-15。 |
