/**
 * Demo winners for the Gem-store 「中獎名單」 tab. Used as fallback when
 * the drust `store_winners` collection is unreachable or empty.
 *
 * Real winner records will be inserted by the monthly draw process —
 * admin exports SurveyCake submissions → picks winners → writes rows
 * into `store_winners`. For the prototype these illustrative rows
 * show the shape: per-banner grouping, masked display name, a draw
 * date.
 */
import type { StoreWinner } from '@/api/store-winners';

export const STORE_WINNERS_FIXTURE: StoreWinner[] = [
  // 蓮香齋 — banner_id 1
  { id: 1, banner_id: 1, banner_title: '蓮香齋 8 折用餐券', display_name: '小綠', email: 'xiaolu.chen@gmail.com',   drawn_at: '2026-06-01 10:00:00' },
  { id: 2, banner_id: 1, banner_title: '蓮香齋 8 折用餐券', display_name: '阿芽', email: 'aya.lin@gmail.com',         drawn_at: '2026-06-01 10:00:00' },
  { id: 3, banner_id: 1, banner_title: '蓮香齋 8 折用餐券', display_name: '皮蛋', email: 'piedan.wu@gmail.com',       drawn_at: '2026-06-01 10:00:00' },
  // Plant Lab — banner_id 2
  { id: 4, banner_id: 2, banner_title: 'Plant Lab 大安店 9 折優惠', display_name: '豆豆', email: 'doudou.huang@gmail.com', drawn_at: '2026-06-01 10:00:00' },
  { id: 5, banner_id: 2, banner_title: 'Plant Lab 大安店 9 折優惠', display_name: '小翠', email: 'xiaocui.li@gmail.com',  drawn_at: '2026-06-01 10:00:00' },
  // Charity — banner_id 3
  { id: 6, banner_id: 3, banner_title: '慈濟蔬食基金捐贈券', display_name: '蛋蛋', email: 'dandan.zheng@gmail.com',    drawn_at: '2026-06-02 12:00:00' },
  // Verde (last month, archived) — banner_id 4
  { id: 7, banner_id: 4, banner_title: '5 月份 — Verde 蔬食小館', display_name: 'Demo User', email: 'demo.user@gmail.com', drawn_at: '2026-05-30 18:00:00' },
  { id: 8, banner_id: 4, banner_title: '5 月份 — Verde 蔬食小館', display_name: 'Vegan Taster', email: 'taster@gmail.com', drawn_at: '2026-05-30 18:00:00' },
];
