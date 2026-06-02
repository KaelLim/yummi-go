/**
 * Profile hub — identity card + accumulated stats + entries.
 *
 * The inline 30-day mini-calendar was removed in the 2026-05-19 pivot; the
 * full month-view calendar (with makeup) now lives at /profile/calendar,
 * reachable from the link below.
 *
 * Stats card aggregates: total days with at least one check-in, total
 * check-in count (rough proxy for meals), accumulated XP from $profile,
 * and CO2 saved via baseline-impact (uses user's onboarding baseline if
 * present; otherwise zero).
 */
import { navigate } from '@/router';
import { $user, $profile, clearUser } from '@/store/user';
import { listCheckIns, type CheckInRow } from '@/api/check-ins';
import { mealFailCount } from '@/api/profile';
import { impactSavedKg, type Baseline } from '@/lib/baseline-impact';
import { bind } from '@/lib/lifecycle';
import { spriteFor } from '@/lib/pet-sprites';
import type { PetStage } from '@/lib/pet-evolution';
import { $pet, effectiveMood } from '@/store/pet';

function describeTolerance(level: number | null | undefined, fails: number): {
  show: boolean; total: number | null; used: number; broken: boolean; label: string;
} {
  if (!level || level === 1) return { show: false, total: null, used: fails, broken: false, label: '' };
  const total = level === 2 ? 3 : 0;
  const used = fails;
  const broken = used > total;
  const label = total > 0
    ? `已用 ${Math.min(used, total)} / ${total}`
    : (used > 0 ? '已失守' : '零容錯');
  return { show: true, total, used, broken, label };
}

const DIET_LABEL: Record<string, string> = {
  vegan: 'Vegan 純素',
  vegetarian: '蛋奶素',
  flexitarian: '彈性素',
  omnivore: '雜食',
};

export default function profile(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'profile-screen';
  wrap.innerHTML = `
    <header class="profile-card" id="identity"></header>
    <section class="profile-stats" id="stats"></section>
    <section class="tolerance-card" id="tolerance" hidden></section>
    <section class="profile-links">
      <button class="profile-link" data-route="/profile/calendar">
        <span class="ms">calendar_month</span>
        <span>蔬食旅程</span>
        <span class="ms profile-link-arrow">arrow_forward_ios</span>
      </button>
      <button class="profile-link" data-route="/profile/reviews">
        <span class="ms">rate_review</span>
        <span>我的評論</span>
        <span class="ms profile-link-arrow">arrow_forward_ios</span>
      </button>
      <button class="profile-link" data-route="/profile/baseline">
        <span class="ms">tune</span>
        <span>編輯基本飲食</span>
        <span class="ms profile-link-arrow">arrow_forward_ios</span>
      </button>
      <button class="profile-link" data-route="/profile/eat-times">
        <span class="ms">schedule</span>
        <span>用餐時間</span>
        <span class="ms profile-link-arrow">arrow_forward_ios</span>
      </button>
      <button class="profile-link" data-route="/profile/settings">
        <span class="ms">settings</span>
        <span>設定</span>
        <span class="ms profile-link-arrow">arrow_forward_ios</span>
      </button>
    </section>
  `;

  let serverCheckIns: CheckInRow[] = [];
  let serverFails = 0;

  function renderIdentity() {
    const u = $user.get();
    const p = $profile.get();
    const ident = wrap.querySelector<HTMLElement>('#identity')!;
    const dietLabel = p?.diet_type ? DIET_LABEL[p.diet_type] ?? p.diet_type : null;
    const stage = (p?.stage ?? 'egg') as PetStage;
    // Effective mood honours the food-poisoning override; if no $pet state
    // is loaded yet we fall back to whatever profile.mood says.
    const petState = $pet.get();
    const mood = petState ? effectiveMood(petState) : ((p?.mood ?? 'normal') as ReturnType<typeof effectiveMood>);
    ident.innerHTML = `
      <div class="profile-avatar">
        <img class="pet-frog" src="${spriteFor(stage, mood)}" alt="守護者" draggable="false" />
      </div>
      <div class="profile-meta">
        <div class="profile-name">${escapeHtml(u?.displayName ?? '訪客')}</div>
        <div class="profile-tags">
          <span class="profile-tag profile-tag-level">LV.${p?.level ?? 1}</span>
          ${dietLabel ? `<span class="profile-tag">${escapeHtml(dietLabel)}</span>` : ''}
        </div>
      </div>
    `;
  }

  function renderStats() {
    const p = $profile.get();
    const totalCheckIns = serverCheckIns.length;
    const daysWithCheckIn = new Set(serverCheckIns.map((c) => c.day_number)).size;
    const luckyHits = serverCheckIns.filter((c) => c.lucky_color_matched === 1).length;

    let baseline: Baseline | null = null;
    if (p?.baseline) {
      try {
        baseline = JSON.parse(p.baseline) as Baseline;
      } catch {
        /* ignore malformed baseline */
      }
    }
    const weeklyKg = 4; // assume 4 kg meat-equivalent / week per spec rough estimate
    const co2Saved = baseline
      ? impactSavedKg(weeklyKg * (daysWithCheckIn / 7), baseline)
      : 0;

    wrap.querySelector<HTMLElement>('#stats')!.innerHTML = `
      <div class="stat-card">
        <span class="stat-value">${daysWithCheckIn}</span>
        <span class="stat-label">挑戰天數</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">${totalCheckIns}</span>
        <span class="stat-label">打卡餐次</span>
      </div>
      <div class="stat-card stat-highlight">
        <span class="stat-value">${co2Saved.toFixed(1)}</span>
        <span class="stat-label">減碳 kg CO₂e</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">${luckyHits}</span>
        <span class="stat-label">幸運色命中</span>
      </div>
    `;
  }

  function renderTolerance() {
    const p = $profile.get();
    const tol = describeTolerance(p?.challenge_level ?? null, serverFails);
    const el = wrap.querySelector<HTMLElement>('#tolerance')!;
    if (!tol.show) { el.hidden = true; return; }
    el.hidden = false;
    el.classList.toggle('broken', tol.broken);
    el.innerHTML = `
      <div class="tolerance-row">
        <span class="ms">shield</span>
        <strong>等級 ${p?.challenge_level} 容錯次數</strong>
        <span class="tolerance-label">${tol.label}</span>
      </div>
    `;
  }

  function renderAll() {
    renderIdentity();
    renderStats();
    renderTolerance();
  }

  bind(wrap, $user, renderAll);
  bind(wrap, $profile, renderAll);
  bind(wrap, $pet, () => renderIdentity());

  wrap.querySelectorAll<HTMLButtonElement>('.profile-link').forEach((btn) => {
    btn.addEventListener('click', () => {
      const route = btn.dataset.route!;
      if (route === '__logout__') {
        clearUser();
        // Land on splash (see settings.ts logout for rationale).
        navigate('/');
        return;
      }
      navigate(route);
    });
  });

  void (async () => {
    const u = $user.get();
    if (!u) return;
    try {
      serverCheckIns = await listCheckIns(u.id);
      renderStats();
    } catch (err) {
      console.warn('[profile] listCheckIns failed:', err);
    }
    try {
      serverFails = await mealFailCount(u.id);
      renderTolerance();
    } catch {
      /* soft fail */
    }
  })();

  return wrap;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;',
  );
}
