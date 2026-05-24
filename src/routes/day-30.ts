/**
 * Day-30 finale — chest reveal + impact report card.
 *
 * Aggregates the user's full check-in history to compute total meals,
 * lucky-color hits, and a CO2-saved estimate from their baseline. The
 * pet hero gets the `evolve` mood for the celebratory glow. Share /
 * Restart CTAs are stubs for the prototype: 分享 copies a summary line
 * to clipboard, 重新開始 navigates back to /home.
 */
import { navigate } from '@/router';
import { $user, $profile } from '@/store/user';
import { listCheckIns } from '@/api/check-ins';
import {
  impactSavedKg,
  impactSavedLitresWater,
  impactSavedM2Land,
  type Baseline,
} from '@/lib/baseline-impact';
import { spriteFor } from '@/lib/pet-sprites';

const ACHIEVEMENTS = [
  { key: 'starter', label: '🌱 喚醒者', test: (d: Stats) => d.totalDays >= 1 },
  { key: 'streak3', label: '🔥 三日連擊', test: (d: Stats) => d.streak >= 3 },
  { key: 'lucky', label: '🍀 幸運捕手', test: (d: Stats) => d.luckyHits >= 5 },
  { key: 'half', label: '🌿 半月達成', test: (d: Stats) => d.totalDays >= 15 },
  { key: 'full', label: '🌳 30 天滿勤', test: (d: Stats) => d.totalDays >= 30 },
];

interface Stats {
  totalDays: number;
  totalMeals: number;
  luckyHits: number;
  streak: number;
  co2Saved: number;
  waterSavedL: number;
  landSavedM2: number;
}

