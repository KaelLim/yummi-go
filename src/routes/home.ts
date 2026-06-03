/**
 * Home route — main "tamagotchi" view.
 *
 * Layout (post UX_UPDATE_SPEC_v0.1):
 *   1. Resource top bar — 💎 Gem + 🔥 Streak (XP-total + makeup-card chips
 *      moved off home per spec; tolerance pill removed entirely)
 *   2. Lucky-color card → /check-in
 *   3. Pet greeting bubble — random phrase from the time-of-day dialogue
 *      pool; tap the pet to reroll
 *   4. Level/XP progress bar (from $pet)
 *   5. Hero PetView
 *   6. Quiz bubble → /tasks/quiz
 *
 * Streak is derived locally from listCheckIns on mount. PR-3 will refactor
 * this into a shared store once the calendar/makeup logic needs it too.
 */
import { navigate } from '@/router';
import { $pet, $gems, type PetStoreShape, type GemsStoreShape } from '@/store/pet';
import { $today, type TodayStoreShape } from '@/store/today';
import { $user } from '@/store/user';
import { XP_PER_LEVEL } from '@/lib/pet-evolution';
import { normalizeLuckyColor } from '@/lib/lucky-color';
import { bind } from '@/lib/lifecycle';
import { $locale, t } from '@/lib/i18n';
import { createPetView } from '@/components/PetView';
import { listCheckIns } from '@/api/check-ins';
import { deriveStreak } from '@/lib/streak';
import { pickDialogueNow } from '@/lib/pet-dialogue';
import { buildMissions, homeVisibleMissions, type Mission } from '@/lib/missions';

interface Phase1Option {
  days: number;
  /** Gem reward shown beside the option. Use 'XX' until the numbers land. */
  gems: string;
}

/** Length-of-journey options offered in the phase-1 modal. The user picks
 *  one before tapping 開始旅程; their choice persists to localStorage so
 *  future code paths (challenge tracker, day-N celebration) can read it. */
const PHASE_1_OPTIONS: Phase1Option[] = [
  { days: 30, gems: 'XX' },
  { days: 45, gems: 'XX' },
  { days: 60, gems: 'XX' },
];
const PHASE_1_FLAG_KEY = 'yummi:phase1_modal_pending';
const PHASE_1_CHOICE_KEY = 'yummi:phase1_chosen_days';

const LUCKY_LABEL: Record<string, string> = {
  red: '紅色',
  orange: '橙色',
  yellow: '黃色',
  green: '綠色',
  blue: '藍色',
  purple: '紫色',
  black: '黑色',
  white: '白色',
};

