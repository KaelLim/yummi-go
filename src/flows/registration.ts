import type { Flow } from './_types';

const flow: Flow = {
  id: 'registration',
  name: '註冊與初次設定',
  description: 'Splash → Get Started 建匿名帳號 → 5-step onboarding → 直接進入首次打卡',
  order: 1,
  nodes: [
    { id: 'splash',       routePath: '/splash',                    title: 'Splash',           description: 'Logo hold 1.2s，Get Started CTA 露出', x: 1, y: 0 },
    { id: 'login',        routePath: '/login',                     title: '登入',             description: '已有帳號路徑 (diet-survey/register footer 進入)', x: 0, y: 1 },
    { id: 'diet',         routePath: '/onboarding/diet-survey',    title: '飲食習慣 (1/5)',   description: '葷 / 蛋奶素 / 全素 / 蔬食',  x: 2, y: 1 },
    { id: 'baseline',     routePath: '/onboarding/baseline',       title: '肉類基線 (2/5)',   description: '葷食者填，植物者直跳 purpose', x: 2, y: 2 },
    { id: 'purpose',      routePath: '/onboarding/purpose',        title: '挑戰目的 (3/5)',   description: '身體 / 環境 / 動物',         x: 2, y: 3 },
    { id: 'day1',         routePath: '/onboarding/day1-hook',      title: '蛋誕生 (4/5)',     description: '取得守護者蛋',              x: 2, y: 4 },
    { id: 'pet-name',     routePath: '/onboarding/pet-name',       title: '幫蛋取名 (5/5)',   description: '隨機建議 + 改名',           x: 2, y: 5 },
    { id: 'start',        routePath: '/onboarding/start-checkin',  title: '準備打卡',         description: '蛋餓了 + 開始/稍後選項',     x: 2, y: 6 },
    { id: 'capture',      routePath: '/check-in',                  title: '首次打卡',         description: '相機/上傳',                 x: 2, y: 7 },
  ],
  edges: [
    { from: 'diet',     to: 'login',    trigger: '點 footer「已有帳號？登入」' },
    { from: 'splash',   to: 'diet',     trigger: '點 Get Started → registerGuest()' },
    { from: 'diet',     to: 'baseline', trigger: '選擇葷食' },
    { from: 'diet',     to: 'purpose',  trigger: '選擇植物 (跳過 baseline)' },
    { from: 'baseline', to: 'purpose',  trigger: '繼續' },
    { from: 'purpose',  to: 'day1',     trigger: '選擇目的' },
    { from: 'day1',     to: 'pet-name', trigger: '點「進入」' },
    { from: 'pet-name', to: 'start',    trigger: '完成命名' },
    { from: 'start',    to: 'capture',  trigger: '點「開始打卡」' },
  ],
};

export default flow;
