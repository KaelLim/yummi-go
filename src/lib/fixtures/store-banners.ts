/**
 * Demo banners for the Gem store. Used as fallback when the drust
 * `store_banners` collection is unreachable or empty.
 *
 * Real banner images live on the campaign CMS — `image_url` points at
 * external assets. For the fixture we use placeholder gradients via
 * data-URI strings so the page renders cleanly without network deps.
 *
 * Status legend (mirrors the drust schema):
 *   active   — tappable card, full colour
 *   disabled — greyed-out image with "已結束" overlay
 *   archive  — hidden from the list (still present in DB)
 */
import type { StoreBanner } from '@/api/store-banners';

export const STORE_BANNERS_FIXTURE: StoreBanner[] = [
  {
    id: 1,
    title: '蓮香齋 8 折用餐券',
    description: '本月限量 30 張，填寫資料後抽獎',
    image_url: null,
    status: 'active',
    cost_gems: 50,
    surveycake_url: 'https://www.surveycake.com/s/demo-lianxiang',
    partner_name: '蓮香齋',
    monthly_limit: 30,
    sort_order: 1,
  },
  {
    id: 2,
    title: 'Plant Lab 大安店 9 折優惠',
    description: '本月限量 20 張，每月匯出名單抽獎',
    image_url: null,
    status: 'active',
    cost_gems: 40,
    surveycake_url: 'https://www.surveycake.com/s/demo-plantlab',
    partner_name: 'Plant Lab',
    monthly_limit: 20,
    sort_order: 2,
  },
  {
    id: 3,
    title: '慈濟蔬食基金捐贈券',
    description: '把 30 顆能量石轉成蔬食公益捐款',
    image_url: null,
    status: 'active',
    cost_gems: 30,
    surveycake_url: 'https://www.surveycake.com/s/demo-charity',
    partner_name: '慈濟',
    monthly_limit: null,
    sort_order: 3,
  },
  {
    id: 4,
    title: '5 月份 — Verde 蔬食小館',
    description: '上個月活動已結束，歡迎關注下次活動',
    image_url: null,
    status: 'disabled',
    cost_gems: 50,
    surveycake_url: null,
    partner_name: 'Verde 蔬食小館',
    monthly_limit: null,
    sort_order: 99,
  },
];
