# App 產品規格書

# `App 產品規格書`

## **`一、產品定位`**

* `產品名稱： Yummi Go 好味走走`

* `核心價值 (Core Value)： 「最大化方便性」。這是一個解決找餐廳與紀錄痛點的工具 App，寵物系統僅作為誘因。我們不計算複雜的碳數據給用戶看，而是讓用戶感覺良好、輕鬆響應。`

* `目標族群 (Target Audience)：`

  * `年齡層： 18-35 歲` 

  * `核心受眾： 佔市場約 20% 的「有興趣響應但缺乏機會」的群體（含肉食者與彈性素食者)。`

  * `用戶畫像： 原本就有想法，但因不方便、缺乏動力而無法持續的族群。`

  * `產品類比： 蔬食界的 Duolingo, 核心是「找吃/紀錄」（工具），寵物是「誘因」`

  ## **`二、 產品功能`** 

    `核心功能模組 (Utility - 70% 權重），本區塊為 MVP 開發重點，旨在降低使用者行動門檻。`

1. ### **`蔬食地圖 (35%) 可見附錄一`**

* `核心痛點解決： 解決「去哪吃」的問題，降低尋找蔬食的阻力。`

* `基礎架構：`

  * `串接 Google Maps API 作為底層數據。`

  * `同時計畫尋找可合作夥伴取得他們既有的database`

* `地圖狀態與餐廳分類：`

  * `用戶打開地圖時，會針對鄰近區域顯示灰色圖釘及綠色圖釘`

  * `圖釘顏色邏輯： 用戶到訪並透過 App 寫下餐廳評論（上傳照片、確認素別），圖釘轉為綠色 (Green Pins)`

| `狀態名稱` | `顯示類型` | `說明` | `顯示行為` |
| :---- | :---- | :---- | :---- |
| `待評論地點` | `灰色圖釘` | `從第三方 API (如 Google Places) 匯入,且尚未有App 用戶提交店家評論。` | `圖釘顯示為灰色。資訊視窗標示「餐廳待驗證」` |
| `已評論地點` | `綠色圖釘` | `當首位用戶上傳當日餐點與菜單/店家照片以及文字評論，並手動選擇「素別」`  | `圖釘轉為綠色。` |
| `合作餐廳` | `藍色圖釘` | `有合作優惠的廠商` | `顯示藍色圖釘` |

			`目前 Prototype 設計邏輯`

| `狀態名稱` | `顯示類型` | `說明` |
| :---- | :---- | :---- |
| `待審核餐廳` | `灰色圖釘` | `使用者可在地圖搜尋餐廳，確認店家資訊後，加入待審核餐廳` |
| `已審核餐廳` | `綠色圖釘` | `經後台確認後，將由灰色圖釘轉為綠色圖釘` |
| `合作餐廳` | `藍色圖釘` | `有合作優惠的廠商` |

* `素別認證:`

  `當三位以上不同使用者回報的「素別」一致時，系統自動判定資料屬實，於頁面上標上素別標籤，並將資料存入正式資料庫。`

* `搜尋與篩選：`

  * `素別篩選： 全素、蛋奶素、五辛素、鍋邊素（方便素）。`

  * `餐廳類別: 中式、西式、咖啡廳、日式、泰式、甜點（依照 google maps API 連動資訊）`

* `餐廳地圖縮圖`

  * `點擊圖釘顯示卡片縮圖 (帶入google maps 店家頁面首圖)`

  * `縮圖旁邊顯示店名 (帶入google maps 店家名稱)`

* `餐廳詳情頁 (Place Detail Page)：`

  * `頁面上半部為餐廳資訊:店家名稱、電話、營業時間、地址 (連動google maps 對應資訊)`

  * `頁面下半部`

    * `若為灰色圖釘，進入餐廳頁面即可點擊上傳評論按鈕，進行餐廳驗證`

    * `若為綠色圖釘，進入餐廳頁面即可看到其他用戶針對餐廳之評價(順序最新日期排列)、上傳評論按鈕、素別、餐廳類別以及更多資訊按鈕(點擊按鈕後使用者將跳轉至Google Maps 店家頁面了解更多資訊，如同範例中其他現有地圖，對外連動按鈕連結幾乎導致店家座標，但我們希望的是google maps 店家頁面)`

      * `上傳評論按鈕`  
        * `素別選擇: 全素、蛋奶素、五辛素、鍋邊素（方便素）`  
        * `文字內容/上傳圖檔/影片`  
        * `星星 (滿分五顆星)`

    * `檢舉機制 (Report Action)： 若上傳之照片不符合餐廳內容或含有肉類，其他使用者可點擊評論匡右上角之檢舉按鈕。`

      * **`執行方式：`** `點擊檢舉後，由下方彈出（Bottom Sheet）檢舉原因選單。`

      * **`選項設計（單選）：`**

1. `照片或評論含有肉類 (Contains meat)`  
2. `照片造假或與該餐廳無關 (Fake/Irrelevant photo)`  
3. `餐廳已歇業或資訊錯誤 (Incorrect place info)`  
4. `惡意或不當言論 (Inappropriate content)`  
5. `其他（選擇此項需強制填寫文字說明）`

   * **`獎勵：`** `若檢舉經後台管理員審核成立，檢舉者可獲得額外積分（XP）獎勵，以鼓勵社群共同維護地圖品質。`

     

2. ### `紀錄：AI 飲食打卡 (35%)`

* `核心痛點解決： 解決「紀錄麻煩」與「缺乏成就感」的問題。`

* `功能概述:`

  `使用者透過拍照上傳當日餐點，系統利用 AI 視覺辨識技術自動判別餐點內容、素別，並將資料連結至使用者的飲食紀錄與寵物成長系統。`