export default function home(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'home-screen';

  const pet = createPetView();

  wrap.innerHTML = `
    <header class="home-resources" aria-label="resources">
      <div class="resource-chip" data-resource="gem" data-bind="gem-chip" title="${t('home.gem')}">
        <span class="ms">diamond</span>
        <span class="resource-num" data-bind="gems">0</span>
      </div>
      <button class="resource-chip resource-chip-button" data-resource="streak" id="streak-chip" type="button" data-bind="streak-chip" title="${t('home.streakTooltip')}">
        <span class="resource-emoji" aria-hidden="true">🔥</span>
        <span class="resource-num" data-bind="streak">0</span>
        <span class="resource-unit" data-bind="streak-unit">${t('home.streakUnit')}</span>
      </button>
    </header>
    <section class="lucky-card" id="lucky-card" role="button" tabindex="0">
      <div class="lucky-card-emoji" data-bind="lucky-emoji">🎨</div>
      <div class="lucky-card-body">
        <div class="lucky-card-title" data-bind="lucky-title">${t('home.luckyTitle')}</div>
        <div class="lucky-card-color" data-bind="lucky-label">${t('home.luckyUnset')}</div>
        <div class="lucky-card-status" data-bind="lucky-status"></div>
      </div>
      <span class="ms lucky-card-arrow">arrow_forward</span>
    </section>
    <section class="home-bubble pet-bubble" data-bind="pet-bubble" id="pet-bubble">${t('home.petBubbleFallback')}</section>
    <section class="home-hero" data-slot="pet"></section>
    <section class="level-bar">
      <div class="level-bar-label">
        <span class="level-bar-lv">LV.<span data-bind="level">1</span></span>
        <span class="level-bar-xp"><span data-bind="cur-xp">0</span>/<span data-bind="next-xp">30</span> XP</span>
      </div>
      <div class="level-bar-track">
        <div class="level-bar-fill" data-bind="level-fill" style="width:0%"></div>
      </div>
    </section>
    <section class="missions-card" id="missions-card">
      <header class="missions-header">
        <h2 class="missions-title">${t('home.missionsTitle')}</h2>
        <button class="missions-expand" id="missions-expand" type="button" aria-expanded="false">
          <span class="missions-expand-label">${t('home.missionsExpand')}</span>
          <span class="ms missions-expand-arrow">expand_more</span>
        </button>
      </header>
      <ul class="missions-list" id="missions-list" aria-live="polite"></ul>
    </section>
    <div class="phase1-modal" id="phase1-modal" hidden role="dialog" aria-modal="true" aria-labelledby="phase1-title">
      <div class="phase1-modal-card">
        <div class="phase1-icon" aria-hidden="true">🌱</div>
        <h2 class="phase1-title" id="phase1-title">${t('home.phase1Title')}</h2>
        <p class="phase1-body">${t('home.phase1Body')}</p>
        <div class="phase1-options" id="phase1-options" role="radiogroup" aria-label="${t('home.phase1AriaDays')}">
          ${PHASE_1_OPTIONS.map((o) => `
            <button class="phase1-option" data-days="${o.days}" type="button" role="radio" aria-checked="false">
              <span class="phase1-option-days">${t('home.phase1Days').replace('{n}', String(o.days))}</span>
              <span class="phase1-option-gems">+${o.gems} 💎</span>
            </button>
          `).join('')}
        </div>
        <button class="btn text-btn-m btn-primary btn-l text-btn-l" id="phase1-continue" type="button" disabled>
          ${t('home.phase1Cta')}
        </button>
      </div>
    </div>
  `;

  wrap.querySelector('[data-slot="pet"]')?.appendChild(pet.el);

  const $$ = (sel: string) => wrap.querySelector<HTMLElement>(sel);

  // Pick an initial pet-bubble line from the time-of-day pool. Tapping
  // the pet rerolls — kept slightly different from the last line so
  // back-to-back taps don't repeat. The day-script copy is no longer
  // used here per UX_UPDATE_SPEC_v0.1 §1.
  const bubbleEl = $$('#pet-bubble');
  let lastBubble = pickDialogueNow();
  if (bubbleEl) bubbleEl.textContent = lastBubble;
  pet.el.addEventListener('click', () => {
    lastBubble = pickDialogueNow(lastBubble);
    if (bubbleEl) bubbleEl.textContent = lastBubble;
  });

  function renderPet(p: PetStoreShape | null) {
    const level = p?.level ?? 1;
    const cur = p?.currentXp ?? 0;
    const need = XP_PER_LEVEL[level] ?? 30;
    const pct = Math.max(0, Math.min(100, Math.round((cur / need) * 100)));
    const lvEl = $$('[data-bind="level"]');
    if (lvEl) lvEl.textContent = String(level);
    const curEl = $$('[data-bind="cur-xp"]');
    if (curEl) curEl.textContent = String(cur);
    const needEl = $$('[data-bind="next-xp"]');
    if (needEl) needEl.textContent = String(need);
    const fill = $$('[data-bind="level-fill"]');
    if (fill) fill.style.width = pct + '%';
  }

  function renderToday(t: TodayStoreShape) {
    const lucky = t.luckyColor;
    const palette = normalizeLuckyColor(lucky);
    const labelEl = $$('[data-bind="lucky-label"]');
    if (labelEl) {
      labelEl.textContent =
        lucky || (palette ? LUCKY_LABEL[palette] : '未設定') || '未設定';
    }
    const emojiEl = $$('[data-bind="lucky-emoji"]');
    if (emojiEl) {
      if (palette) {
        emojiEl.style.background = colorPreview(palette);
        emojiEl.textContent = '';
      } else {
        emojiEl.style.background = '';
        emojiEl.textContent = '🎨';
      }
    }

    const luckyHit = t.missionsDone.includes('lucky:hit');
    const luckyCard = $$('#lucky-card');
    if (luckyCard) luckyCard.classList.toggle('hit', luckyHit);
    const luckyStatusEl = $$('[data-bind="lucky-status"]');
    if (luckyStatusEl) luckyStatusEl.textContent = luckyHit ? '✓ 已命中 +15 XP' : '';

    renderMissions(t);
  }

  // Missions accordion state — collapsed by default, expands in-place when
  // the user taps "查看全部". No popup/modal; same card, more rows.
  //
  // Collapsed view always pairs the current-meal check-in with one
  // non-meal mission (quiz/lucky/5R/...) so the user sees both their
  // primary daily action and a secondary nudge without scrolling.
  let missionsExpanded = false;
  function renderMissions(t: TodayStoreShape) {
    const list = $$('#missions-list');
    if (!list) return;
    const all = buildMissions({ today: t });
    const visible = missionsExpanded ? all : homeVisibleMissions(all);
    list.innerHTML = '';
    if (visible.length === 0) {
      list.innerHTML = `
        <li class="mission-row mission-row-empty">
          <span class="ms">celebration</span>
          <span class="mission-label">今日任務全部完成！</span>
        </li>
      `;
      return;
    }
    for (const m of visible) {
      list.appendChild(renderMissionRow(m));
    }
  }
  function toggleMissions(): void {
    missionsExpanded = !missionsExpanded;
    const btn = $$('#missions-expand');
    if (btn) {
      btn.setAttribute('aria-expanded', String(missionsExpanded));
      const label = btn.querySelector('.missions-expand-label');
      if (label) label.textContent = missionsExpanded ? '收合' : '查看全部';
      const arrow = btn.querySelector<HTMLElement>('.missions-expand-arrow');
      if (arrow) arrow.textContent = missionsExpanded ? 'expand_less' : 'expand_more';
    }
    renderMissions($today.get());
  }

  function renderWallet(g: GemsStoreShape) {
    const gem = $$('[data-bind="gems"]');
    if (gem) gem.textContent = String(g.balance);
  }

  // Streak: derived from listCheckIns on mount. Refresh when $today's
  // dayNumber advances (handles the midnight rollover from day-sync).
  let lastDayLoaded: number | null = null;
  async function refreshStreak(): Promise<void> {
    const u = $user.get();
    const today = $today.get().dayNumber;
    if (!u) return;
    if (lastDayLoaded === today) return; // already loaded for today
    lastDayLoaded = today;
    try {
      const rows = await listCheckIns(u.id);
      const streak = deriveStreak({ checkIns: rows, todayDayNumber: today });
      const el = $$('[data-bind="streak"]');
      if (el) el.textContent = String(streak);
    } catch {
      /* leave the chip at 0 — non-fatal */
    }
  }

  // Locale: re-paint the static labels on the top row when the user
  // toggles language. Dynamic values (gem count, streak number, lucky
  // colour name) are repainted by their own subscriptions; this only
  // touches the i18n'd labels.
  bind(wrap, $locale, () => {
    const gemChip = wrap.querySelector<HTMLElement>('[data-bind="gem-chip"]');
    if (gemChip) gemChip.title = t('home.gem');
    const streakChip = wrap.querySelector<HTMLElement>('[data-bind="streak-chip"]');
    if (streakChip) streakChip.title = t('home.streakTooltip');
    const unit = wrap.querySelector<HTMLElement>('[data-bind="streak-unit"]');
    if (unit) unit.textContent = t('home.streakUnit');
    const luckyTitle = wrap.querySelector<HTMLElement>('[data-bind="lucky-title"]');
    if (luckyTitle) luckyTitle.textContent = t('home.luckyTitle');
  });
  bind(wrap, $pet, renderPet);
  bind(wrap, $today, (today) => {
    renderToday(today);
    void refreshStreak();
  });
  bind(wrap, $gems, renderWallet);

  $$('#lucky-card')?.addEventListener('click', () => navigate('/check-in'));
  $$('#streak-chip')?.addEventListener('click', () => navigate('/profile/calendar'));
  $$('#missions-expand')?.addEventListener('click', toggleMissions);

  // Phase-1 modal — shows once on the user's first home visit after
  // onboarding + first check-in. /check-in/success drops a localStorage
  // flag when isFirstCheckIn=true; home picks it up here and clears it
  // so subsequent visits don't repeat the modal. The user picks a
  // journey length (30 / 45 / 60 days) which we persist for future
  // challenge-tracker code.
  try {
    if (localStorage.getItem(PHASE_1_FLAG_KEY) === '1') {
      const modal = $$('#phase1-modal');
      const continueBtn = modal?.querySelector<HTMLButtonElement>('#phase1-continue');
      if (modal && continueBtn) {
        modal.hidden = false;
        let chosenDays: number | null = null;
        modal.querySelectorAll<HTMLButtonElement>('.phase1-option').forEach((btn) => {
          btn.addEventListener('click', () => {
            chosenDays = Number(btn.dataset.days);
            modal.querySelectorAll<HTMLButtonElement>('.phase1-option').forEach((b) => {
              const on = b === btn;
              b.classList.toggle('is-selected', on);
              b.setAttribute('aria-checked', String(on));
            });
            continueBtn.disabled = false;
          });
        });
        continueBtn.addEventListener('click', () => {
          if (chosenDays === null) return;
          modal.hidden = true;
          try {
            localStorage.setItem(PHASE_1_CHOICE_KEY, String(chosenDays));
            localStorage.removeItem(PHASE_1_FLAG_KEY);
          } catch { /* private mode */ }
        });
      }
    }
  } catch { /* private mode — modal stays hidden, no harm */ }

  return wrap;
}

