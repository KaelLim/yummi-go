/**
 * Profile hub — identity card + 30-day calendar + accumulated stats + entries.
 *
 * Calendar cell colour:
 *   - 灰：未到 / 未來
 *   - 葉：當天有打卡
 *   - 幸：當天有打卡且命中幸運色
 *   - 缺：應打但沒打（過去）
 *
 * Stats card aggregates: total days with at least one check-in, total
 * check-in count (rough proxy for meals), accumulated XP from $profile,
 * and CO2 saved via baseline-impact (uses user's onboarding baseline if
 * present; otherwise zero).
 */
import { navigate } from '@/router';
import { $user, $profile, clearUser } from '@/store/user';
import { $today, $challenge } from '@/store/today';
import { listCheckIns, type CheckInRow } from '@/api/check-ins';
import { impactSavedKg, type Baseline } from '@/lib/baseline-impact';
import { bind } from '@/lib/lifecycle';

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
    <section class="profile-section">
      <div class="profile-section-head">
        <h2 class="profile-section-title">月曆</h2>
        <span class="profile-section-meta" id="cal-meta">…</span>
      </div>
      <div class="calendar-grid" id="calendar"></div>
      <div class="calendar-legend">
        <span class="dot d-leaf"></span>打卡
        <span class="dot d-lucky"></span>幸運色
        <span class="dot d-miss"></span>未打
      </div>
    </section>
    <section class="profile-links">
      <button class="profile-link" data-route="/profile/reviews">
        <span class="ms">rate_review</span>
        <span>我的評論</span>
        <span class="ms profile-link-arrow">arrow_forward_ios</span>
      </button>
      <button class="profile-link" data-route="/profile/baseline">
        <span class="ms">tune</span>
        <span>編輯基準飲食</span>
        <span class="ms profile-link-arrow">arrow_forward_ios</span>
      </button>
      <button class="profile-link" data-route="/profile/settings">
        <span class="ms">settings</span>
        <span>設定</span>
        <span class="ms profile-link-arrow">arrow_forward_ios</span>
      </button>
      <button class="profile-link profile-link-strong" data-route="/challenge/day-30">
        <span class="ms">emoji_events</span>
        <span>查看 Day-30 終曲</span>
        <span class="ms profile-link-arrow">arrow_forward_ios</span>
      </button>
    </section>
  `;

  let serverCheckIns: CheckInRow[] = [];

  function renderIdentity() {
    const u = $user.get();
    const p = $profile.get();
    const ident = wrap.querySelector<HTMLElement>('#identity')!;
    const dietLabel = p?.diet_type ? DIET_LABEL[p.diet_type] ?? p.diet_type : null;
    const stage = p?.stage ?? 'egg';
    ident.innerHTML = `
      <div class="profile-avatar pet-stage-${stage} pet-mood-normal">
        <img class="pet-frog" src="/pet-frog.png" alt="守護者" draggable="false" />
        <div class="pet-shell" aria-hidden="true">🥚</div>
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

  function renderCalendar() {
    const today = $today.get().dayNumber;
    const byDay = new Map<number, CheckInRow[]>();
    for (const c of serverCheckIns) {
      const arr = byDay.get(c.day_number) ?? [];
      arr.push(c);
      byDay.set(c.day_number, arr);
    }
    const meta = wrap.querySelector<HTMLElement>('#cal-meta')!;
    meta.textContent = `D${today} / 30`;

    const grid = wrap.querySelector<HTMLElement>('#calendar')!;
    grid.innerHTML = Array.from({ length: 30 }, (_, i) => {
      const day = i + 1;
      const records = byDay.get(day) ?? [];
      const hasCheckIn = records.length > 0;
      const hasLucky = records.some((c) => c.lucky_color_matched === 1);
      let cls = 'cal-cell';
      if (day > today) cls += ' future';
      else if (hasLucky) cls += ' lucky';
      else if (hasCheckIn) cls += ' done';
      else cls += ' miss';
      if (day === today) cls += ' today';
      const icon = day > today ? '' : hasLucky ? '★' : hasCheckIn ? '✓' : '·';
      return `<div class="${cls}" data-day="${day}"><span class="cal-num">${day}</span><span class="cal-icon">${icon}</span></div>`;
    }).join('');
  }

  function renderAll() {
    renderIdentity();
    renderStats();
    renderCalendar();
  }

  bind(wrap, $user, renderAll);
  bind(wrap, $profile, renderAll);
  bind(wrap, $today, renderCalendar);
  bind(wrap, $challenge, () => {});

  wrap.querySelectorAll<HTMLButtonElement>('.profile-link').forEach((btn) => {
    btn.addEventListener('click', () => {
      const route = btn.dataset.route!;
      if (route === '__logout__') {
        clearUser();
        navigate('/login');
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
      renderCalendar();
    } catch (err) {
      console.warn('[profile] listCheckIns failed:', err);
    }
  })();

  return wrap;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;',
  );
}
