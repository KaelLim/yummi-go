import type { Flow } from './_types';

const flow: Flow = {
  id: 'first-checkin',
  name: '首次打卡',
  description: '由 pet-name 自動進入首次打卡 → AHA banner → 選挑戰難度 → 設用餐時間 → 回 /home（後續打卡則由 /home 進入）',
  order: 2,
  nodes: [
    { id: 'home',          routePath: '/home',                          title: 'Home',                  description: '點「打卡」',                       x: 1, y: 0 },
    { id: 'capture',       routePath: '/check-in',                      title: '拍照',                   description: '相機 / 上傳圖片',                  x: 1, y: 1 },
    { id: 'scanning',      routePath: '/check-in/scanning',             title: 'AI 辨識',                description: 'Dev picker：🌱 無肉 / 🥩 有肉',      x: 1, y: 2 },
    { id: 'result',        routePath: '/check-in/result',               title: '辨識結果',               description: '無肉 → 直接送出；有肉 → 詢問',       x: 1, y: 3 },
    { id: 'fail',          routePath: '/check-in/fail',                 title: '下一餐加油',             description: '使用者確認有肉，鼓勵下一餐',         x: 0, y: 4 },
    { id: 'success',       routePath: '/check-in/success',              title: 'Success + AHA',         description: '三幕動畫 + 第一次 banner',         x: 2, y: 4 },
    { id: 'challenge',     routePath: '/onboarding/challenge-level',    title: '挑戰難度',               description: '1/1.5/2× 進化速度',                x: 2, y: 5 },
    { id: 'eat-times',     routePath: '/onboarding/eat-times',          title: '用餐時間',               description: '三餐通知時段',                    x: 2, y: 6 },
    { id: 'home-after',    routePath: '/home',                          title: 'Home（已完成設定）',     description: '回主介面，level-bar 即時更新',       x: 2, y: 7 },
  ],
  edges: [
    { from: 'home',      to: 'capture',    trigger: '點「打卡」' },
    { from: 'capture',   to: 'scanning',   trigger: '拍 / 上傳照片' },
    { from: 'scanning',  to: 'result',     trigger: '點 dev picker 卡片' },
    { from: 'result',    to: 'fail',      trigger: '有肉 → 確認「是」' },
    { from: 'result',    to: 'success',    trigger: '無肉 / 替換成植物肉' },
    { from: 'success',   to: 'challenge',  trigger: '繼續守護 (首次：challenge_level=null)' },
    { from: 'challenge', to: 'eat-times',  trigger: '選擇難度 (首次：eat_times=null)' },
    { from: 'eat-times', to: 'home-after', trigger: '完成設定' },
  ],
};

export default flow;
