# Yummi Go — Documentation

## Folder structure

```
docs/
├── design-system.md          色彩 + 字型 token 規範（從 Figma / AI 萃取）
├── workflow.md               Onboarding + 每日打卡的 user flow
├── tokens.css                CSS variables（同 src/styles/tokens.css）
├── plans/
│   ├── 2026-05-07-yummi-go-pwa-design.md          整體 PWA 設計
│   └── 2026-05-07-yummi-go-pwa-implementation.md  78-task 實作計畫
├── analysis/
│   ├── codex-techfile-summary.md  Codex 對 techfile/ 的全文摘要
│   ├── codex-group4-flow.md       Codex 對 Group 4.pdf 流程圖的解析
│   └── codex-spec-comparison.md   Codex 對 prototype vs spec 差異的分析
└── spec/                     原始 spec 文件（從 PM 提供的 techfile/）
    ├── 全球蔬食推動專案_App 產品規格書.md   (1.6MB，含 base64 圖)
    ├── _spec_clean.md                       (40KB，圖片移到 _spec_images/)
    ├── _spec_images/                        14 張 spec 圖
    ├── _md_clean.txt                        無圖純文字版
    ├── _yummygo_spec_v1.4.txt               DOCX 轉純文字
    ├── yummygo_spec_v1.4.docx               原始 DOCX
    ├── Yummi Go Content Database.xlsx - 30天挑戰腳本與每日任務.csv
    ├── Yummi Go Content Database.xlsx - Quiz Database Default (Traditional CH).csv
    └── Yummi Go Content Database.xlsx - 積分制度.csv
```

## 設計來源檔（design-assets/）

```
design-assets/
├── color-palette/                Color Palette & Typography (App) 來源
│   ├── Color_A_1_final_.ai       Illustrator 主檔
│   └── Color-A-1_typography.pdf  PDF 匯出版
├── characters/                   3 個角色的 PSD 原檔
│   ├── elephant-1.psd
│   ├── frog-2.psd
│   └── koala-1.psd
├── typography/                   字型規範
│   └── typography_scale_1.ai
├── flow-export-group4.pdf        Figma 匯出的 user flow（30+ 畫面）
├── flow-export-group4.jpg        同上 JPG 版
└── extracted/
    ├── character-pngs/           從 PSD 萃取的乾淨單角色 PNG
    ├── psd-previews/             PSD 整體合成預覽 + 圖層樹
    └── figma-screenshots/        Figma MCP 抓的局部截圖
```

## Scripts (scripts/)

- `seed-drust.py` — 把 techfile 的 CSV 灌進 drust（quiz / challenge / restaurants）
- `extract-pet-assets.py` — 從 PSD 萃取單角色 PNG
- `psd-extract.py` — 通用 PSD → PNG 預覽與圖層樹工具

執行需 `pip install psd-tools Pillow`。

## 後端

drust BaaS（multi-tenant SQLite）：
- Tenant ID: `fec8119d-0231-40f7-a7d6-c580ad312e96`
- Base URL: `https://tool.tzuchi-org.tw/drust/t/<tenant>`
- Anon token 有完整 CRUD 權限（prototype-grade，正式上線需要 proxy 層）
- 12 collections + 4 anon-callable RPCs：見 `plans/2026-05-07-yummi-go-pwa-design.md` §2
