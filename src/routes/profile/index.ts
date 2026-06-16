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
import { $locale, t } from '@/lib/i18n';

function describeTolerance(level: number | null | undefined, fails: number): {
  show: boolean; total: number | null; used: number; broken: boolean; label: string;
} {
  if (!level || level === 1) return { show: false, total: null, used: fails, broken: false, label: '' };
  const total = level === 2 ? 3 : 0;
  const used = fails;
  const broken = used > total;
  const label = total > 0
    ? t('tolerance.usedFmt').replace('{used}', String(Math.min(used, total))).replace('{total}', String(total))
    : (used > 0 ? t('tolerance.broken') : t('tolerance.zero'));
  return { show: true, total, used, broken, label };
}

const DIET_LABEL_KEY: Record<string, string> = {
  vegan: 'profile.diet.fallback.vegan',
  vegetarian: 'profile.diet.fallback.vegetarian',
  flexitarian: 'profile.diet.fallback.flexitarian',
  omnivore: 'profile.diet.fallback.omnivore',
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
        <span data-i18n="profile.linkJourney">蔬食旅程</span>
        <span class="ms profile-link-arrow">arrow_forward_ios</span>
      </button>
      <button class="profile-link" data-route="/profile/pet-collection">
        <span class="ms">collections_bookmark</span>
        <span data-i18n="profile.linkCollection">守護者圖鑑</span>
        <span class="ms profile-link-arrow">arrow_forward_ios</span>
      </button>
      <button class="profile-link" data-route="/profile/reviews">
        <span class="ms">rate_review</span>
        <span data-i18n="profile.linkReviews">我的評論</span>
        <span class="ms profile-link-arrow">arrow_forward_ios</span>
      </button>
      <button class="profile-link" data-route="/profile/baseline">
        <span class="ms">tune</span>
        <span data-i18n="profile.linkBaseline">編輯基本飲食</span>
        <span class="ms profile-link-arrow">arrow_forward_ios</span>
      </button>
      <button class="profile-link" data-route="/profile/settings">
        <span class="ms">settings</span>
        <span data-i18n="profile.linkSettings">設定</span>
        <span class="ms profile-link-arrow">arrow_forward_ios</span>
      </button>
    </section>
  `;

  let serverCheckIns: CheckInRow[] = [];
  let serverFails = 0;

  function renderIdentity() {
    // Identity card now represents the human, not the guardian. The pet
    // sprite + name + level moved to the pet page; the only stable
    // identifier we have for the human is their username (a guest_xxx
    // anonymous id until/unless they bind a Google account).
    const u = $user.get();
    const p = $profile.get();
    const ident = wrap.querySelector<HTMLElement>('#identity')!;
    const dietKey = p?.diet_type ? DIET_LABEL_KEY[p.diet_type] : null;
    const dietLabel = dietKey ? t(dietKey) : (p?.diet_type ?? null);
    const anonId = u?.username ?? '—';
    ident.innerHTML = `
      <div class="profile-avatar profile-avatar-anon">
        <span class="ms" aria-hidden="true">account_circle</span>
      </div>
      <div class="profile-meta">
        <div class="profile-anon-label" data-i18n="profile.anonIdLabel">${t('profile.anonIdLabel')}</div>
        <div class="profile-anon-id">${escapeHtml(anonId)}</div>
        ${dietLabel ? `<div class="profile-tags"><span class="profile-tag">${escapeHtml(dietLabel)}</span></div>` : ''}
      </div>
    `;
  }

  function renderStats() {
    const p = $profile.get();
    const totalCheckIns = serverCheckIns.length;
    const daysWithCheckIn = new Set(serverCheckIns.map((c) => c.day_number)).size;

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
        <span class="stat-label">${t('profile.statsDays')}</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">${totalCheckIns}</span>
        <span class="stat-label">${t('profile.statsMeals')}</span>
      </div>
      <div class="stat-card stat-highlight">
        <span class="stat-value">${co2Saved.toFixed(1)}</span>
        <span class="stat-label">${t('profile.statsCo2')}</span>
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
        <strong>${t('tolerance.titleFmt').replace('{lv}', String(p?.challenge_level ?? ''))}</strong>
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
  // i18n: swap link labels + stats labels on locale toggle.
  bind(wrap, $locale, () => {
    wrap.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
      const key = el.dataset.i18n;
      if (key) el.textContent = t(key);
    });
    renderStats();
    renderIdentity();
  });

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