function renderMissionRow(m: Mission): HTMLElement {
  const li = document.createElement('li');
  li.className = 'mission-row' + (m.done ? ' done' : '');
  li.dataset.key = m.key;
  const arrow = m.selfCheck
    ? `<input type="checkbox" class="mission-check" ${m.done ? 'checked' : ''} disabled />`
    : `<span class="ms mission-arrow">arrow_forward</span>`;
  const xpTag = m.xp > 0
    ? `<span class="mission-xp">+${m.xp} XP</span>`
    : `<span class="mission-xp mission-xp-zero">永續</span>`;
  li.innerHTML = `
    <span class="mission-emoji" aria-hidden="true">${m.emoji}</span>
    <span class="mission-label">${m.label}</span>
    ${xpTag}
    ${arrow}
  `;
  if (m.href) {
    li.classList.add('mission-row-clickable');
    li.addEventListener('click', () => {
      if (m.done) return;
      navigate(m.href!);
    });
  }
  return li;
}


function colorPreview(name: string): string {
  const map: Record<string, string> = {
    red: 'linear-gradient(135deg,#ff6b6b,#ff3b3b)',
    orange: 'linear-gradient(135deg,#ffb86b,#ff8a3b)',
    yellow: 'linear-gradient(135deg,#ffe26b,#ffc83b)',
    green: 'linear-gradient(135deg,#7bdc8a,#3bb84b)',
    blue: 'linear-gradient(135deg,#7ec8ff,#3b8eff)',
    purple: 'linear-gradient(135deg,#c898ff,#8a3bff)',
    black: 'linear-gradient(135deg,#555,#111)',
    white: 'linear-gradient(135deg,#fff,#ddd)',
  };
  return map[name] ?? '#ddd';
}
