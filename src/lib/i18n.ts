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

  // Onboarding — diet survey
  'onb.diet.title':         { zh: '你的飲食習慣是？', en: 'What is your current diet?' },
  'onb.diet.sub':           { zh: '我們會根據你的飲食偏好推薦合適的挑戰', en: "We'll tune the challenge to your preference" },
  'onb.diet.vegan':         { zh: 'Vegan 純素', en: 'Vegan' },
  'onb.diet.vegetarian':    { zh: 'Vegetarian 蛋奶素', en: 'Vegetarian (egg & dairy ok)' },
  'onb.diet.flexitarian':   { zh: 'Flexitarian 有時不吃肉', en: 'Flexitarian (sometimes meat-free)' },
  'onb.diet.omnivore':      { zh: 'Omnivore 無肉不歡', en: "Omnivore (meat's a must)" },
  // Onboarding — baseline
  'onb.baseline.title':     { zh: '原本的肉類飲食', en: 'Your usual meat habits' },
  'onb.baseline.sub':       { zh: '這是用來計算你的減碳成果。可滑動調整每種肉的比例。', en: 'Used to estimate carbon saved. Slide each kind to match your diet.' },
  'onb.baseline.meatBeef':  { zh: '牛肉', en: 'Beef' },
  'onb.baseline.meatPork':  { zh: '豬肉', en: 'Pork' },
  'onb.baseline.meatLamb':  { zh: '羊肉', en: 'Lamb' },
  'onb.baseline.meatChicken': { zh: '雞肉', en: 'Chicken' },
  'onb.baseline.plant':     { zh: '蔬食', en: 'Plant' },
  'onb.baseline.total':     { zh: '總計', en: 'Total' },
  'onb.baseline.hint.ok':   { zh: '✓ 合計 100%', en: '✓ Adds up to 100%' },
  'onb.baseline.hint.over': { zh: '超出 {n}%，請調整滑桿', en: '{n}% over — please adjust' },
  'onb.baseline.hint.short':{ zh: '還差 {n}%', en: '{n}% to go' },
  'onb.baseline.hint.gate': { zh: '合計需為 100% 才能繼續', en: 'Must add up to 100% before continuing' },
  // Onboarding — purpose
  'onb.purpose.title':      { zh: '參加挑戰的目的', en: 'Why this challenge?' },
  'onb.purpose.sub':        { zh: '挑戰的方向會影響每日的提示文字', en: 'Your motivation tunes the daily prompts' },
  'onb.purpose.loading':    { zh: '載入中…', en: 'Loading…' },
  // Onboarding — day1 hook
  'onb.day1.title':         { zh: '你獲得了一顆守護者蛋', en: 'You got a guardian egg!' },
  'onb.day1.rule.days':     { zh: '📅 30 天連續挑戰', en: '📅 30-day continuous challenge' },
  'onb.day1.text':          { zh: '蛋殼裡的精靈正等待你<br/>先完成接下來的設定，再為這顆蛋取個名字', en: "A spirit waits inside the shell —<br/>finish setup, then name your egg" },
  'onb.day1.cta':           { zh: '繼續設定', en: 'Continue setup' },
  'onb.day1.purpose.body':  { zh: '為了照顧自己的身體，從一餐開始。', en: 'For my body — one meal at a time.' },
  'onb.day1.purpose.env':   { zh: '每替代一公斤肉，地球少燒 60 kg CO₂。', en: 'Each kg of meat swapped saves ~60 kg CO₂.' },
  'onb.day1.purpose.vow':   { zh: '每一餐都是寫給未來的承諾。', en: 'Every meal is a promise to the future.' },
  'onb.day1.purpose.default': { zh: '跟著精靈一起探索蔬食。', en: 'Explore plant-based food with the spirit.' },
  // Onboarding — pet name
  'onb.petname.title':      { zh: '為你的守護者取名', en: 'Name your guardian' },
  'onb.petname.sub':        { zh: '這個名字會跟著你走完 30 天的挑戰', en: 'This name will stay with you for the 30-day challenge' },
  'onb.petname.field':      { zh: '寵物名稱', en: 'Pet name' },
  'onb.petname.refresh':    { zh: '再抽一個', en: 'Try another' },
  'onb.petname.error':      { zh: '請為你的守護者取個名字', en: 'Please give your guardian a name' },
  // Onboarding — start checkin
  'onb.start.hungry':       { zh: '{name} 餓了！', en: '{name} is hungry!' },
  'onb.start.text':         { zh: '完成第一次打卡，把今天的蔬食拍給 {name} 看 —<br/>孵化的能量就在你的下一餐裡。', en: 'Snap your veggie meal for {name} —<br/>your next meal hatches the egg.' },
  'onb.start.cta':          { zh: '開始打卡', en: 'Start check-in' },
  'onb.start.skip':         { zh: '稍後再打卡', en: 'Check in later' },
  'onb.start.petFallback':  { zh: '你的守護者', en: 'your guardian' },
  // Onboarding — eat times (also used by /profile/eat-times)
  'eattimes.title':         { zh: '用餐時間', en: 'Meal times' },
  'eattimes.sub':           { zh: '設定後我們會在用餐前 10 分鐘提醒你打卡，不吃某餐可用 ✕ 移除', en: "We'll remind you 10 min before each meal. Use ✕ to skip a meal." },
  'eattimes.subProfile':    { zh: '設定後我們會在用餐前 10 分鐘提醒你打卡，不吃某餐可用 ✕ 移除，之後也能再加回來。', en: "We'll remind you 10 min before each meal. Use ✕ to skip; you can add it back any time." },
  'eattimes.meal1':         { zh: '第一餐', en: 'First meal' },
  'eattimes.meal2':         { zh: '第二餐', en: 'Second meal' },
  'eattimes.meal3':         { zh: '第三餐', en: 'Third meal' },
  'eattimes.mealOnly':      { zh: '一餐', en: 'Single meal' },
  'eattimes.addBack':       { zh: '+ 加回', en: '+ Add back' },
  'eattimes.complete':      { zh: '完成設定', en: 'Done' },
  // Generic
  'common.continue':        { zh: '繼續', en: 'Continue' },
  'common.next':            { zh: '下一步', en: 'Next' },
  'common.save':            { zh: '儲存', en: 'Save' },
  'common.saving':          { zh: '儲存中…', en: 'Saving…' },
  'common.cancel':          { zh: '取消', en: 'Cancel' },
  'common.back':            { zh: '返回', en: 'Back' },
  'common.close':           { zh: '關閉', en: 'Close' },
  'common.loading':         { zh: '載入中…', en: 'Loading…' },
  'common.loadFailed':      { zh: '載入失敗', en: 'Loading failed' },
  'common.submit':          { zh: '送出', en: 'Submit' },
  'common.submitting':      { zh: '送出中…', en: 'Submitting…' },
  'common.confirm':         { zh: '確認', en: 'Confirm' },

  // Map
  'map.title':              { zh: '蔬食地圖', en: 'Vegan Map' },
  'map.veganInfo':          { zh: '素別說明', en: 'About vegan tiers' },
  'map.searchPlaceholder':  { zh: '搜尋店家名稱或料理類型（中式、咖啡…）', en: 'Search by name or cuisine type (chinese, cafe…)' },
  'map.searchClear':        { zh: '清除搜尋', en: 'Clear search' },
  'map.filterAll':          { zh: '全部', en: 'All' },
  'map.activityHint':       { zh: '活動標籤（可複選）', en: 'Activity tags (multi-select)' },
  'map.activity.partner':   { zh: '合作店家', en: 'Partner shop' },
  'map.activity.600':       { zh: '蔬食 600 盤', en: '600 Plates' },
  'map.activity.other':     { zh: '其他', en: 'Other' },
  'map.resultCount':        { zh: '{n} 家店', en: '{n} restaurants' },
  'map.ctaVerify':          { zh: '認證餐廳', en: 'Verify restaurant' },
  'map.ctaDetails':         { zh: '看詳情', en: 'See details' },
  'map.tagPartner':         { zh: '合作', en: 'Partner' },
  'map.tagUnverified':      { zh: '未驗證', en: 'Unverified' },
  'map.hoursPlaceholder':   { zh: '營業時間未提供', en: 'Hours not listed' },
  'map.discountPrefix':     { zh: '優惠：', en: 'Offer: ' },

  // Place type labels
  'place.chinese':          { zh: '中式', en: 'Chinese' },
  'place.western':          { zh: '西式', en: 'Western' },
  'place.cafe':             { zh: '咖啡', en: 'Cafe' },
  'place.japanese':         { zh: '日式', en: 'Japanese' },
  'place.thai':             { zh: '泰式', en: 'Thai' },
  'place.dessert':          { zh: '甜點', en: 'Dessert' },

  // Vegan tier info modal
  'veganInfo.title':        { zh: '素別說明', en: 'Vegan tiers' },
  'veganInfo.footnote':     { zh: '素別為餐點類別，非餐廳類別。同一家店可能提供多種素別餐點。', en: 'Vegan tiers describe DISHES, not restaurants. A single place can offer multiple tiers.' },
  'veganTier.vegan.desc':   { zh: '完全植物性，不含動物製品', en: 'Fully plant-based, no animal products' },
  'veganTier.lactoovo.desc':{ zh: '含蛋奶、不含肉類', en: 'No meat; eggs and dairy ok' },
  'veganTier.fivePungent.desc': { zh: '含五辛（蔥蒜韭薤興），不含肉類', en: 'No meat; allows five pungent herbs (garlic, onion, etc.)' },
  'veganTier.convenient.desc': { zh: '一般葷食店，但有蔬食選項', en: 'Regular restaurant with plant-based options' },

  // Restaurant detail
  'detail.reviewsTitle':    { zh: '評論', en: 'Reviews' },
  'detail.writeReview':     { zh: '寫評論', en: 'Write review' },
  'detail.updateReview':    { zh: '更新評論', en: 'Update review' },
  'detail.emptyReviews':    { zh: '還沒有評論，成為第一位吧！', en: 'No reviews yet — be the first!' },
  'detail.empty.filtered':  { zh: '沒有「{tier}」的評論', en: 'No reviews tagged "{tier}"' },
  'detail.reportTitle':     { zh: '檢舉店家', en: 'Report restaurant' },
  'detail.reportSub':       { zh: '請選擇最貼近的原因，我們會盡快人工確認。', en: 'Pick the closest reason — our team will review it.' },
  'detail.reportReason':    { zh: '原因', en: 'Reason' },
  'detail.reportSubmit':    { zh: '送出', en: 'Submit' },
  'detail.reportLogged':    { zh: '已記錄檢舉：{reason}', en: 'Report received: {reason}' },
  'detail.reportLoggedRev': { zh: '已記錄檢舉：{reason}（評論 #{id}）', en: 'Report received: {reason} (review #{id})' },
  'detail.reasonNotExists': { zh: '店家不存在', en: 'Place does not exist' },
  'detail.reasonClosed':    { zh: '已歇業', en: 'Permanently closed' },
  'detail.reasonInfoErr':   { zh: '資料錯誤', en: 'Info incorrect' },
  'detail.reviewReasonBad': { zh: '不當內容', en: 'Inappropriate content' },
  'detail.reviewReasonAd':  { zh: '廣告 / 垃圾訊息', en: 'Ads / spam' },
  'detail.reviewReasonFake':{ zh: '不實評論', en: 'False review' },
  'detail.reviewReasonOther': { zh: '其他', en: 'Other' },
  'detail.reportReview':    { zh: '檢舉這則評論', en: 'Report this review' },
  'detail.editReview':      { zh: '編輯', en: 'Edit' },
  'detail.deleteReview':    { zh: '刪除', en: 'Delete' },
  'detail.myReview':        { zh: '我的評論', en: 'My review' },
  'detail.deleteTitle':     { zh: '刪除評論？', en: 'Delete review?' },
  'detail.deleteLock':      { zh: '發布未滿 30 分鐘，僅可編輯。<br/>還剩約 {n} 分鐘。', en: 'Published less than 30 min ago, edit only.<br/>About {n} min remaining.' },
  'detail.deleteSwitch':    { zh: '改為編輯', en: 'Edit instead' },
  'detail.deleteNudge':     { zh: '你也可以「<a href="#" data-act="edit">編輯</a>」這則評論，而不是刪除。', en: 'You can also <a href="#" data-act="edit">edit</a> instead of deleting.' },
  'detail.deleteWhy':       { zh: '刪除原因', en: 'Reason for deletion' },
  'detail.deleteReasonContent': { zh: '內容有誤', en: 'Content was wrong' },
  'detail.deleteReasonMind':{ zh: '想法改變', en: 'Changed my mind' },
  'detail.deleteWarn':      { zh: 'XP 與連續日不會被扣回，但這則評論會永久消失。', en: "XP and streak won't be revoked, but the review will be gone forever." },
  'detail.deleteConfirm':   { zh: '確認刪除', en: 'Confirm delete' },
  'detail.deleting':        { zh: '刪除中…', en: 'Deleting…' },
  'detail.deleteFail':      { zh: '刪除失敗，請稍後再試', en: 'Delete failed, please try again' },
  'detail.notFound':        { zh: '店家不存在', en: "Restaurant not found" },

  // Review form
  'review.title':           { zh: '寫評論', en: 'Write review' },
  'review.editTitle':       { zh: '編輯評論', en: 'Edit review' },
  'review.editBanner':      { zh: '你已評論過這家店，目前在編輯這則評論。', en: "You've already reviewed this restaurant — you're editing it now." },
  'review.rating':          { zh: '評分', en: 'Rating' },
  'review.veganLabel':      { zh: '素別（可複選）', en: 'Vegan tier (multi-select)' },
  'review.veganInfo':       { zh: '素別說明', en: 'About vegan tiers' },
  'review.text':            { zh: '想說些什麼？（選填）', en: 'What would you like to say? (optional)' },
  'review.textPh':          { zh: '你的素食體驗、餐點推薦…', en: 'Your veg experience, recommended dishes…' },
  'review.photo':           { zh: '餐點照片（選填）', en: 'Meal photo (optional)' },
  'review.photoAlt':        { zh: '照片預覽', en: 'Photo preview' },
  'review.submit':          { zh: '送出評論 (+{xp} XP)', en: 'Submit review (+{xp} XP)' },
  'review.update':          { zh: '更新評論', en: 'Update review' },
  'review.updating':        { zh: '更新中…', en: 'Updating…' },
  'review.cooldown':        { zh: '這則評論剛編輯過，請於 {h} 小時後再試。', en: 'This review was just edited. Please retry in {h} hours.' },
  'review.errRating':       { zh: '請先選擇評分', en: 'Please pick a rating' },
  'review.errVegan':        { zh: '請至少選擇一個素別', en: 'Please pick at least one vegan tier' },
  'review.failSubmit':      { zh: '送出失敗，請稍後再試', en: 'Submission failed, please try again' },
  'review.failUpdate':      { zh: '更新失敗，請稍後再試', en: 'Update failed, please try again' },
  'review.successTitle':    { zh: '感謝你的評論！', en: 'Thanks for your review!' },
  'review.editSuccessTitle':{ zh: '評論已更新', en: 'Review updated' },
  'review.editSuccessSub':  { zh: '下次想再修改？每則評論每 24 小時可調整一次。', en: 'Need to edit again? Each review can be tweaked once every 24 hours.' },
  'review.backToShop':      { zh: '回到店家', en: 'Back to restaurant' },
  'review.backToMap':       { zh: '回到地圖', en: 'Back to map' },

  // 素別 tally chips on detail page
  'tally.aria':             { zh: '各素別選擇人數（可點選篩選評論）', en: 'Reviewer count per vegan tier (tap to filter)' },
  'tally.filterTitle':      { zh: '只顯示 {tier} 的評論', en: 'Show only {tier} reviews' },
  'tally.clear':            { zh: '顯示全部', en: 'Show all' },
  'tally.clearTitle':       { zh: '清除篩選', en: 'Clear filter' },

  // Verify route
  'verify.title':           { zh: '認證餐廳', en: 'Verify restaurant' },
  'verify.text':            { zh: '想說些什麼？', en: 'What would you like to say?' },
  'verify.photo':           { zh: '餐點照片 (選填)', en: 'Meal photo (optional)' },
  'verify.asCheckin':       { zh: '同時當作今日打卡照（+30 XP 打卡）', en: "Also use as today's check-in (+30 XP)" },
  'verify.submit':          { zh: '送出認證 (+{xp} XP)', en: 'Submit verification (+{xp} XP)' },
  'verify.successTitle':    { zh: '認證成功！', en: 'Verification done!' },
  'verify.checkinBadge':    { zh: '完成打卡', en: 'Check-in done' },
  'verify.editItems':       { zh: '修改內容', en: 'Edit items' },
  'verify.failPrefix':      { zh: '送出失敗：', en: 'Failed: ' },

  // Check-in flow
  'checkin.captureTitle':   { zh: '拍照打卡', en: 'Take a meal photo' },
  'checkin.capturePlaceholder': { zh: '拍下今天的這一餐<br/>食物精靈會幫你辨識', en: 'Snap your meal —<br/>the food spirit will recognise it' },
  'checkin.capturePreviewAlt': { zh: '餐點預覽', en: 'Meal preview' },
  'checkin.startShoot':     { zh: '開始拍照', en: 'Start camera' },
  'checkin.retake':         { zh: '重新拍', en: 'Retake' },
  'checkin.analyze':        { zh: '進行分析', en: 'Analyse' },
  'checkin.scanTitle':      { zh: '辨識中…', en: 'Scanning…' },
  'checkin.scanSub':        { zh: '食物精靈正在辨識你的餐點', en: 'The food spirit is recognising your meal' },
  'checkin.scanAlt':        { zh: '掃描中', en: 'Scanning' },
  'checkin.scanStatus':     { zh: '食物精靈分析中…', en: 'Food spirit analysing…' },
  'checkin.scanFallback':   { zh: '請先拍下一張餐點照片。', en: 'Please take a meal photo first.' },
  'checkin.scanDevHead':    { zh: 'Prototype — 演示兩種流程', en: 'Prototype — demo both flows' },
  'checkin.scanDevVeg':     { zh: '🌱 無肉流程', en: '🌱 Veg flow' },
  'checkin.scanDevMeat':    { zh: '🥩 有肉流程', en: '🥩 Meat flow' },
  'checkin.scanDevHint':    { zh: '真實 AI 接上後，這個選擇器會自動拿掉。', en: 'This picker disappears once real AI is wired up.' },
  'checkin.resultTitle':    { zh: '辨識結果', en: 'Scan result' },
  'checkin.noMeatTitle':    { zh: '無肉檢出', en: 'No meat detected' },
  'checkin.noMeatText':     { zh: '食物精靈正在記錄打卡…', en: 'Recording the check-in…' },
  'checkin.detected':       { zh: '我們偵測到 {items}', en: 'We detected {items}' },
  'checkin.isMeatQ':        { zh: '這是肉嗎？', en: 'Is this meat?' },
  'checkin.isMeatYes':      { zh: '這是肉', en: 'Yes, meat' },
  'checkin.isMeatNo':       { zh: '不，這是植物肉', en: "No, it's plant-based" },
  'checkin.fallbackNoScan': { zh: '沒有可確認的辨識結果。', en: 'No scan result to confirm.' },
  'checkin.fallbackBack':   { zh: '回到拍照', en: 'Back to camera' },
  'checkin.failTitle':      { zh: '今天的孵化能量逃走了', en: "Today's hatch energy is gone" },
  'checkin.failText':       { zh: '別擔心，明天還可以再試一次。', en: "No worries — you can try again tomorrow." },
  'checkin.failBack':       { zh: '返回首頁', en: 'Back to home' },
  'checkin.failHeading':    { zh: '{next}一起加油！', en: "Let's go for {next}!" },
  'checkin.failExplain':    { zh: '這餐有肉沒關係，挑戰是慢慢累積的。<br/>小綠相信你 {next} 可以挑戰無肉打卡 💪', en: "Meat this meal is ok — the challenge stacks slowly.<br/>{next}, try a meat-free check-in 💪" },
  'checkin.failTryAgain':   { zh: '換個方式打卡', en: 'Try a different photo' },
  'checkin.failHome':       { zh: '下次再來', en: 'Back home' },
  'checkin.nextMeal2':      { zh: '第二餐', en: 'Second meal' },
  'checkin.nextMeal3':      { zh: '第三餐', en: 'Third meal' },
  'checkin.nextMealTmrw':   { zh: '明天第一餐', en: "Tomorrow's first meal" },
  'checkin.nextMealDefault':{ zh: '下一餐', en: 'next meal' },
  'checkin.meal1':          { zh: '第一餐', en: 'First meal' },
  'checkin.meal2':          { zh: '第二餐', en: 'Second meal' },
  'checkin.meal3':          { zh: '第三餐', en: 'Third meal' },
  'success.welcome':        { zh: '歡迎踏出第一步！', en: 'Welcome — first step taken!' },
  'success.normalTitle':    { zh: '打卡成功 +{xp} XP', en: 'Check-in done · +{xp} XP' },
  'success.xpFedFmt':       { zh: '進 {n} XP 到守護者', en: '{n} XP to your guardian' },
  'success.gemsFmt':        { zh: '溢出 {n} 能量石', en: 'Overflow → {n} gems' },
  'success.emptyFedFmt':    { zh: '本次 0 XP — 已達當日上限', en: 'No XP this time — daily cap reached' },
  'success.bonusFmt':       { zh: '完成全日三餐 +{xp} XP 獎勵', en: 'All 3 meals done · +{xp} XP bonus' },
  'success.firstBanner':    { zh: '🎉 第一次打卡', en: '🎉 First check-in' },
  'success.firstBubble':    { zh: '首次打卡 +20 XP', en: 'First check-in +20 XP' },
  'success.luckyBubble':    { zh: '幸運色 +15 XP', en: 'Lucky colour +15 XP' },
  'success.replacedBubble': { zh: '替代為植物肉', en: 'Swapped to plant-based' },
  'success.viewNutrition':  { zh: '查看營養成分', en: 'View nutrition' },
  'success.editItems':      { zh: '修改內容', en: 'Edit items' },
  'success.review':         { zh: '為餐廳留評論', en: 'Leave a review' },
  'success.share':          { zh: '分享成果', en: 'Share result' },
  'success.editHint':       { zh: '想再回頭調整？到「蔬食旅程」點當天的 ✓ 開啟營養抽屜。<br/>提醒：下一餐記錄後就鎖定了。', en: "Want to adjust later? Go to Vegan Journey and tap the day's ✓ to open the nutrition drawer.<br/>Once the next meal is logged, the earlier one locks." },
  'success.next':           { zh: '繼續守護', en: 'Continue guarding' },
  'success.fallbackNone':   { zh: '沒有可顯示的打卡結果。', en: 'No check-in result to show.' },
  'success.fallbackHome':   { zh: '回首頁', en: 'Back to home' },
  'success.firstBannerTitle': { zh: '第一次打卡完成！', en: 'First check-in complete!' },
  'success.firstBannerSub': { zh: '小綠剛剛吃到第一口 XP，跟你的 30 天挑戰一起開始 🌱', en: 'Your guardian just tasted its first XP — the 30-day journey begins 🌱' },
  'success.titleDone':      { zh: '打卡成功！', en: 'Check-in success!' },
  'success.firstBubbleUnlock': { zh: '🎉 首次打卡 +XP 解鎖', en: '🎉 First check-in · +XP unlocked' },
  'success.distFeed':       { zh: '餵給小綠 <strong>+{xp} XP</strong>', en: 'Fed to your guardian <strong>+{xp} XP</strong>' },
  'success.distGems':       { zh: '+<strong data-gem-count="{n}">0</strong> 能量石', en: '+<strong data-gem-count="{n}">0</strong> gems' },
  'success.distEmpty':      { zh: 'XP 已記入今日進度', en: 'XP added to today\'s progress' },
  'success.distBonus':      { zh: '完成全日三餐 <strong>+{xp} XP</strong>', en: 'All 3 meals done · <strong>+{xp} XP</strong>' },

  // Nutrition card (shared by check-in success, review success, calendar recap)
  'nutrition.heading':      { zh: '本餐營養成分', en: "This meal's nutrition" },
  'nutrition.calorie':      { zh: '熱量', en: 'Calories' },
  'nutrition.protein':      { zh: '蛋白質', en: 'Protein' },
  'nutrition.carb':         { zh: '碳水', en: 'Carbs' },
  'nutrition.fat':          { zh: '脂肪', en: 'Fat' },
  'nutrition.fiber':        { zh: '膳食纖維', en: 'Fiber' },
  'nutrition.aiHint':       { zh: '由 AI 依本餐食材自動估算', en: 'Auto-estimated by AI from the ingredients' },

  // Calendar (蔬食旅程)
  'cal.title':              { zh: '蔬食旅程', en: 'Vegan Journey' },
  'cal.prevMonth':          { zh: '上個月', en: 'Previous month' },
  'cal.nextMonth':          { zh: '下個月', en: 'Next month' },
  'cal.monthFmt':           { zh: '{y} 年 {m} 月', en: '{m}/{y}' },
  'cal.weekdaysZh':         { zh: '日一二三四五六', en: 'SMTWTFS' },
  'cal.legendDone':         { zh: '已打卡 / 已補簽', en: 'Done / Made up' },
  'cal.legendMakeable':     { zh: '可補簽', en: 'Make-up available' },
  'cal.legendLost':         { zh: '已 lost', en: 'Lost' },

  // Nutrition recap modal
  'recap.dayFmt':            { zh: '{date} · Day {n}', en: '{date} · Day {n}' },
  'recap.subFmt':            { zh: '完成 {a} / {b} 餐蔬食（等級 {lv}）', en: 'Veg meals {a} / {b} (Level {lv})' },
  'recap.subNoLv':           { zh: '完成 {a} / {b} 餐蔬食', en: 'Veg meals {a} / {b}' },
  'recap.rule':              { zh: '下一餐記錄後，前面餐次不再可修改', en: 'Once the next meal is logged, earlier meals lock' },
  'recap.totalsTitle':       { zh: '當日總攝取', en: 'Daily totals' },
  'recap.empty':             { zh: '這天還沒有 AI 掃描紀錄。', en: 'No AI scan records for this day yet.' },
  'recap.mealFmt':           { zh: '第 {n} 餐', en: 'Meal {n}' },
  'recap.itemsEmpty':        { zh: '沒有食材紀錄', en: 'No items recorded' },
  'recap.itemsEmptyName':    { zh: '未命名', en: 'Unnamed' },
  'recap.edit':              { zh: '修改內容', en: 'Edit items' },
  'recap.lockedTitle':       { zh: '已記錄下一餐，無法再修改', en: 'Next meal logged, no longer editable' },
  'recap.locked':            { zh: '已鎖定', en: 'Locked' },
  'recap.saveFail':          { zh: '儲存失敗，請稍後再試', en: 'Save failed, please try again' },

  // Makeup modal
  'makeup.copy':             { zh: '主人，{date} 那天我等了你⋯', en: 'I waited for you on {date}…' },
  'makeup.streakLabel':      { zh: '補完這天', en: 'Make up this day' },
  'makeup.streakDelta':      { zh: '+1 天 streak', en: '+1 day streak' },
  'makeup.costLabel':        { zh: '能量石', en: 'gems' },
  'makeup.balanceFmt':       { zh: '目前餘額：💎 {n}', en: 'Balance: 💎 {n}' },
  'makeup.cancel':           { zh: '取消', en: 'Cancel' },
  'makeup.confirm':          { zh: '💛 救回那一天', en: '💛 Save that day' },

  // Profile sub-pages
  'profile.baseline.title':  { zh: '基本飲食', en: 'Base diet' },
  'profile.baseline.dietTitle': { zh: '你的飲食習慣', en: 'Your diet style' },
  'profile.baseline.dietSub': { zh: '隨時可以重新選擇 — 每日提示與減碳估算會跟著調整。', en: 'You can change this any time — daily prompts and carbon estimates follow.' },
  'profile.baseline.meatTitle': { zh: '原本的肉類飲食', en: 'Your usual meat habits' },
  'profile.baseline.meatSub': { zh: '調整每種肉的比例，會影響減碳估算。', en: 'Adjust the ratios to refine the carbon estimate.' },
  'profile.baseline.gate':    { zh: '合計需為 100% 才能儲存', en: 'Must add up to 100% to save' },
  'profile.baseline.impactPrefix': { zh: '每 4kg 飲食量約可減碳', en: 'Per 4 kg of diet, saves about' },
  'profile.baseline.errAmt':  { zh: '請將肉類比例合計調整為 100%', en: 'Adjust the meat ratios to add up to 100%' },
  'profile.diet.vegan':       { zh: 'Vegan 純素', en: 'Vegan' },
  'profile.diet.vegetarian':  { zh: 'Vegetarian 蛋奶素', en: 'Vegetarian' },
  'profile.diet.flexitarian': { zh: 'Flexitarian 有時不吃肉', en: 'Flexitarian' },
  'profile.diet.omnivore':    { zh: 'Omnivore 無肉不歡', en: 'Omnivore' },

  // Settings (rest of)
  'settings.petName':         { zh: '寵物名稱', en: 'Pet name' },
  'settings.mealReminders':   { zh: '用餐提醒', en: 'Meal reminders' },
  'settings.notif':           { zh: '推播提醒', en: 'Push notifications' },
  'settings.notifAsk':        { zh: '允許用餐前 10 分鐘提醒', en: 'Allow 10-min pre-meal reminders' },
  'settings.notifUnsupported':{ zh: '此瀏覽器不支援', en: 'Not supported in this browser' },
  'settings.notifGranted':    { zh: '已開啟', en: 'Enabled' },
  'settings.notifDenied':     { zh: '已封鎖（請至瀏覽器設定開啟）', en: 'Blocked (enable in browser settings)' },
  'settings.notifUnset':      { zh: '尚未設定', en: 'Not yet set' },
  'settings.theme':           { zh: '主題', en: 'Theme' },
  'settings.themeLight':      { zh: '淺色', en: 'Light' },
  'settings.themeDark':       { zh: '深色', en: 'Dark' },
  'settings.saveOk':          { zh: '已儲存', en: 'Saved' },
  'settings.saveBtn':         { zh: '儲存變更', en: 'Save changes' },
  'settings.logout':          { zh: '登出', en: 'Log out' },
  'settings.errName':         { zh: '名稱不能空白', en: 'Name cannot be empty' },
  'settings.logoutConfirm':   { zh: '確定要登出嗎？', en: 'Log out?' },
  'settings.footer':          { zh: 'Yummi Go v{ver} · 建置於 {time}', en: 'Yummi Go v{ver} · built {time}' },

  // Reviews list
  'reviews.title':            { zh: '我的評論', en: 'My reviews' },
  'reviews.empty':            { zh: '還沒寫過評論。打開地圖找一家去評論看看吧！', en: "No reviews yet — open the map and try one!" },
  'reviews.loading':          { zh: '載入中…', en: 'Loading…' },
  'reviews.loadFailed':       { zh: '載入失敗', en: 'Loading failed' },
  'reviews.shopFallback':     { zh: '店家 #{id}', en: 'Restaurant #{id}' },
  'reviews.goToShop':         { zh: '前往店家', en: 'Go to restaurant' },

  // Profile identity card
  'profile.diet.fallback.vegan': { zh: 'Vegan 純素', en: 'Vegan' },
  'profile.diet.fallback.vegetarian': { zh: '蛋奶素', en: 'Vegetarian' },
  'profile.diet.fallback.flexitarian': { zh: '彈性素', en: 'Flexitarian' },
  'profile.diet.fallback.omnivore': { zh: '雜食', en: 'Omnivore' },
  'tolerance.usedFmt':        { zh: '已用 {used} / {total}', en: 'Used {used} / {total}' },
  'tolerance.broken':         { zh: '已失守', en: 'Tolerance broken' },
  'tolerance.zero':           { zh: '零容錯', en: 'Zero-tolerance' },
  'tolerance.titleFmt':       { zh: '等級 {lv} 容錯次數', en: 'Level {lv} tolerance' },

  // Home dynamic copy
  'home.petBubbleFallback':  { zh: '守護者氣息微弱…', en: 'Your guardian breathes softly…' },
  'home.missionsTitle':      { zh: '今日任務', en: "Today's missions" },
  'home.missionsExpand':     { zh: '查看全部', en: 'See all' },
  'home.missionsCollapse':   { zh: '收合', en: 'Collapse' },
  'home.phase1Title':        { zh: '第一階段旅程開始', en: 'Phase 1 begins' },
  'home.phase1Body':         { zh: '請選擇您想參加的蔬食旅程天數', en: 'Pick how many days your veg journey will run' },
  'home.phase1Days':         { zh: '{n} 天', en: '{n} days' },
  'home.phase1Cta':          { zh: '開始旅程', en: 'Start journey' },
  'home.phase1AriaDays':     { zh: '旅程天數', en: 'Journey length' },

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
