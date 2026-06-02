/**
 * Tiny i18n layer — Phase A scaffold.
 *
 * Supports zh (Traditional Mandarin, the prototype's source language)
 * and en. Strings live in a flat map of `key → { zh, en }`. `t(key)`
 * returns the string for the current `$locale`; missing keys fall back
 * to the key itself (loud but non-fatal in dev), and missing en
 * translations fall back to zh.
 *
 * Re-render pattern: components subscribe to `$locale` with `bind(node,
 * $locale, repaint)` so the screen repaints on toggle. For static
 * shells (TabBar, Layout), the bind already runs against $route — we
 * tack the locale read into the existing render call.
 *
 * Phase A coverage is intentionally narrow: splash, TabBar, home top
 * row, profile hub, settings. Everything else stays Chinese-only until
 * Phase B walks the codebase and extracts the rest.
 */
import { atom } from 'nanostores';
import { storage, KEYS } from './storage';

export type Locale = 'zh' | 'en';

function detectDefault(): Locale {
  const stored = storage.get<Locale | null>(KEYS.LOCALE, null);
  if (stored === 'zh' || stored === 'en') return stored;
  // navigator.language returns e.g. 'zh-TW', 'zh-Hant', 'en-US'.
  const nav = typeof navigator !== 'undefined' ? navigator.language : '';
  return nav.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

export const $locale = atom<Locale>(detectDefault());

export function setLocale(next: Locale): void {
  $locale.set(next);
  storage.set(KEYS.LOCALE, next);
}

interface Entry { zh: string; en?: string }

/**
 * Translation dictionary. Keep keys namespaced (`tab.home`, `home.gem`)
 * so it's easy to scan what's translated. zh is the authoritative
 * source — every key must have zh. en is optional; missing en falls
 * back to zh.
 */
const DICT: Record<string, Entry> = {
  // Splash / Get Started
  'splash.tagline':         { zh: '吃出更好的自己 · 養好你的寵物', en: 'Eat better · Raise your pet' },
  'splash.getStarted':      { zh: '匿名玩家 / Get Started', en: 'Play as guest / Get Started' },
  'splash.googleLogin':     { zh: 'Google Log In', en: 'Google Log In' },
  'splash.preparing':       { zh: '準備中…', en: 'Preparing…' },
  'splash.guestError':      { zh: '進入失敗，請稍後再試。', en: "Couldn't get you in. Please try again." },
  'splash.googleError':     { zh: 'Google 登入失敗，請稍後再試。', en: 'Google sign-in failed. Please try again.' },

  // Google picker (splash)
  'google.pickAccount':     { zh: '選擇帳號', en: 'Choose an account' },
  'google.pickSub':         { zh: '繼續前往 Yummi Go（原型示範）', en: 'Continue to Yummi Go (prototype demo)' },
  'google.useOther':        { zh: '使用其他 Google 帳號（email）', en: 'Use another Google account (email)' },
  'google.signIn':          { zh: '登入', en: 'Sign in' },
  'google.cancel':          { zh: '取消', en: 'Cancel' },

  // TabBar
  'tab.home':               { zh: '首頁', en: 'Home' },
  'tab.map':                { zh: '地圖', en: 'Map' },
  'tab.checkin':            { zh: '打卡', en: 'Check-in' },
  'tab.store':              { zh: '商店', en: 'Store' },
  'tab.journey':            { zh: '蔬食旅程', en: 'Vegan Journey' },

  // Top-right profile FAB
  'fab.profile':            { zh: '我的', en: 'Profile' },

  // Home top row
  'home.gem':               { zh: '能量石', en: 'Gems' },
  'home.streakTooltip':     { zh: '連續打卡天數 — 點擊查看蔬食旅程', en: 'Day streak — tap to open Vegan Journey' },
  'home.streakUnit':        { zh: '天', en: 'd' },
  'home.luckyTitle':        { zh: '今日幸運色', en: "Today's lucky colour" },
  'home.luckyUnset':        { zh: '未設定', en: 'Not set' },

  // Profile hub
  'profile.guestName':      { zh: '訪客', en: 'Guest' },
  'profile.statsDays':      { zh: '挑戰天數', en: 'Challenge days' },
  'profile.statsMeals':     { zh: '打卡餐次', en: 'Meal check-ins' },
  'profile.statsCo2':       { zh: '減碳 kg CO₂e', en: 'kg CO₂e saved' },
  'profile.statsLucky':     { zh: '幸運色命中', en: 'Lucky-colour hits' },
  'profile.linkJourney':    { zh: '蔬食旅程', en: 'Vegan Journey' },
  'profile.linkReviews':    { zh: '我的評論', en: 'My reviews' },
  'profile.linkBaseline':   { zh: '編輯基本飲食', en: 'Edit base diet' },
  'profile.linkEatTimes':   { zh: '用餐時間', en: 'Meal times' },
  'profile.linkSettings':   { zh: '設定', en: 'Settings' },

  // Settings (Phase A surface)
  'settings.title':         { zh: '設定', en: 'Settings' },
  'settings.language':      { zh: '語言', en: 'Language' },
  'settings.zh':            { zh: '繁體中文', en: 'Traditional Chinese' },
  'settings.en':            { zh: 'English', en: 'English' },
  'settings.back':          { zh: '返回', en: 'Back' },

  // Google bind prompt — only fires before leaving a review.
  'bind.title':             { zh: '綁定 Google 帳號', en: 'Connect your Google account' },
  'bind.sub':               { zh: '發布評論需要可辨識的身分，先綁定一個 Google 帳號吧。', en: 'Reviews need a recognisable identity. Connect a Google account to continue.' },
  'bind.useOther':          { zh: '使用其他 Google 帳號（email）', en: 'Use another Google account (email)' },
  'bind.confirm':           { zh: '綁定', en: 'Connect' },
  'bind.skip':              { zh: '先跳過', en: 'Skip for now' },
  'bind.emailError':        { zh: '請輸入有效的 email', en: 'Please enter a valid email' },
  'bind.failed':            { zh: '綁定失敗，請稍後再試', en: 'Connection failed, please try again' },
};

export function t(key: string, fallback?: string): string {
  const entry = DICT[key];
  if (!entry) return fallback ?? key;
  const loc = $locale.get();
  if (loc === 'en') return entry.en ?? entry.zh;
  return entry.zh;
}