/** Compact thousand-separator format. 12345 → "12,345". */
function fmtInt(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

export default function day30(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'day30-screen';
  wrap.innerHTML = `
    <header class="checkin-header day30-header">
      <button class="checkin-back" id="back-btn" aria-label="返回">
        <span class="ms">arrow_back</span>
      </button>
      <span class="checkin-title">30 天終曲</span>
      <span></span>
    </header>
    <div class="day30-body">
      <div class="day30-confetti" aria-hidden="true">
        <span>🎉</span><span>✨</span><span>🌟</span><span>💎</span><span>🍀</span>
      </div>
      <div class="day30-pet">
        <div class="pet-view">
          <img class="pet-frog" src="${spriteFor('adult', 'happy')}" alt="守護者" draggable="false" />
        </div>
      </div>
      <h1 class="day30-title">守護者的旅途</h1>
      <p class="day30-text">30 天前，你只是一顆剛孵化的蛋。<br/>今天，你已經陪伴守護者走完一段旅程。</p>
      <section class="day30-card" id="impact"></section>
      <section class="day30-badges" id="badges"></section>
      <div class="day30-actions">
        <button class="btn text-btn-m btn-secondary btn-l text-btn-l" id="share">
          <span class="ms">share</span>分享成果
        </button>
        <button class="btn text-btn-m btn-primary btn-l text-btn-l" id="restart">
          <span class="ms">replay</span>回首頁
        </button>
      </div>
    </div>
  `;

  wrap.querySelector('#back-btn')?.addEventListener('click', () => navigate('/profile'));
  wrap.querySelector('#restart')?.addEventListener('click', () => navigate('/home'));
  wrap.querySelector('#share')?.addEventListener('click', () => {
    void shareSummary(wrap);
  });

  void hydrate(wrap);

  return wrap;
}

async function hydrate(wrap: HTMLElement): Promise<void> {
  const impactEl = wrap.querySelector<HTMLElement>('#impact')!;
  const badgesEl = wrap.querySelector<HTMLElement>('#badges')!;
  const u = $user.get();
  if (!u) {
    impactEl.innerHTML = '<p class="reviews-empty">請先登入。</p>';
    return;
  }

  let checkIns: Awaited<ReturnType<typeof listCheckIns>> = [];
  try {
    checkIns = await listCheckIns(u.id);
  } catch {
    impactEl.innerHTML = '<p class="reviews-empty">無法載入打卡紀錄。</p>';
    return;
  }

  const totalMeals = checkIns.length;
  const dayNumbers = Array.from(new Set(checkIns.map((c) => c.day_number))).sort((a, b) => a - b);
  const totalDays = dayNumbers.length;
  const luckyHits = checkIns.filter((c) => c.lucky_color_matched === 1).length;
  const streak = longestConsecutive(dayNumbers);

  const profile = $profile.get();
  let baseline: Baseline | null = null;
  if (profile?.baseline) {
    try {
      baseline = JSON.parse(profile.baseline) as Baseline;
    } catch {
      /* ignore */
    }
  }
  const weeklyKg = (4 * totalDays) / 7;
  const co2Saved = baseline ? impactSavedKg(weeklyKg, baseline) : 0;
  const waterSavedL = baseline ? impactSavedLitresWater(weeklyKg, baseline) : 0;
  const landSavedM2 = baseline ? impactSavedM2Land(weeklyKg, baseline) : 0;
  const stats: Stats = {
    totalDays,
    totalMeals,
    luckyHits,
    streak,
    co2Saved,
    waterSavedL,
    landSavedM2,
  };

  impactEl.innerHTML = `
    <h2 class="day30-card-title">影響力報告</h2>
    <div class="impact-hero-grid">
      <div class="impact-cell impact-highlight">
        <span class="impact-value">${co2Saved.toFixed(1)}</span>
        <span class="impact-unit">kg</span>
        <span class="impact-label">減碳 CO₂e</span>
      </div>
      <div class="impact-cell impact-highlight impact-blue">
        <span class="impact-value">${fmtInt(waterSavedL)}</span>
        <span class="impact-unit">L</span>
        <span class="impact-label">省水量</span>
      </div>
      <div class="impact-cell impact-highlight impact-brown">
        <span class="impact-value">${fmtInt(landSavedM2)}</span>
        <span class="impact-unit">m²</span>
        <span class="impact-label">省地</span>
      </div>
    </div>
    <div class="impact-grid">
      <div class="impact-cell">
        <span class="impact-value">${totalDays}</span>
        <span class="impact-label">完成天數 / 30</span>
      </div>
      <div class="impact-cell">
        <span class="impact-value">${totalMeals}</span>
        <span class="impact-label">蔬食餐次</span>
      </div>
      <div class="impact-cell">
        <span class="impact-value">${streak}</span>
        <span class="impact-label">最長連擊</span>
      </div>
      <div class="impact-cell">
        <span class="impact-value">${luckyHits}</span>
        <span class="impact-label">幸運色命中</span>
      </div>
      <div class="impact-cell">
        <span class="impact-value">LV.${profile?.level ?? 1}</span>
        <span class="impact-label">守護者等級</span>
      </div>
    </div>
  `;

  const earned = ACHIEVEMENTS.filter((a) => a.test(stats));
  badgesEl.innerHTML = earned.length
    ? `<h2 class="day30-card-title">徽章</h2><div class="badges-grid">${earned
        .map((a) => `<span class="badge">${a.label}</span>`)
        .join('')}</div>`
    : '';

  wrap.dataset.summary = `Yummi Go 30 天挑戰：${totalDays} 天 / ${totalMeals} 餐 / 減碳 ${co2Saved.toFixed(1)} kg CO₂e / 省水 ${fmtInt(waterSavedL)} L / 省地 ${fmtInt(landSavedM2)} m² / 連擊 ${streak} 天。`;
}

function longestConsecutive(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  let best = 1;
  let cur = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === sorted[i - 1] + 1) {
      cur += 1;
      if (cur > best) best = cur;
    } else if (sorted[i] !== sorted[i - 1]) {
      cur = 1;
    }
  }
  return best;
}

async function shareSummary(wrap: HTMLElement): Promise<void> {
  const text = wrap.dataset.summary ?? 'Yummi Go 30 天挑戰完成！';
  if (navigator.share) {
    try {
      await navigator.share({ title: 'Yummi Go', text });
      return;
    } catch {
      /* user cancelled or unsupported, fall back to clipboard */
    }
  }
  if (navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text);
      window.alert('已複製到剪貼簿');
      return;
    } catch {
      /* fall through */
    }
  }
  window.alert(text);
}