* `功能分區說明`  
1. `拍照打卡（核心動作按鈕）： 啟動影像捕捉與 AI 辨識流程。`  
2. `打卡紀錄（個人日誌）： 儲存並展示使用者過去的飲食歷史、營養統計與素別分佈。`

* `權利要求與相機使用`  
1. `權限請求: 按下相機按鈕後，系統需掉用手機相機權限。`  
2. `異常處理:`  
   * `若為第一次使用: 跳出系統權限詢問視窗(授權同意)。`  
   * `若使用者未同意授權: 系統需彈出提示視窗，顯示說明文字:「尚未獲得相機授權，請同意後繼續」，並提供「前往設定」的快捷連結。`

* `拍攝預覽階段`  
1. `影像捕捉: 按下相機按鈕後，系統需掉用手機相機權限。`  
2. `預覽視窗: 拍攝完成後進入預覽畫面，下方提供兩個操作選項:`  
   * `重新拍攝： 捨棄當前照片，返回相機拍攝介面。`  
   * `進行分析： 將照片傳送至 AI 伺服器進行食材與營養解析。`

* `AI 辨識與分析結果呈現`  
  `分析完成後，系統進入「結果確認頁面」，顯示食材種類列表。`  
* `數據欄位：`   
  `每一項辨識出的食材需標註其預估營養成分：`  
  * `卡路里 (kcal)`  
  * `蛋白質 (Protein)`  
  * `碳水化合物 (Carbs)`  
  * `脂肪 (Fat)`  
* `使用者編輯權限（手動修正）：`  
  * `修改結果： 使用者可點擊任一食材名稱或數值進行手動更正。`  
  * `新增食物： 若 AI 漏掉部分食材，使用者可點擊「新增食物」按鈕手動搜尋並加入。`

* `素別記錄與存檔`  
* `素別添加：`   
  `在儲存紀錄前，使用者必須選擇該餐點的 素別（全素、蛋奶素、五辛素、鍋邊素）。`  
  * `註：系統可根據 AI 辨識結果自動建議素別，但保留使用者最終選擇權。`  
* `完成紀錄： 按下確認後，資料寫入「打卡紀錄」，並觸發寵物系統獎勵。`

* `打卡紀錄展示 (UI 以月曆形式呈現於App 個人頁面)`  
  * `每日統計： 自動加總當日所有打卡紀錄的總營養攝取量（卡路里、蛋白質等）。`  
  * **`視覺回饋 (UI Display)：`** `以純淨的圖示或色塊呈現打卡狀態（例如：達成一日一餐顯示單葉片、一日三餐顯示幸運草或個素別呈現不同顏色或印章）`

* **`重要系統邏輯_無照片儲存機制：`**   
  `為優化雲端儲存成本與保護用戶隱私，AI 飲食打卡系統不永久儲存用戶隨手拍的餐點照片。照片僅供 AI 伺服器即時分析，待使用者確認食材與營養數據 (Data) 並點擊儲存後，照片檔案即刻銷毀，資料庫僅保留文字與數值紀錄。`

  `![][image1]`

* **`進階連動機制：評論即打卡`**   
  * **`機制說明：`** `為極大化使用者便利性，當使用者於「蔬食地圖」中對任何餐廳提交包含「餐點照片」與「素別選擇」的評論時，系統將視同使用者完成一次「AI 飲食打卡」。`  
  * **`資料處理邏輯：`** `該張照片將被保留於地圖資料庫供社群檢視；同時，系統會在背景呼叫 AI 解析該照片之營養數據（卡路里、蛋白質），並自動同步至使用者的個人日誌中。`  
  * **`獎勵結算：`** `使用者將同時獲得「地圖評論」與「飲食打卡」的雙重經驗值獎勵，加速寵物升級。`  
  * **`介面設計 (多圖防呆)：`** `當使用者上傳超過一張照片時，UI 提示：「請點擊其中一張照片作為今日的『能量打卡照』⚡️」。使用者點選後，該照片右上角會出現一個綠色的精靈或相機小圖示。`  
  * **`系統邏輯 (多圖防呆)：`** `地圖資料庫依然會儲存所有的照片供社群觀看；但後端只會將被標記的那 「1 張」 照片發送給 AI 進行卡路里與蛋白質的分析。`

* `獎勵積分制度: 待補充`  
  `我認為素別的積分制度不應該有所不同，這樣會造成有作弊的可能性`


3. ### **`產品功能 -寵物陪伴系統 (Retention - 20% 權重)`**

* `設計原則： 視覺上的陪伴感為主，不需複雜互動操作，讓 App 變得可愛、有溫度、小互動`

* `故事背景 (Backstory)：`  
  `世界被「灰霧」籠罩，用戶是「喚醒者 (The Awakener)」，透過吃蔬食收集能量來喚醒並照顧「生態精靈 (Eco-Mon)」`

* `成長邏輯 (Growth System)：`

		`寵物之成長將會依照個功能所累計之經驗值轉所相對應之等級`

`(等級及經驗值確切數字待確認)`

| `成長階段` | `等級區間` | `達成天數 (以每日 100 分計)` | `營運意義與用戶心理` |
| ----- | ----- | ----- | ----- |
| `孵化前 - 蛋` | `LV 1 - 5` | `第 0 ~ 4 天` | `新手期：極速升級，建立初步成就感。` |
| `孵化後 - 幼年` | `LV 6 - 18` | `第 5 ~ 21 天` | `蜜月期：外觀首次改變，陪伴感建立。` |
| `青年 (Youth)` | `LV 19 - 39` | `第 22 ~ 69 天` | `30天挑戰完結點 (LV 23) 落在這裡！ 用戶會為了看到下一次進化而留存。` |
| `成年 (Adult)` | `LV 40 - 79` | `第 72 ~ 229 天` | `長線習慣期： 約在挑戰後的第 2.5 個月進化，此時用戶已經把吃蔬食當作生活習慣。` |
| `完全體 (Max)` | `LV 80 - 100` | `第 234 ~ 348 天` | `終極目標 (將近一年)： 第 348 天達到 LV 100。` |

