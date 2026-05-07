**分析報告**

1. **總頁數與每頁畫面名稱/功能**

PDF 實際偵測為 **1 頁大型流程圖**，不是逐 screen 分頁匯出。該頁中可辨識出約 **31 個 mobile screen / 狀態畫面**，依流程順序如下：

1. 啟動畫面：Yummi Go Logo
2. Onboarding 首頁：Yummi Go Images，含 Get Started / Log in
3. 登入 Bottom Sheet：Google / 手機 OTP / Apple / 稍後
4. 飲食習慣調查：選擇 Vegan / Vegetarian / Flexitarian / Omnivore / Skip
5. 每天吃肉頻率：all meals / 2 meals/day / 1 meal/day / Skip
6. 參加挑戰目的：Body management / Environment protection / Make a vow / Skip
7. 選擇挑戰類型：all of the meals / 2 meals/day / 1 meal/day / Skip
8. 動畫說明：取得 challenge rule
9. 當日歡迎訊息：詢問使用者今天要打卡哪一餐
10. 餐食辨識動畫入口：Yummi Go Animation，Take a photo / Skip
11. 首次取得 XP 動畫：提示 XP + Y
12. Save Your XP：要求登入以保存 XP
13. 設定 Username
14. 如何得知這個 APP：Facebook / Instagram / Threads / 親友分享 / Skip
15. 設定進食時間
16. Home Page
17. 相機拍攝畫面
18. AI 辨識中：照片預覽與「AI 掃描辨識中」
19. 食品是否含肉確認：詢問「請問這是肉嗎？」是 / 不是
20. 任務失敗：照片含肉，Home / Try Again
21. 任務失敗：未能成功偵測到照片，Try Again
22. 辨識等待中：已將肉排除，等待檢測結果
23. 成功辨識/下一餐提醒：提示「下一餐記得不能吃肉喔」
24. 完成打卡動畫
25. 獲得 XP 動畫：+20 XP，第一餐
26. 獲得 XP 動畫：+20 XP，第一餐、第二餐
27. 獲得 XP 動畫：+30 XP，完成今日每餐吃蔬食任務
28. 獲得 XP 動畫：+15 XP，幸運包
29. XP + Gem 彈窗/Bottom Sheet：取得更多獎勵說明，Share
30. 飲食紀錄/營養分析頁：XP Gem、飲食建議、營養素、食材列表
31. 分享畫面：照片卡片與 Share CTA

2. **推測 User Flow**

主要流程分成 **首次進入 / 登入分支 / 問卷設定 / 每日打卡 / 獎勵分享**：

啟動畫面 → Onboarding 首頁 →  
分支 A：Get Started → 飲食習慣調查 → 每天吃肉頻率 → 參加挑戰目的 → 選擇挑戰類型 → 動畫說明 → 當日歡迎訊息 → 餐食辨識入口  
分支 B：Already have account? Log in → 登入 Bottom Sheet → 回到後續流程

餐食辨識流程：  
Home Page → 相機拍照 → AI 辨識中 → 判斷照片是否有效 / 是否含肉

判斷分支：
- 含肉：任務失敗 → Home 或 Try Again
- 未成功辨識：任務失敗 → Try Again → 回到拍照
- 不含肉 / 通過辨識：完成打卡動畫 → XP 獎勵動畫

獎勵分支：
- 完成一餐：+20 XP
- 完成兩餐：+20 XP
- 完成全天任務：+30 XP
- 幸運包：+15 XP
- 首次 XP 或需保存 XP：導向 Save Your XP → Login → Username → 如何得知 APP → 設定進食時間

分享 / 紀錄流程：
XP 獎勵 → XP + Gem 彈窗 → Share → 分享照片畫面  
或進入飲食紀錄/營養分析頁查看 XP Gem、食物分類與營養素。

3. **主要 UI 元件清單**

