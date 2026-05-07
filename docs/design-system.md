# Yummi Go — Design System

來源：`Color Palette & Typography (App)/Color-A-1_typography.pdf`（與 `Color_A_1_final_.ai` 內容一致）

---

## 1. Color A_1

色彩系統分為三組基礎色階（Primary、Secondary、Neutrals），每組 10 個 token，依「Light → Normal → Dark → Darker」漸進；另有 7 個語意化（semantic）色票對應實際 UI 用途。

### 1.1 Primary（主色 — 深綠）

代表 app 的品牌綠，用於主要 CTA、寵物頭像光暈、選中狀態。

| Token | Hex | RGB |
|---|---|---|
| Light | `#e8eeeb` | `rgb(232, 238, 235)` |
| Light :hover | `#dde6e1` | `rgb(221, 230, 225)` |
| Light :active | `#b9ccc1` | `rgb(185, 204, 193)` |
| **Normal** | `#1d5937` | `rgb(29, 89, 55)` |
| Normal :hover | `#1a5032` | `rgb(26, 80, 50)` |
| Normal :active | `#17472c` | `rgb(23, 71, 44)` |
| Dark | `#164329` | `rgb(22, 67, 41)` |
| Dark :hover | `#113521` | `rgb(17, 53, 33)` |
| Dark :active | `#0d2819` | `rgb(13, 40, 25)` |
| Darker | `#0a1f13` | `rgb(10, 31, 19)` |

### 1.2 Secondary（副色 — 暖橘）

用於提示、進度高亮（例：日曆「使用」按鈕、Rewards 已解鎖徽章）。

| Token | Hex | RGB |
|---|---|---|
| Light | `#fff4e8` | `rgb(255, 244, 232)` |
| Light :hover | `#feefdc` | `rgb(254, 239, 220)` |
| Light :active | `#fdddb7` | `rgb(253, 221, 183)` |
| **Normal** | `#fa9217` | `rgb(250, 146, 23)` |
| Normal :hover | `#e18315` | `rgb(225, 131, 21)` |
| Normal :active | `#c87512` | `rgb(200, 117, 18)` |
| Dark | `#bc6e11` | `rgb(188, 110, 17)` |
| Dark :hover | `#96580e` | `rgb(150, 88, 14)` |
| Dark :active | `#70420a` | `rgb(112, 66, 10)` |
| Darker | `#583308` | `rgb(88, 51, 8)` |

### 1.3 Neutrals（中性色 — 灰階）

> 註：原始檔案拼字為 `Nuetrals`（typo），此處統一作 `Neutrals`。

用於文字次要層、disabled 狀態、未解鎖 Rewards 徽章。

| Token | Hex | RGB |
|---|---|---|
| Light | `#fcfcfc` | `rgb(252, 252, 252)` |
| Light :hover | `#fbfbfb` | `rgb(251, 251, 251)` |
| Light :active | `#f7f7f7` | `rgb(247, 247, 247)` |
| **Normal** | `#e5e5e5` | `rgb(229, 229, 229)` |
| Normal :hover | `#cecece` | `rgb(206, 206, 206)` |
| Normal :active | `#b7b7b7` | `rgb(183, 183, 183)` |
| Dark | `#acacac` | `rgb(172, 172, 172)` |
| Dark :hover | `#898989` | `rgb(137, 137, 137)` |
| Dark :active | `#676767` | `rgb(103, 103, 103)` |
| Darker | `#505050` | `rgb(80, 80, 80)` |

### 1.4 Semantic Colors（語意色）

對應 shadcn/Tailwind 風格的語意化命名，給 component 直接使用。

| Token | Hex | 用途 |
|---|---|---|
| Background | `#FEF9ED` | 暖奶油色，頁面底色 |
| Foreground | _(原檔未填 hex，視覺上為 Primary Normal `#1d5937`)_ | 主文字色（深綠） |
| Card | `#FFFFFF` | 卡片底色 |
| Foreground (alt) | `#2D2A26` | 暖深棕，主文字色（替代用） |
| Muted | `#F5F1E8` | 淡米色，次要區塊底色 |
| Accent | `#F6FCA7` | Hover 狀態 |
| Destructive | `#E85D75` | 珊瑚紅，錯誤訊息 |

> ⚠️ **Accent 註記**：原檔文字標示 `#F6FCA7`（淡黃綠），但旁邊視覺色塊呈現為暖橘色。實作前建議跟設計確認以哪個為準。

---

## 2. Typography Scale

雙語字體系統 — 拉丁字採 **Nunito**，繁體中文採 **Noto Sans TC**。兩套字體共用同一套 scale 名稱，但各自的字重與字級略有不同。

| Scale | Nunito（拉丁） | Noto Sans TC（中文） |
|---|---|---|
| Title Cover / 文件標題 | ExtraBold 48 pt | Bold 48 pt |
| Heading 1 / 大標題 1 | Bold 33 pt | Bold 48 pt ⚠️ |
| Heading 2 / 大標題 2 | Black 28 pt | Bold 28 pt |
| Heading 3 / 大標題 3 | Semibold 24 pt | Medium 24 pt |
| Body / 內文 | Semibold 16 pt | Medium 16 pt |
| Caption / 備註 | Regular 12 pt | Light 12 pt |
| Button (XL) | Bold 24 pt | Bold 24 pt |
| Button (L) | Bold 20 pt | Bold 20 pt |
| Button (M) | Bold 18 pt | Bold 18 pt |

> ⚠️ **H1 不一致**：Nunito H1 為 33 pt，但 Noto Sans TC H1 標示為 48 pt（與 Title Cover 同級）。判斷為原稿筆誤，建議統一為 33 pt 或請設計確認。

### 2.1 字重對照速查

| Scale | 拉丁 weight | 中文 weight |
|---|---|---|
| Title / H1–H2 | 700–900（Bold/Black/ExtraBold） | 700（Bold） |
| H3 / Body | 600（Semibold） | 500（Medium） |
| Caption | 400（Regular） | 300（Light） |
| Button | 700（Bold） | 700（Bold） |

### 2.2 Web 載入建議

```html
<!-- Google Fonts -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Noto+Sans+TC:wght@300;500;700&display=swap" rel="stylesheet">
```

```css
/* font-family stack：拉丁字優先 Nunito，中文 fallback 到 Noto Sans TC */
font-family: "Nunito", "Noto Sans TC", system-ui, sans-serif;
```

---

## 附錄：原始檔對應位置

| 內容 | 來源檔 | 頁次 |
|---|---|---|
| App mockups（Pet / Daily Missions / Profile） | `Color_A_1_final_.ai` | p.1–3 |
| Typography Scale | `Color_A_1_final_.ai` / `typography_scale_1.ai` | p.4 / p.1 |
| Color A_1（含 semantic） | `Color_A_1_final_.ai` | p.5 |
| 同上（PDF 匯出） | `Color-A-1_typography.pdf` | p.1–3 |
