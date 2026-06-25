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
import { $ui } from '@/store/ui';
import { XP_PER_LEVEL } from '@/lib/pet-evolution';
import { normalizeLuckyColor } from '@/lib/lucky-color';
import { bind } from '@/lib/lifecycle';
import { $locale, t } from '@/lib/i18n';
import { openMissionsInfo } from '@/lib/missions-info';
import { createPetView } from '@/components/PetView';
import { createQuestionnairePopup } from '@/components/QuestionnairePopup';
import { listCheckIns, type CheckInRow } from '@/api/check-ins';
import { deriveStreak } from '@/lib/streak';
import { pickDialogueNow } from '@/lib/pet-dialogue';
import { buildMissions, homeVisibleMissions, type Mission } from '@/lib/missions';
import { findPendingMilestone, findDeferredMilestone, type Milestone } from '@/lib/questionnaires';
import { gemIcon, xpIcon } from '@/lib/currency-icons';

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
  red: 'color.red',
  orange: 'color.orange',
  yellow: 'color.yellow',
  green: 'color.green',
  blue: 'color.blue',
  purple: 'color.purple',
  black: 'color.black',
  white: 'color.white',
};

export default function home(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'home-screen';

  const pet = createPetView();

  wrap.innerHTML = `
    <header class="home-resources" aria-label="resources">
      <div class="resource-chip" data-resource="gem" data-bind="gem-chip" title="${t('home.gem')}">
        ${gemIcon(20)}
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
    <section class="pet-name-line"><span class="pet-name-tag" data-bind="pet-name"></span></section>
    <section class="level-bar">
      <div class="level-bar-label">
        <span class="level-bar-lv">LV.<span data-bind="level">1</span></span>
        <span class="level-bar-xp"><span data-bind="cur-xp">0</span>/<span data-bind="next-xp">30</span> ${xpIcon(16)}</span>
      </div>
      <div class="level-bar-track">
        <div class="level-bar-fill" data-bind="level-fill" style="width:0%"></div>
      </div>
    </section>
    <section class="missions-card" id="missions-card">
      <header class="missions-header">
        <h2 class="missions-title">
          ${t('home.missionsTitle')}
          <button class="vegan-info-btn vegan-info-btn-inline" id="missions-info-btn" type="button" aria-label="${t('home.missionsInfo')}" title="${t('home.missionsInfo')}">
            <span class="ms">info</span>
          </button>
        </h2>
        <button class="missions-expand" id="missions-expand" type="button" aria-expanded="false">
          <span class="missions-expand-label">${t('home.missionsExpand')}</span>
          <span class="ms missions-expand-arrow">expand_more</span>
        </button>
      </header>
      <ul class="missions-list" id="missions-list" aria-live="polite"></ul>
    </section>
    <button class="qn-deferred-card" id="qn-deferred-card" type="button" hidden>
      <span class="ms qn-deferred-icon">help</span>
      <span class="qn-deferred-body">
        <span class="qn-deferred-title" data-bind="qn-deferred-title"></span>
        <span class="qn-deferred-sub" data-bind="qn-deferred-sub"></span>
      </span>
      <span class="ms qn-deferred-arrow">arrow_forward</span>
    </button>
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

  function renderToday(today: TodayStoreShape) {
    const lucky = today.luckyColor;
    const palette = normalizeLuckyColor(lucky);
    const labelEl = $$('[data-bind="lucky-label"]');
    if (labelEl) {
      const palKey = palette ? LUCKY_LABEL[palette] : null;
      labelEl.textContent =
        lucky || (palKey ? t(palKey) : t('home.luckyUnset')) || t('home.luckyUnset');
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

    const luckyHit = today.missionsDone.includes('lucky:hit');
    const luckyCard = $$('#lucky-card');
    if (luckyCard) luckyCard.classList.toggle('hit', luckyHit);
    const luckyStatusEl = $$('[data-bind="lucky-status"]');
    if (luckyStatusEl) luckyStatusEl.textContent = luckyHit ? t('home.luckyHit') : '';

    renderMissions(today);
  }

  // Missions accordion state — collapsed by default, expands in-place when
  // the user taps "查看全部". No popup/modal; same card, more rows.
  //
  // Collapsed view always pairs the current-meal check-in with one
  // non-meal mission (quiz/lucky/5R/...) so the user sees both their
  // primary daily action and a secondary nudge without scrolling.
  let missionsExpanded = false;
  function renderMissions(today: TodayStoreShape) {
    const list = $$('#missions-list');
    if (!list) return;
    const all = buildMissions({ today });
    const visible = missionsExpanded ? all : homeVisibleMissions(all);
    list.innerHTML = '';
    if (visible.length === 0) {
      list.innerHTML = `
        <li class="mission-row mission-row-empty">
          <span class="ms">celebration</span>
          <span class="mission-label">${t('home.missionsAllDone')}</span>
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
      if (label) label.textContent = missionsExpanded ? t('home.missionsCollapse') : t('home.missionsExpand');
      const arrow = btn.querySelector<HTMLElement>('.missions-expand-arrow');
      if (arrow) arrow.textContent = missionsExpanded ? 'expand_less' : 'expand_more';
    }
    renderMissions($today.get());
  }

  function renderWallet(g: GemsStoreShape) {
    const gem = $$('[data-bind="gems"]');
    if (gem) gem.textContent = String(g.balance);
  }

  // Streak chip + milestone questionnaire — both derive from the
  // user's check-in history. We fetch once per challenge-day, cache
  // the rows, and let `paintStreakAndQuestionnaire` recompute both
  // from cache. This lets a dev-only override (`$ui.devSimulatedDays`)
  // pretend the user has more check-in days than they really do, so
  // milestone popups can be previewed without logging real meals.
  let lastDayLoaded: number | null = null;
  let serverRows: CheckInRow[] = [];

  async function refreshStreak(): Promise<void> {
    const u = $user.get();
    const today = $today.get().dayNumber;
    if (!u) return;
    if (lastDayLoaded !== today) {
      lastDayLoaded = today;
      try {
        serverRows = await listCheckIns(u.id);
      } catch {
        serverRows = [];
      }
    }
    paintStreakAndQuestionnaire();
  }

  function paintStreakAndQuestionnaire(): void {
    const today = $today.get().dayNumber;
    const realStreak = deriveStreak({ checkIns: serverRows, todayDayNumber: today });
    const realDistinct = new Set(serverRows.map((r) => r.day_number)).size;
    const ui = $ui.get();
    // Dev override — when running in dev mode with manual time, pretend
    // the user has checked in for `manualDay` distinct days. Persists
    // across reloads because manualDay is in localStorage.
    const useOverride = ui.devMode && ui.timeMode === 'manual' && ui.manualDay > 0;
    const streakValue = useOverride ? ui.manualDay : realStreak;
    const distinctValue = useOverride ? ui.manualDay : realDistinct;
    const el = $$('[data-bind="streak"]');
    if (el) el.textContent = String(streakValue);
    // Defer one frame so the popup doesn't fight the home paint for layout.
    window.requestAnimationFrame(() => syncMilestoneSurfaces(distinctValue));
  }

  // Track whether the popup is currently mounted — guards against
  // re-mounting from rapid $ui changes.
  let questionnaireMounted = false;
  function syncMilestoneSurfaces(daysWithCheckIn: number): void {
    // Pending = never touched → auto-popup.
    const pending = findPendingMilestone(daysWithCheckIn);
    if (pending && !questionnaireMounted) {
      mountPopup(pending);
    }
    // Deferred = user picked "Maybe later" → render a tappable card on
    // the pet page (= /home). The card stays put across re-paints.
    paintDeferredCard(findDeferredMilestone(daysWithCheckIn));
  }

  function mountPopup(milestone: Milestone): void {
    questionnaireMounted = true;
    const popup = createQuestionnairePopup({
      milestone,
      onResolved: () => {
        questionnaireMounted = false;
        // After resolution the milestone may have moved into deferred
        // OR answered state — re-derive the card visibility.
        const ui = $ui.get();
        const useOverride = ui.devMode && ui.timeMode === 'manual' && ui.manualDay > 0;
        const days = useOverride
          ? ui.manualDay
          : new Set(serverRows.map((r) => r.day_number)).size;
        paintDeferredCard(findDeferredMilestone(days));
      },
    });
    wrap.appendChild(popup.el);
  }

  function paintDeferredCard(milestone: Milestone | null): void {
    const card = $$('#qn-deferred-card') as HTMLButtonElement | null;
    if (!card) return;
    if (!milestone) {
      card.hidden = true;
      return;
    }
    const locale = $locale.get();
    const title = $$('[data-bind="qn-deferred-title"]');
    const sub = $$('[data-bind="qn-deferred-sub"]');
    if (title) title.textContent = locale === 'en' ? milestone.title.en : milestone.title.zh;
    if (sub) sub.textContent = locale === 'en' ? 'Tap to finish answering' : '點此繼續作答';
    card.hidden = false;
    // Rebind click each paint so the latest milestone reference is used.
    card.onclick = () => {
      if (questionnaireMounted) return;
      mountPopup(milestone);
    };
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
  bind(wrap, $user, (u) => {
    const nameEl = $$('[data-bind="pet-name"]');
    if (!nameEl) return;
    // Fall back to the generic guardian label if the user-set name is
    // empty — better than rendering an invisible :empty pill.
    const name = u?.displayName?.trim() || t('onb.start.petFallback');
    nameEl.textContent = name;
  });
  // Dev override repaint — when the dev panel updates manualDay or
  // timeMode (slider drag), we want the streak chip + questionnaire
  // trigger to react immediately without waiting for $today rollover.
  let lastManualDay = $ui.get().manualDay;
  let lastTimeMode = $ui.get().timeMode;
  bind(wrap, $ui, (ui) => {
    if (ui.manualDay !== lastManualDay || ui.timeMode !== lastTimeMode) {
      lastManualDay = ui.manualDay;
      lastTimeMode = ui.timeMode;
      paintStreakAndQuestionnaire();
    }
  });
  bind(wrap, $today, (today) => {
    renderToday(today);
    void refreshStreak();
  });
  bind(wrap, $gems, renderWallet);

  $$('#lucky-card')?.addEventListener('click', () => navigate('/check-in'));
  $$('#streak-chip')?.addEventListener('click', () => navigate('/profile/calendar'));
  $$('#missions-expand')?.addEventListener('click', toggleMissions);
  $$('#missions-info-btn')?.addEventListener('click', () => openMissionsInfo(wrap));

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
  // Three render modes for the right-hand label:
  //   xp > 0          → "+N {drop icon}"
  //   xp = 0 + selfCheck (5R rows) → "永續行動" badge
  //   xp = 0 + !selfCheck (e.g. evergreen CTA rows like 餐廳認證／評論)
  //                   → no badge at all, the arrow speaks for itself.
  const xpTag = m.xp > 0
    ? `<span class="mission-xp">+${m.xp}${xpIcon(14)}</span>`
    : m.selfCheck
      ? `<span class="mission-xp mission-xp-zero">${t('home.missionsSustainable')}</span>`
      : '';
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