- **Status Bar / iPhone Frame**：所有畫面皆為 iPhone mockup，頂部時間 9:41、Dynamic Island、訊號與電量。
- **Back Navigation**：問卷與設定流程左上角有 Back，搭配頂部 step progress。
- **Step Progress Bar**：多段水平進度線，黑色代表當前步驟，灰色代表未完成。
- **Primary Button**：黑底白字，圓角膠囊，例如 Continue、Share、Try Again。
- **Secondary Button**：淺灰底黑字膠囊，例如 Get Started、Google Login、Apple 登入、選項按鈕。
- **Outline Button**：白底灰框，例如 Skip、Already have an account? Log in。
- **Choice Buttons**：問卷選項使用全寬灰色膠囊按鈕，垂直排列。
- **Bottom Sheet**：登入彈窗、XP + Gem 說明彈窗；有灰色 grabber、圓角頂部。
- **Camera UI**：全螢幕相機預覽、底部圓形拍攝鍵、右上關閉 X。
- **Photo Preview Card**：大張餐點照片，上方或下方有 AI 狀態提示 pill。
- **Confirmation Controls**：是 / 不是膠囊按鈕，用於確認照片是否含肉。
- **Reward Progress**：D2-D7 小圓點、餐次圓形徽章、打勾 icon。
- **Reward Badge**：幸運包使用紫色圓形 icon。
- **Nutrition / Record Cards**：白底區塊，列表式顯示食物分類、分數、營養素與克數。
- **Share CTA**：黑底膠囊按鈕，含分享 icon。

4. **每頁 / 每畫面文字內容摘要**

1. 啟動畫面：`Yummi Go`、`Logo`
2. Onboarding：`Yummi Go`、`Images`、`Get Started`、`Already have an account? Log in`
3. 登入：`Log in`、`Google 登入`、`手機 OTP 登入`、`Apple 登入`、`我沒有帳號`
4. 飲食習慣調查：`用戶飲食習慣調查`、`Vegan 純素`、`Vegetarian 蛋奶素`、`Flexitarian 有時不吃肉`、`Omnivore 無肉不歡`、`Skip`
5. 吃肉頻率：`每天吃肉的頻率`、`all of the meals`、`2 meals/day`、`1 meal/day`、`Skip`
6. 挑戰目的：`參加挑戰的目的`、`Body management`、`Environment protection`、`Make a vow`、`Skip`
7. 挑戰類型：`選擇挑戰類型`、`all of the meals`、`2 meals/day`、`1 meal/day`、`Skip`
8. 動畫說明：`Yummi Go Animation`、`You got an egg...`、`challenge rule`
9. 當日歡迎：`Yummi Go Animation`、`Daily Welcome`、`Hi, how’s it going?`、詢問今天最後一餐/打卡相關文字
10. 餐食辨識入口：`Yummi Go Animation`、`Take a photo`、`Skip`
11. 首次 XP：`Yummi Go Animation`、`恭喜用戶獲得 XP + Y`
12. Save XP：`Save Your XP`、`Google Login`、`手機 OTP 登入`、`Apple 登入`、`Skip`
13. Username：`設定 Username`、輸入框
14. 得知 APP 來源：`如何得知這個 APP`、`Facebook`、`Instagram`、`Threads`、`親友分享`、`Skip`
15. 進食時間：`設定進食時間`、輸入框
16. Home：`Yummi Go`、`Home Page`
17. 相機：拍攝畫面，右上關閉，底部拍攝鍵
18. AI 辨識：`AI 掃描辨識中...`、`放置物照片`、`e.g., 請在底部上面`
19. 是否含肉：`請問這是肉嗎？`、`是`、`不是`
20. 任務失敗：`任務失敗動畫`、`蔬食餐不能有肉嗚嗚嗚...`、`Home`、`Try Again`
21. 偵測失敗：`任務失敗動畫`、`未能成功偵測到照片，請重新拍照`、`Try Again`
22. 等待辨識：`已將肉排除於檢測肉/素肉中！`、`放置物照片`
23. 下一餐提醒：`下一餐記得不能吃肉喔～`、`放置物照片`
24. 完成打卡：`完成打卡動畫`、`恭喜你完成今天的餐食打卡`、`Continue`
25. +20 XP：`獲得 XP 動畫`、`+20 XP`、`太棒了！用蔬食展開新的一天！`、`第一餐`、`Continue`
26. +20 XP：同上，增加 `第二餐`
27. +30 XP：`+30 XP`、`恭喜你完成今天每餐吃蔬食任務`、`第一餐`、`第二餐`、`第三餐`
28. +15 XP：`+15 XP`、`Lucky！你擁有了今天的幸運色～`、`幸運包`
29. XP + Gem：`Title`、`取得 XP + Gem 的圖 or 動畫`、飲食建議、`Share`
30. 營養分析：`453`、飲食類別/分數、營養素如 `生菜`、`優格`、`小黃瓜`、`櫻桃` 等
31. 分享畫面：照片、提示文字、`放置物照片`、`Share`