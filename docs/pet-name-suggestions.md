# Pet Name Suggestions

Source-of-truth list for the `pet_name_suggestions` drust collection (used by
`/onboarding/pet-name` to randomise the initial pet name). The live drust
collection is admin-editable and takes precedence over the hardcoded fallback
in `src/api/content.ts:81-87`.

This file is a merge of:

1. The current 40 rows live in drust (`sample_rows pet_name_suggestions`,
   sort_order 1–40 preserved so existing users keep familiar names).
2. The 50-name draft we generated earlier, minus 14 overlaps with drust and
   3 names containing negative terms (胖 / 肥 / 呆) — those were stripped per
   the "no negative connotations" rule.

Total: **73 names**. All 2 characters. All vegan-friendly food references.

**Current drust state (as of 2026-05-18):** 65 of the 73 rows are live —
sort_order 1–63 plus 70 and 71. The remaining 8 (sort_order 64–69, 72, 73:
葡萄, 蕉蕉, 木瓜, 蓮霧, 鳳梨, 小櫻, 湯圓, 滾滾) are parked in this file only,
pending a later decision before seeding.

## Merged list

| #  | Name | Pattern        | Source | Hint                         |
| -- | ---- | -------------- | ------ | ---------------------------- |
| 1  | 小綠 | 小 + colour    | drust  | Little Green                 |
| 2  | 阿芽 | 阿 + plant     | drust  | Sprout                       |
| 3  | 嫩嫩 | reduplicated   | drust  | Tender Tender                |
| 4  | 豆豆 | reduplicated   | drust  | Bean Bean                    |
| 5  | 小翠 | 小 + colour    | drust  | Little Emerald               |
| 6  | 抹茶 | snack          | drust  | Matcha                       |
| 7  | 米粒 | grain          | drust  | Rice Grain                   |
| 8  | 蛋蛋 | reduplicated   | drust  | Egg Egg                      |
| 9  | 球球 | reduplicated   | drust  | Ball Ball                    |
| 10 | 滴滴 | reduplicated   | drust  | Droplet Droplet              |
| 11 | 圓圓 | reduplicated   | drust  | Round Round                  |
| 12 | 元氣 | abstract       | drust  | Vitality                     |
| 13 | 樂樂 | reduplicated   | drust  | Happy Happy                  |
| 14 | 麻吉 | slang          | drust  | Buddy (mochi-derived)        |
| 15 | 卡比 | mascot         | drust  | Kirby-ish                    |
| 16 | 春春 | reduplicated   | drust  | Spring Spring                |
| 17 | 小苗 | 小 + plant     | drust  | Little Seedling              |
| 18 | 阿森 | 阿 + nature    | drust  | Forest                       |
| 19 | 草草 | reduplicated   | drust  | Grass Grass                  |
| 20 | 翡翠 | gem            | drust  | Jade                         |
| 21 | 麻糬 | snack          | drust  | Mochi                        |
| 22 | 布丁 | snack          | drust  | Pudding                      |
| 23 | 奶酪 | snack          | drust  | Milk Curd                    |
| 24 | 芒果 | fruit          | drust  | Mango                        |
| 25 | 蜜糖 | sweet          | drust  | Honey Sugar                  |
| 26 | 雪花 | nature         | drust  | Snowflake                    |
| 27 | 露露 | reduplicated   | drust  | Dew Dew                      |
| 28 | 小雨 | 小 + nature    | drust  | Little Rain                  |
| 29 | 雲朵 | nature         | drust  | Cloud                        |
| 30 | 啵啵 | onomatopoeia   | drust  | Pop Pop                      |
| 31 | 啾啾 | onomatopoeia   | drust  | Chirp Chirp                  |
| 32 | 嘰嘰 | onomatopoeia   | drust  | Squeak Squeak                |
| 33 | 蘿蔔 | vegetable      | drust  | Radish                       |
| 34 | 薄荷 | herb           | drust  | Mint                         |
| 35 | 草莓 | fruit          | drust  | Strawberry                   |
| 36 | 桃桃 | reduplicated   | drust  | Peach Peach                  |
| 37 | 柚柚 | reduplicated   | drust  | Pomelo Pomelo                |
| 38 | 小白 | 小 + colour    | drust  | Little White                 |
| 39 | 阿黑 | 阿 + colour    | drust  | Lil' Black                   |
| 40 | 米米 | reduplicated   | drust  | Rice Rice                    |
| 41 | 苗苗 | reduplicated   | new    | Seedling Seedling            |
| 42 | 小青 | 小 + colour    | new    | Little Verdant               |
| 43 | 阿草 | 阿 + plant     | new    | Grass                        |
| 44 | 葉葉 | reduplicated   | new    | Leaf Leaf                    |
| 45 | 小葉 | 小 + plant     | new    | Little Leaf                  |
| 46 | 阿筍 | 阿 + vegetable | new    | Bamboo Shoot                 |
| 47 | 茶茶 | reduplicated   | new    | Tea Tea                      |
| 48 | 抹抹 | reduplicated   | new    | Matcha (short)               |
| 49 | 阿蔥 | 阿 + vegetable | new    | Scallion                     |
| 50 | 小蘿 | 小 + vegetable | new    | Little Radish (short)        |
| 51 | 阿薯 | 阿 + vegetable | new    | Potato                       |
| 52 | 玉米 | vegetable      | new    | Corn                         |
| 53 | 毛豆 | vegetable      | new    | Edamame                      |
| 54 | 小蕊 | 小 + plant     | new    | Little Pistil                |
| 55 | 蓮蓮 | reduplicated   | new    | Lotus Lotus                  |
| 56 | 小荷 | 小 + plant     | new    | Little Lotus Leaf            |
| 57 | 嘟嘟 | onomatopoeia   | new    | Soft/Chubby                  |
| 58 | 噗噗 | onomatopoeia   | new    | Poof Poof                    |
| 59 | 小柚 | 小 + fruit     | new    | Little Pomelo                |
| 60 | 阿薇 | 阿 + plant     | new    | Fern                         |
| 61 | 青青 | reduplicated   | new    | Verdant Verdant              |
| 62 | 小蘋 | 小 + fruit     | new    | Little Apple                 |
| 63 | 西瓜 | fruit          | new    | Watermelon                   |
| 64 | 葡萄 | fruit          | new    | Grape                        |
| 65 | 蕉蕉 | reduplicated   | new    | Banana Banana                |
| 66 | 木瓜 | fruit          | new    | Papaya                       |
| 67 | 蓮霧 | fruit          | new    | Wax Apple                    |
| 68 | 鳳梨 | fruit          | new    | Pineapple                    |
| 69 | 小櫻 | 小 + fruit     | new    | Little Cherry                |
| 70 | 萌萌 | reduplicated   | new    | Cute Cute                    |
| 71 | 包包 | reduplicated   | new    | Bun Bun                      |
| 72 | 湯圓 | snack          | new    | Tangyuan (rice ball)         |
| 73 | 滾滾 | reduplicated   | new    | Rolling Rolling (panda meme) |

## Removed during merge

**Overlaps (already in drust, dropped from the new additions):**
小綠, 阿芽, 豆豆, 小翠, 蛋蛋, 小苗, 米米, 啾啾, 桃桃, 草莓, 芒果, 圓圓, 球球, 麻糬

**Negative-term names (dropped):** 胖胖, 呆呆, 阿肥 — 胖 / 肥 read as "fat" and 呆 reads as "dim". A randomised pet name shouldn't insult the user's pet.

## Using this list

To seed the new rows into drust without disrupting existing users:

- Keep `sort_order` 1–40 untouched (drust already has these).
- Insert rows 41–73 via `insert_record pet_name_suggestions` with their
  `sort_order` and `active: 1`.

The hardcoded fallback in `src/api/content.ts` only needs to mirror enough
names to stay useful when drust is unreachable — five is fine, but updating it
to a handful from the merged list keeps it in sync.