`or`

| `階段` | `等級 (Level)` | `所需經驗值` | `累計` | `達成天數` |
| :---- | :---- | :---- | :---- | :---- |
| `孵化前-蛋` | `LV1 →5` | `LV1→2 40 LV2→3 40 LV3→4 40LV 4→5 40 LV5→6 45` | `40 80 120 160 205` | `1 2 3 4 5` |
| `孵化後-幼年`  | `LV 6 →10` | `LV6→7 45 LV7→8 50 LV8→9 50 LV9→10 55 LV10→11 55` | `250 300 350 405 460` | `6 7 8 9 11` |
| `青年`  | `LV 11 →30` | `LV11→12 60 LV12→13 60 LV13→14 65 LV14→15 65 LV15→16 70 LV16→17 70 LV17→18 75 LV18→19 75 LV19→20 75 LV20→21 85` | `520 580 645 710 780 855 930 1005 1090` | `12 13 15 16 17 19 21 22 24 26` |
|  |  | `LV21→22 85 LV22→23 90 LV23→24 90 LV24→25 95 LV25→26 95 LV26→27 100 LV27→28 100 LV28→29 105 LV29→30 105 LV30→31 110` | `1175 1265 1355 1450 1545 1645 1745 1850 1955 2065` | `28 30 32 34 36 38 40 43 45 48` |

`[Yummi Go Content Database.xlsx](https://docs.google.com/spreadsheets/d/1dkXg67G4jDQJSpneLYPf6YsaRuO13PvZ/edit?usp=sharing&ouid=114642818069886829189&rtpof=true&sd=true)`

* `30 天挑戰完賽結算機制 (30-Day Milestone System)`

  `當用戶成功完成 30 天的蔬食挑戰時（依據其初始選擇的參與挑戰等級），系統將觸發「完賽結算慶典」。此時，寵物（生態精靈）的等級約落在 LV 23 的「青年期」，尚未達到完全體。系統將透過「三重破關獎勵」給予用戶極大的成就感，同時拋出進化懸念，引導用戶進入第 31 天後的長線習慣養成。`

  `機制實際內容待確認`

  * **`核心機制一：實質影響力二選一 (Real-World Impact Choice)`**  
    * **`設計依據：`** `根據市場調查，中文用戶高達 36.3% 渴望「超商購物金/外送折扣」，29.5% 希望「愛心回饋」；英文用戶亦有高達 43.5% 選擇「公益捐款 (Charity Donation)」，20.5% 選擇「實體折價券」。`  
    * **`UI 呈現：`** `結算畫面上跳出「破關寶箱二選一」。`  
      * **`選項 A（利己/實體回饋）：`** `獲得專屬合作蔬食餐廳的 8 折優惠券，或限量超商購物金/外送折扣碼。`  
      * **`選項 B（利他/愛心回饋）：`** `系統將用戶累積的積分轉化為真實公益行動，例如以用戶名義為地球種下一棵樹，或捐贈愛心基金至動物收容所。`  
  * **`核心機制二：虛擬榮耀與進化懸念 (Digital Badge & Cliffhanger)`**  
    * **`專屬徽章：`** `於個人頁 (Profile) 的成就儀表板中，永久解鎖並點亮一枚「30天初階喚醒者徽章」。`  
    * **`故事線引導 (Narrative)：`** `搭配寵物尚未滿級的設定，畫面跳出寵物的專屬對話框：「謝謝你這 30 天的綠色能量！我感覺身體變強壯了，但我真正的『完全體』還在沉睡... 你願意繼續陪我走下去嗎？」藉此勾起用戶好奇心，大幅降低 30 天後的流失率。`  
  * **`核心機制三：影響力總結與社群擴散 (Impact Report & Viral Share)`**  
    * **`數據視覺化：`** `系統依據「植境」提供的環境影響係數，自動生成一張專屬的「30天減碳成績單 (Impact Report)」。圖卡上將具象化呈現這 30 天來用戶為地球省下的碳排放 (CO2e)、水資源與土地面積，以及最高的連續打卡天數。`  
    * **`擴散獎勵：`** `提供一鍵分享至 Instagram 限時動態或 LINE 的功能。用戶只要成功分享成績單，即可獲得額外的 +20 XP，加速寵物邁向下一階段的進化，同時為 App 帶來免費的社群口碑行銷。`

  **`後續討論 - 1年後機制`**

  **`新的滿級機制：`** `當用戶花了一年的時間，終於在 LV 100 (第 348 天) 達到完全體後，他們才算正式「破關」。`

  **`破關後的榮耀：`** `此時他們溢出的 XP 會化為「能量果」，送給 LV 20 以下的新手。這不僅合理化了他們身為「資深玩家」的地位，也讓他們獲得「蔬食守護大師」頭銜的含金量變得極高！`

4. ### `產品功能 -內容點綴：挑戰與知識 (Content - 10% 權重)`

* `功能目的： 增加每日挑戰的多元性，避免單純打卡的作業感` 

* `知識問答 (Knowledge Quiz)：`

  * `形式： 每日一題選擇題（蔬食學堂）。`  
  * `內容： 涵蓋營養知識、環保數據冷知識（例如：生產一公斤牛肉需要多少水？）。`  
  * `內容取得方式: 將彙整題庫，將會有至少70題 (會再陸續增加)`

    [`https://docs.google.com/spreadsheets/d/1dkXg67G4jDQJSpneLYPf6YsaRuO13PvZ/edit?usp=sharing&ouid=114642818069886829189&rtpof=true&sd=true`](https://docs.google.com/spreadsheets/d/1dkXg67G4jDQJSpneLYPf6YsaRuO13PvZ/edit?usp=sharing&ouid=114642818069886829189&rtpof=true&sd=true)

* `獎勵機制：`

5. ### `產品功能 -每日任務 - 各功能彙整及提醒`

* `功能目的:` 

  * `增加黏著度：透過多樣化的任務（不只是吃），避免單純紀錄飲食的作業感，維持日活躍用戶`  
  * `行為引導：利用獎勵機制，鼓勵用戶執行 “攜帶環保餐具”、“攝取特定顏色蔬食” 等進階環保行為。`

* `每日任務與經驗值 (XP) 彙整 (待確認）`

| `任務類型` | `功能描述` | `獲取經驗值 (XP)` | `備註邏輯` |
| :---: | :---: | :---: | :---: |
| `飲食打卡` | `上傳蔬食餐點照片並通過驗證` | `+30 XP / 餐 +50 XP/ 3餐` | `若挑戰「一日三餐」全蔬食，第三餐給予加成 (共可得 110-130 XP)，鼓勵高強度參與。` |
| `環保行動` | `勾選「使用環保餐具/餐盒」` | `+15 XP` | `需在打卡上傳照片時一併勾選，培養減塑習慣。` |
| `今日幸運色` | `攝取當日指定顏色的蔬菜 (如紫色：茄子) 需要釐清顏色如何界定，如何判斷顏色是否正確 需要建立食物對應之顏色的資料庫` | `+15 XP` | `參考Excel檔中之顏色 需要釐清會是集體每日推播一種顏色 Or 依照玩家登入天數做推播` |
| `蔬食學堂` | `閱讀一則環保冷知識或健康小撇步` | `+15 XP` | `點擊首頁「知識氣泡」或參與每日問答。` |
| `餐廳認證/評論` | `完成餐廳評論` | `+20 XP` |  |

* `溢出機制與補簽系統`   
  `為了解決用戶「斷更」的壓力，設計了彈性的補救機制：`

  * `碎片轉換： 當日獲得超過 100 XP 的部分（例如一日三餐全勤者），每 100 XP 溢出值自動轉換為1個碎片`  
  * `補簽卡合成： 集滿 3 個碎片，可自動合成一張 「補簽卡 (Revival Card)」。`  
  * `用途： 當用戶某天忘記打卡導致連續紀錄中斷時，系統會自動消耗一張補簽卡來延續「連續天數 (Streak)」，防止用戶因一次失敗而棄坑。`

* `提醒與推播機制 (Notification & Trigger)`   
  `下方為範例文案，完整內容可參考[Yummi Go Content Database.xlsx](https://docs.google.com/spreadsheets/d/1dkXg67G4jDQJSpneLYPf6YsaRuO13PvZ/edit?usp=sharing&ouid=114642818069886829189&rtpof=true&sd=true)＿Tab` 寵物互動/ 劇情對話  
  `推播不使用生硬的系統語言，而是以寵物 (Eco-Mon) 的口吻與故事包裝來進行。`

  * `觸發條件 1：飢餓提醒 (Hunger)`

    * `時機： 距離上次打卡超過 24 小時。`  
    * `寵物狀態： 變為灰色、動作懶散、表情虛弱。`  
    * `推播文案： 「迷霧變濃了... 我需要綠色能量來呼吸！😰」（以情感勒索/撒嬌為主）。`

  * `觸發條件 2：客製化用餐提醒`  
    **`為了幫助用戶養成打卡習慣並契合個人作息，導入類似 iOS 睡眠排程的「專屬用餐提醒」功能`**

    * `時機：`   
      * `系統預設值為每日 12:30 (午餐) 或 18:30 (晚餐)。`  
      * `自訂功能： 用戶可於首次「飲食測驗 (Onboarding)」或「設定頁面」中，自行輸入個人的早、中、晚餐時間（例如：早餐 09:00、午餐 12:00）。`  
      * `提前推播： 系統將於用戶設定時間的**「前 10 分鐘」**自動發送推播，提醒用戶準備拍照記錄。`

        

    * `推播文案： 「聽說今天的幸運色是『紫色』！你要不要去尋找紫色的能量呢？🍆」`

  * `觸發條件 3：滿級/進化通知 (Evolution)`

    * `時機： 經驗值達到升級門檻（如 LV 5 升 LV 6 破殼時）。`  
    * `推播文案： 「蛋殼出現裂縫了！快來看看是誰要出來了！✨」`

  * `觸發條件 4：地圖提醒 (What to eat?)`  
    `結合使用者自訂的用餐時間，提前一小時發送推播，引導使用者開啟地圖尋找周邊餐廳。若附近有合作優惠餐廳，將優先於推播中提示專屬折扣，直接解決使用者尋找蔬食的便利性痛點。`

    * `時機：` 

      * `使用者自訂用餐提醒設定的**「前 1 小時」**（例如：使用者設定 12:30 午餐，系統將於 11:30 發送此推播）`

    * `推播文案：`

      * **`一般提醒版：`** `「想到今天午餐要吃什麼了嗎？打開地圖看看附近有什麼好吃的吧📍」`

      * **`折扣誘因版：`** `「想到今天午餐要吃什麼了嗎？打開地圖看看附近有什麼專屬折扣吧🎁」`

	`[Yummi Go Content Database.xlsx](https://docs.google.com/spreadsheets/d/1dkXg67G4jDQJSpneLYPf6YsaRuO13PvZ/edit?usp=sharing&ouid=114642818069886829189&rtpof=true&sd=true)`

## `三、用戶與後台系統`

1. ### `用戶端`

		**新手引導與註冊流程 (Onboarding Flow)**

* **`Step 1. 帳號註冊與授權：`**

  * `串接慈濟多元登入平台`

  * `隱私權與資料處理之法律相關同意確認。`

* **`Step 2. 歡迎故事與綠色承諾 (The Oath)：`**

  * **`故事背景：`** `畫面呈現被灰霧籠罩的世界與一顆沉睡的生態精靈蛋。`

  * **`心理制約：`** `用戶需勾選簽署「我承諾尋找真實能量來喚醒守護者」的綠色契約，作為防作弊策略的心理防護網。`

* **`Step 3. 飲食測驗與減碳基準線 (Baseline) 建立：`**

  * **`測驗內容：`** `調查用戶目前的飲食習慣（葷食、彈性素、鍋邊素、蛋奶素、全素），以及原本的肉類飲食比例（牛肉 / 豬肉 / 羊肉 / 雞肉）。`

  * **`減碳計算邏輯 (系統核心)：`**

    * `系統將依據此測驗結果建立該用戶的專屬 Baseline。`

    * `未來每次打卡，系統將自動對標其原本可能的肉類攝取量，並套用植境環境影響公式：$Impact_{Saved} = \sum(Q_{Meat} \times E_{Meat}) - \sum(Q_{Plant} \times E_{Plant})$。`

    * `例如：成功替代 1 公斤牛肉，系統將算得 60kg CO2e 減碳量與 15,400 公升省水量。（註：為保持介面簡潔，App 前台儀表板僅即時顯示「CO2 減碳量」；「省水量」與「土地」等數據僅存於後台，待 30 天完賽產生結算成績單時才完整展示。）`

* **`Step 4. 30 天挑戰難度選擇：`**

  * **`等級一：`** `只要這 30 天內，每天有一餐無肉就算達標。`

  * **`等級二：`** `挑戰 30 天三餐無肉，但給予 3 次不小心的機會（容錯機制）。`

  * **`等級三：`** `挑戰 30 天三餐無肉，完全不能中斷，挑戰意志力極限。`

* **`Step 5. 首日核心互動與頓悟時刻 (Day 1 Hook)：`**

  * **`情境引導：`** `完成難度選擇後，用戶正式進入 App 首頁，並領取寵物蛋。此時畫面呈現「灰霧濃重」的特效，並提示：「守護者氣息微弱，請立即啟動 AI 掃描器，為它注入第一道真實能量！」`

  * **`強制引導 (Tooltip)：`** `畫面上強制高亮底部導覽列的 [📷 打卡] 按鈕，引導用戶完成「第一次 AI 飲食打卡」。`

  * **`即時回饋：`** `當用戶成功上傳第一張照片並獲得 XP 後，首頁的灰霧會稍微散去，沉睡的蛋會播放「蛋殼出現裂痕、透出微光」的動畫，藉此建立次日開啟 App 的強烈期待感。`

2. ### `管理後台` 

* **`地圖與檢舉管理`**  
  `負責維護蔬食地圖的資料正確性，並審核由社群提交的檢舉案件。`

1. `餐廳檢舉列表: 管理員登入後可查看按「檢舉時間」或「檢舉次數」排序的待審核清單。列表需顯示以下欄位：`  
   * `被檢舉的餐廳名稱與評論內容（含圖檔/影片）。`  
   * `被檢舉人 ID。`  
   * `檢舉人 ID 與 檢舉原因（選項或文字說明）。`  
   * `該評論累積被檢舉的次數。`  
2. **`審核動作`**  
   `管理員可針對每一筆檢舉執行以下兩種操作之一：`  
   * `駁回檢舉 (Reject)： 經判定未違規，保留該則評論，結案。`  
   * `確認違規 (Approve & Penalize)： 經判定確實違規（如上傳肉類照片騙取積分）。系統將：`  
     1. `強制隱藏或刪除該則地圖評論。`  
     2. `扣除被檢舉人因此篇評論獲取的 XP。`  
     3. `在被檢舉人的帳號紀錄加上「1 次警告 (Strike)」。`  
3. **`系統自動連動懲罰：`**   
   `當後台判定違規並讓該用戶累積達 3 次警告（3 Strikes）時，系統將自動觸發「寵物食物中毒」的遊戲化懲罰。該用戶的生態精靈外觀會變綠/生病，並暫停其經驗值獲取功能 24 小時`

* **`獎勵制度管理`**  
1. `實體購物金`  
2. `合作餐廳優惠券`  
   `所有使用者:可於地圖上合作餐廳中看到餐廳提供優惠並前往餐廳出示App使用`  
   `個別獎勵:依後續建立制度提供個別餐廳優惠`  
3. `公益捐款`

* `數據儀表板 (Dashboard)：`

  1. `環境影響力看板： 全體用戶累積減少的 CO2/水/土地數據 (用於對內報告/對外行銷/贊助商報告)。`

* `內容管理： 題庫上架、推播訊息排程。`

* 後台更新管理紀錄/ 使用者有問題時會回傳到後台系統Log audit & Error Log

* `使用者`

  `帳號管理:`

  1. `刪除帳號`

     `行為管理:`

1. `關鍵指標： DAU (日活躍)、MAU (月活躍)、Retention Rate (留存率)。`  
   2. `各頁面用戶使用量`

   ## `四、開發時程規劃`

      **`Phase 1:`** `MVP 開發 (目前 - 2026.04)`

      **`Phase 2:`** `內部試營運 (2026.04 - 2026.04.10)`

      **`Phase 3:`** `正式發布 (Launch) (2026.04.22)`

      **`Phase 4:`** `社交與擴充 (Post-Launch)`

* `功能： PK 賽、好友排行榜、論壇功能、AI 自動辨識優化。`

  ## `五、目前開發進度`

  `請參考連結` 

  **`前端 prototype:`** [`https://yummigo.lufamily.one`

  *`Email:`* [`bob.smith@gmail.com Password: User123!`

  **`後台 prototype:`** [`https://cms-yummigo.lufamily.one/`

  *`Email:`* `admin@yummigo.com Password: Admin123!`

  `開發所需之前端與後端技術請參考 附件二`

  ## 

  ## `六、App 頁面架構`

`─ 底部導覽列 (Bottom Navigation Bar)`

    `├─ 1. Home 首頁` 

    `│   ├─ 寵物狀態與成長動畫 (依據經驗值呈現：蛋、幼年、青年、完全體)`

    `│   ├─ 能量值展示 (當前 XP 與升級進度條)`

    `│   └─ 進化與滿級機制` 

    `│`

    `├─ 2. 地圖 (Map)`

    `│   ├─ 餐廳卡片 (地圖縮圖、店名、灰/綠圖釘顯示)`

    `│   ├─ 餐廳詳情頁 (店家資訊、其他用戶評價、檢舉按鈕、連動 Google Maps 頁面)`

    `│   └─ 評論與驗證流程 (上傳圖檔/影片、素別選擇、星星評分、連動打卡雙重獎勵)`

    `│`

    `├─ 3. 打卡 (Check-in / Camera)`

    `│   ├─ 拍照 / 相簿上傳 (包含相機權限請求與異常處理)`

    `│   ├─ AI 辨識分析 (預覽視窗：重新拍攝或進行分析)`

    `│   └─ 結果確認頁 (手動修改/新增食材、確認素別、顯示卡路里與蛋白質、純數據存檔且不儲存照片)`

    `│`

    `├─ 4. 任務 (Tasks)`

    `│   ├─ 每日任務列表 (飲食打卡、環保行動、今日幸運色)`

    `│   ├─ 蔬食學堂 (每日一題環保與營養知識問答)`

    `│   ├─ 補簽系統 (溢出 XP 之碎片轉換進度、補簽卡合成)`

    `│   └─ 特殊成就任務 (地圖首位驗證者等)`

    `│`

    `└─ 5. 個人頁 (Profile)`

        `├─ 用戶名片 (頭像、用戶名稱、地區、素別標籤)`

        `├─ 成就儀表板 (每日打卡純數據月曆、累積天數/餐數、減碳總量)`

        `├─ 我的評論 (整合地圖評價紀錄)`

        `└─ 設定 (Settings)`

             `├─ 編輯個人資料`

             `├─ 打卡提醒排程 (客製化早/中/晚餐推播時間設定)`

             `└─ 密碼修改與登出`

`![][image2]`

# **美編設計**

#### **設計發想:** 

[**https://docs.google.com/presentation/d/1eVccaT4SeL8cjsWe3Y-t\_oLVTvCNJjgnT95AA-A1O6w/edit?usp=sharing**](https://docs.google.com/presentation/d/1eVccaT4SeL8cjsWe3Y-t_oLVTvCNJjgnT95AA-A1O6w/edit?usp=sharing)

動物參考: [**https://conservation.forest.gov.tw/0002224**](https://conservation.forest.gov.tw/0002224)

#### **角色數量**

* 1 隻寵物

  ---

  #### **成長階段（3階段）**

1. 蛋（Egg）  
2. 幼年（Baby）  
3. 青年（Teen）

👉 每隻角色：

* 3 階段 × 1 角色 \= **3張主立繪**

  ---

### **狀態表情**

每一階段需有：

| 狀態 | 用途 | 張數 |
| :---- | :---- | :---- |
| 正常 | 日常首頁 | 1 |
| 開心 | 打卡成功 | 1 |
| 飢餓/虛弱/生氣 | 未打卡提醒 | 1 |
| 極度虛弱 | 連續多天未登入提醒 | 1 |
| 進化 | 升級動畫 | 1 |

👉 計算：

* 3個階段 x 1個角色 x × 5 表情 \= 15 **張**

  ---

  ### **UI用素材**

* 蛋裂動畫（1組）  
* 進化特效（1組）  
* 綠色能量粒子（1組）  
* 灰霧 overlay（1組）

  ---

### **總繪圖量（MVP）**

* 主角色：3  
* 表情：15  
* 特效/UI：4–6

👉 **總量：約 22-24 張**

---

### **風格指引（要寫清楚給繪師）**

* 風格：療癒 / Duolingo感 / 可以符合現在流行趨勢 (可愛同時有點厭世的元素)  
* 情緒：  
  * 不 guilt-heavy（避免壓力）  
  * 偏「陪伴」而不是「責備」

**希望讓大家記得的那一幕是什麼？**

![][image3]

# 附件一

1. **蔬福生活**   
   餐廳呈現方式: 若沒有選擇地點，餐廳不會自動出現 (左圖為選擇前，右圖為選擇後)  
   **![][image4]![][image5]**  
     
   **店家資訊呈現方式**  
   自營地圖系統，非每家店都有關於、餐點、菜單等訊息  
   地址連動的google maps為坐標定位，無法直接呈現店家  
   **![][image6]![][image7]![][image8]**

2. **蔬市圈**  
   在進入App之後，餐廳會自動呈現  
   雖然頁面上呈現google review分數, 但無連結至店家 google 頁面  
   App餐廳頁面上的動態消息、菜單、評論、相片、關於皆為空白  
   **![][image9]![][image10]![][image11]**  
     
3. **Happy Cow**  
   是一個自營的蔬食地圖平台，地圖標示明確，分為全素、蛋奶素、有蔬食選項三種選擇  
   餐廳頁面也有自己的評論、店家資訊 \-\> 維運成本高  
   **![][image12]**  
   **![][image13]![][image14]**

**What can we do?**  
在了解完上述不同蔬食地圖的呈現方式後，我們希望利用 Google Maps, 同時結合平台資源。  
因此我們將會利用google maps 顯示自動搜尋和蔬食相關的店家，為避免搜尋結果有誤，自動搜尋結果將不會進到後台 Database，App使用者將會需要透過拍照、評論進行認證，標記店家為全素、蛋奶素或有蔬食選項。

**邏輯流程**

### **階段 A：「灰色」世界（未驗證）**

* 使用者動作： 在新城市打開地圖。  
* App 邏輯：  
  1. 調用內部資料庫（DB）：「這裡有任何儲存過的 ID 嗎？」 \-\> 結果：0。  
  2. 調用 Google API：「搜尋餐廳。」 \-\> 結果：20 個地點。  
  3. 篩選：檢查這 20 個 ID 是否存在於資料庫中（結果：皆不存在）。  
* UI 顯示： 顯示 20 個灰色大頭針。

### **階段 B：「遊戲化」行為（評論）**

* 使用者動作： 點擊灰色大頭針 \-\> 點選「評論此地點」。  
* App 邏輯：  
  1. 開啟表單：「選擇分類（全素 / 蛋奶素 / 蔬食選項）」 \+ 「上傳照片」 \+ 「撰寫評論」。  
  2. 使用者提交。  
* 後端動作：  
  1. 將 `place_id`、店名、分類及照片儲存至資料庫。  
  2. 獎勵機制： 檢查 `first_verifier_id`（首位驗證者 ID），給予使用者 \+50 積分。  
* UI 更新： 大頭針立即由灰色變為綠色（蔬食）。

### **階段 C：「深層連結」（導航）**

* 使用者動作： 點擊任何大頭針上的「查看更多 」。  
* App 邏輯：  
  1. App 不需要預存連結，而是利用 ID 即時生成。  
  2. 構建 URL：`https://www.google.com/maps/search/?api=1&query=Google&query_place_id=[PLACE_ID]`  
* 結果： 連結至 Google Maps 商家頁面。

### **階段 D：持續更新的地圖**

* **使用者動作：** 在新城市打開地圖。  
* **App 邏輯：**  
  1. 調用內部資料庫（DB）：「這裡有任何儲存過的 ID 嗎？」 \-\> 結果：5。  
  2. 調用 Google API：「搜尋餐廳。」 \-\> 結果：20 個地點。  
  3. 篩選：檢查這 20 個 ID 是否存在於資料庫中（結果：5 個已存在）。  
* **UI 顯示：** 顯示 15 個灰色大頭針，以及 5 個根據分類顯示不同顏色的針。  
* **互動：** 不論點擊哪個標籤頁時，顯示使用者評論與「查看更多」 \-\> 連結至 Google Maps 商家頁面。

# **附件二**

**Required Languages**

| Language | Usage | Proficiency Needed |
| :---- | :---- | :---- |
| **Go (1.24)** | **Backend API, business logic, services** | **Advanced** |
| **Dart (3.10+)** | **Flutter mobile/web frontend** | **Advanced** |
| **SQL (PostgreSQL 16\)** | **Database migrations, queries** | **Intermediate-Advanced** |
| **PowerShell / Bash** | **Setup & deployment scripts** | **Basic** |

**Backend Skills (Go)**

* **Fiber v3 \- HTTP framework (Express-like for Go)**  
* **GORM \- ORM for database operations, migrations, relationships**  
* **JWT authentication \- Token generation, validation, refresh rotation (golang-jwt/jwt)**  
* **OAuth 2.0 / OpenID Connect \- Google, Microsoft, Apple sign-in (go-oidc)**  
* **Password security \- bcrypt hashing**  
* **Input validation \- go-playground/validator**  
* **Repository/Service pattern \- Clean architecture with interfaces**  
* **Unit testing \- Go's testing package \+ testify (assert & mock)**

**Frontend Skills (Flutter/Dart)**

* **Flutter \- Cross-platform (iOS, Android, Web)**  
* **Provider \- State management pattern**  
* **GoRouter \- Declarative routing**  
* **Dio \- HTTP client with interceptors (JWT auto-refresh)**  
* **Google Maps Flutter \- Maps, clustering, geolocation**  
* **OAuth integration \- google\_sign\_in, sign\_in\_with\_apple, flutter\_appauth**  
* **Image handling \- Camera capture, gallery selection**  
* **Secure storage \- Encrypted token persistence**  
* **Widget testing \- flutter\_test \+ mockito**

**Database & Infrastructure**

| Technology | Purpose | Skill Level |
| :---- | :---- | :---- |
| **PostgreSQL 16** | **Primary database** | **Intermediate-Advanced** |
| **PostGIS 3.4** | **Geospatial queries (restaurant radius search, geography types)** | **Intermediate** |
| **Redis 7** | **Caching, session management, leaderboards** | **Intermediate** |
| **Docker / Docker Compose** | **Container orchestration (5 services)** | **Intermediate** |
| **Nginx** | **Reverse proxy for Flutter web** | **Basic** |

**External Services / APIs**

* **Google Cloud \- Cloud Storage (image uploads), OAuth**  
* **Google Maps Platform \- Maps SDK, Places API**  
* **Microsoft Azure AD \- OAuth provider**  
* **Apple Developer \- Sign in with Apple**

**Domain Knowledge**

**The developer should understand:**

1. **Gamification mechanics \- Energy systems, pet evolution stages, streaks, leveling, CO2 scoring**  
2. **Geospatial concepts \- PostGIS geography types, WKB encoding, spatial queries**  
3. **Authentication flows \- JWT access/refresh tokens, OAuth 2.0, OIDC**  
4. **REST API design \- Versioned endpoints, standardized responses, middleware chains**  
5. **Clean architecture \- Handler → Service → Repository layering with interfaces**

**DevOps / Tooling**

* **Makefile \- 30+ build/test/deploy targets**  
* **Docker Compose \- Multi-service orchestration with health checks**  
* **Git \- Version control, conventional commits**  
* **VS Code \- Pre-configured tasks (13 tasks)**  
* **golang-migrate \- Database migration CLI**

**Ideal Developer Profile**

**The best fit is a full-stack developer with:**

1. **Primary: Strong Go backend experience (Fiber or similar frameworks, GORM, JWT)**  
2. **Primary: Flutter/Dart for cross-platform mobile and web**  
3. **Secondary: PostgreSQL with PostGIS geospatial experience**  
4. **Secondary: Docker containerization and deployment**  
5. **Bonus: OAuth integration across multiple providers**  
6. **Bonus: Game design / gamification experience**

# **附件三 \- 碳排放**

| Entity | Greenhouse gas emissions per kilogram | Freshwater withdrawals per kilogram | Land use per kilogram |
| :---- | ----- | ----- | ----- |
| Beef (beef herd) | 99.48 | 1451.2 | 326.21 |
| Dark Chocolate | 46.65 | 540.6 | 68.96 |
| Lamb & Mutton | 39.72 | 1802.8 | 369.81 |
| Beef (dairy herd) | 33.3 | 2714.3 | 43.24 |
| Coffee | 28.53 | 25.9 | 21.62 |
| Prawns (farmed) | 26.87 | 3515.4 | 2.97 |
| Cheese | 23.88 | 5605.2 | 87.79 |
| Fish (farmed) | 13.63 | 3691.3 | 8.41 |
| Pig Meat | 12.31 | 1795.8 | 17.36 |
| Poultry Meat | 9.87 | 660 | 12.22 |
| Eggs | 4.67 | 577.7 | 6.27 |
| Rice | 4.45 | 2248.4 | 2.8 |
| Groundnuts | 3.23 | 1852.3 | 9.11 |
| Cane Sugar | 3.2 | 620.1 | 2.04 |
| Tofu | 3.16 | 148.6 | 3.52 |
| Milk | 3.15 | 628.2 | 8.95 |
| Oatmeal | 2.48 | 482.4 | 7.6 |
| Tomatoes | 2.09 | 369.8 | 0.8 |
| Beet Sugar | 1.81 | 217.7 | 1.83 |
| Other Pulses | 1.79 | 435.7 | 15.57 |
| Wine | 1.79 | 78.9 | 1.78 |
| Maize | 1.7 | 215.7 | 2.94 |
| Wheat & Rye | 1.57 | 647.5 | 3.85 |
| Berries & Grapes | 1.53 | 419.6 | 2.41 |
| Cassava | 1.32 | 0 | 1.81 |
| Barley | 1.18 | 17.1 | 1.11 |
| Other Fruit | 1.05 | 153.5 | 0.89 |
| Peas | 0.98 | 396.6 | 7.46 |
| Soy milk | 0.98 | 27.8 | 0.66 |
| Bananas | 0.86 | 114.5 | 1.93 |
| Other Vegetables | 0.53 | 102.5 | 0.38 |
| Brassicas | 0.51 | 119.4 | 0.55 |
| Onions & Leeks | 0.5 | 14.3 | 0.39 |
| Potatoes | 0.46 | 59.1 | 0.88 |
| Apples | 0.43 | 180.1 | 0.63 |
| Nuts | 0.43 | 4133.8 | 12.96 |
| Root Vegetables | 0.43 | 28.4 | 0.33 |
| Citrus Fruit | 0.39 | 82.7 | 0.86 |

**Data source: Poore and Nemecek (2018) – Learn more about this data**  
[**OurWorldinData.org/environmental-impacts-of-food**](https://ourworldindata.org/environmental-impacts-of-food) **| [CC BY](https://creativecommons.org/licenses/by/4.0/)**

# **注意事項**

1\. Google account

	\- How does TC manage cloud accounts?

	\- What about cost management?

	\- What about permission management?

	\- What about security management?

2\. SSO with TC

	\- What is required for integration?

	\- What information will need to be shared?

	\- Provide API endpoint documentation

	\- Is there a development site that we can use?

	\- Is the development site open to public or internal network only?

3\. Legal

	\- Will there be support from legal?

		\- For contract and licenses

	\- Will legal assist in providing legal content for app?

4\. IT

	\- Does TC have an repository for storing soruce code?

1\. Contract

	\- Will there be a contract?

	\- Under no changes to code:

		\- What happens when the app is compromised?

2\. Source code

	\- Where will the source code be stored?

	\- How will the source code be provided?

	\- Will there be unit tests to ensure that everything works?

	\- How to ensure code is secure with no vulnerabilities?

	\- CI/CD implemented?

3\. Development

	\- Will they provide all the assets as well? (Pictures)

	\- Will there be a full documentation?

	\- Will there be a backend for content creators to add/edit content?

4\. Content

	\- Will there be support for multi-language?

	\- What contents will we need to provide?

[image1]: ./_spec_images/image1.png

[image2]: ./_spec_images/image2.png

[image3]: ./_spec_images/image3.png

[image4]: ./_spec_images/image4.png

[image5]: ./_spec_images/image5.png

[image6]: ./_spec_images/image6.png

[image7]: ./_spec_images/image7.png

[image8]: ./_spec_images/image8.png

[image9]: ./_spec_images/image9.png

[image10]: ./_spec_images/image10.png

[image11]: ./_spec_images/image11.png

[image12]: ./_spec_images/image12.png

[image13]: ./_spec_images/image13.png

[image14]: ./_spec_images/image14.png