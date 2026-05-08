/**
 * Tasks hub — 3 segments: 今日任務 / 5R / 補簽.
 *
 * Today's missions are partially in-memory ($today.missionsDone, populated
 * during the session) and partially derived from drust on mount: we list
 * the user's check-ins for the current day to count meals + detect any
 * lucky-color match. 5R is parsed from the day's challenge_scripts row;
 * 補簽 surfaces the fragment / card counts from $profile.
 *
 * The page does NOT push state to the server — it's a read-only view of
 * progress. CTAs route to /check-in, /tasks/quiz, /map, /tasks/makeup.
 */
import { navigate } from '@/router';
import { $user, $profile } from '@/store/user';
import { $today, $challenge, markMissionDone } from '@/store/today';
import { bind } from '@/lib/lifecycle';
import { listCheckIns, type CheckInRow } from '@/api/check-ins';

type Segment = 'today' | '5r' | 'makeup';

const FIVE_R_LABEL: Record<string, { tag: string; emoji: string }> = {
  Refuse: { tag: 'Refuse 拒絕', emoji: '🚫' },
  Reuse: { tag: 'Reuse 重複用', emoji: '♻️' },
  Reduce: { tag: 'Reduce 減量', emoji: '⬇️' },
  Recycle: { tag: 'Recycle 回收', emoji: '🔄' },
  Repair: { tag: 'Repair 修復', emoji: '🛠️' },
};

interface Mission {
  key: string;
  icon: string;
  title: string;
  reward: number;
  done: boolean;
  cta?: { label: string; route: string } | null;
  progress?: { current: number; total: number };
}

export default function tasks(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'tasks-screen';

  let segment: Segment = 'today';
  let serverCheckIns: CheckInRow[] = [];

  wrap.innerHTML = `
    <header class="tasks-header">
      <h1 class="tasks-title">任務</h1>
      <span class="tasks-day" id="day-tag">D1</span>
    </header>
    <div class="tasks-segments" id="segments">
      <button class="seg active" data-seg="today">今日任務</button>
      <button class="seg" data-seg="5r">5R</button>
      <button class="seg" data-seg="makeup">補簽</button>
    </div>
    <section class="tasks-body" id="body"></section>
  `;

  const body = wrap.querySelector<HTMLElement>('#body')!;
  const dayTag = wrap.querySelector<HTMLElement>('#day-tag')!;

  function selectSegment(s: Segment) {
    segment = s;
    wrap.querySelectorAll<HTMLButtonElement>('.seg').forEach((b) => {
      b.classList.toggle('active', b.dataset.seg === s);
    });
    rerender();
  }

  wrap.querySelectorAll<HTMLButtonElement>('.seg').forEach((b) => {
    b.addEventListener('click', () => selectSegment(b.dataset.seg as Segment));
  });

  function buildMissions(): Mission[] {
    const t = $today.get();
    const cur = $challenge.get().currentDay;
    const mealsDone = serverCheckIns.length || t.missionsDone.filter((k) => k.startsWith('meal:')).length;
    const luckyHit =
      serverCheckIns.some((c) => c.lucky_color_matched === 1) ||
      t.missionsDone.some((k) => k === 'lucky:hit');
    const quizDone = t.missionsDone.includes('quiz');
    const reviewDone = t.missionsDone.some((k) => k.startsWith('review:'));
    const ecoDone = t.missionsDone.includes('eco');

    return [
      {
        key: 'meal',
        icon: 'restaurant',
        title: '飲食打卡',
        reward: 30,
        done: mealsDone >= 3,
        cta: mealsDone >= 3 ? null : { label: '前往打卡', route: '/check-in' },
        progress: { current: mealsDone, total: 3 },
      },
      {
        key: 'eco',
        icon: 'eco',
        title: cur?.bonus_challenge ?? '環保行動：自備餐具',
        reward: 15,
        done: ecoDone,
        cta: ecoDone ? null : { label: '我做到了', route: '#mark:eco' },
      },
      {
        key: 'lucky',
        icon: 'palette',
        title: `今日幸運色（${cur?.lucky_color ?? '未設定'}）`,
        reward: 15,
        done: luckyHit,
        cta: luckyHit ? null : { label: '前往打卡', route: '/check-in' },
      },
      {
        key: 'quiz',
        icon: 'school',
        title: '每日小測驗',
        reward: 15,
        done: quizDone,
        cta: quizDone ? null : { label: '前往作答', route: '/tasks/quiz' },
      },
      {
        key: 'review',
        icon: 'rate_review',
        title: '寫一則餐廳評論',
        reward: 20,
        done: reviewDone,
        cta: reviewDone ? null : { label: '前往地圖', route: '/map' },
      },
    ];
  }

  function renderToday() {
    const missions = buildMissions();
    body.innerHTML = `
      <ul class="mission-list">
        ${missions
          .map(
            (m) => `
            <li class="mission ${m.done ? 'done' : ''}">
              <div class="mission-icon"><span class="ms">${m.done ? 'check_circle' : m.icon}</span></div>
              <div class="mission-body">
                <div class="mission-title">${escapeHtml(m.title)}</div>
                ${m.progress ? `<div class="mission-progress"><span class="bar"><span style="width:${(m.progress.current / m.progress.total) * 100}%"></span></span><span class="muted">${m.progress.current}/${m.progress.total}</span></div>` : ''}
              </div>
              <div class="mission-tail">
                <span class="mission-xp">+${m.reward} XP</span>
                ${m.cta ? `<button class="mission-cta" data-cta="${escapeHtml(m.cta.route)}" data-key="${m.key}">${escapeHtml(m.cta.label)}</button>` : ''}
              </div>
            </li>`,
          )
          .join('')}
      </ul>
    `;

    body.querySelectorAll<HTMLButtonElement>('.mission-cta').forEach((b) => {
      b.addEventListener('click', () => {
        const cta = b.dataset.cta!;
        const key = b.dataset.key!;
        if (cta.startsWith('#mark:')) {
          const which = cta.slice('#mark:'.length);
          const reward = which === 'eco' ? 15 : 0;
          markMissionDone(which, reward);
          rerender();
          return;
        }
        void key;
        navigate(cta);
      });
    });
  }

  function render5R() {
    const cur = $challenge.get().currentDay;
    const action = cur?.action_type ?? '';
    const rkey = (Object.keys(FIVE_R_LABEL).find((k) => action.startsWith(k)) ?? '') as
      | keyof typeof FIVE_R_LABEL
      | '';
    const meta = rkey ? FIVE_R_LABEL[rkey] : null;
    const description = action.includes('：') ? action.split('：').slice(1).join('：') : action;

    body.innerHTML = `
      <div class="five-r-card ${meta ? 'has-r' : ''}">
        <div class="five-r-emoji">${meta?.emoji ?? '🌱'}</div>
        <div class="five-r-tag">${meta?.tag ?? '今日環保行動'}</div>
        <h2 class="five-r-title">${escapeHtml(description || '今日無特別環保任務')}</h2>
        ${cur?.bonus_challenge ? `<div class="five-r-bonus"><span class="ms">stars</span>${escapeHtml(cur.bonus_challenge)}</div>` : ''}
        <p class="five-r-help">5R 行動每日輪動：Refuse → Reuse → Reduce → Recycle → Repair。</p>
      </div>
    `;
  }

  function renderMakeup() {
    const p = $profile.get();
    const fragments = p?.fragment_count ?? 0;
    const cards = p?.card_count ?? 0;
    const gems = p?.gems ?? 0;
    const fragmentsToCard = 4 - (fragments % 4 || 4);
    body.innerHTML = `
      <div class="makeup-card">
        <div class="makeup-row">
          <span class="ms makeup-icon">extension</span>
          <span class="makeup-label">碎片</span>
          <strong>${fragments}</strong>
        </div>
        <div class="makeup-progress">
          <span class="bar"><span style="width:${((fragments % 4) / 4) * 100}%"></span></span>
          <span class="muted">還差 ${fragmentsToCard} 個碎片可合成 1 張補簽卡</span>
        </div>
        <div class="makeup-row">
          <span class="ms makeup-icon">style</span>
          <span class="makeup-label">補簽卡</span>
          <strong>${cards}</strong>
        </div>
        <div class="makeup-row">
          <span class="ms makeup-icon">diamond</span>
          <span class="makeup-label">寶石</span>
          <strong>${gems}</strong>
        </div>
        <p class="makeup-help">每日 XP 滿 100 後，每多 100 XP 換 1 個碎片。4 個碎片合成 1 張補簽卡，可補上錯過的一天打卡。</p>
        <button class="btn btn-primary btn-l" id="enter-makeup">查看詳情</button>
      </div>
    `;
    body.querySelector('#enter-makeup')?.addEventListener('click', () => navigate('/tasks/makeup'));
  }

  function rerender() {
    if (segment === 'today') renderToday();
    else if (segment === '5r') render5R();
    else renderMakeup();
  }

  function refreshDayTag() {
    dayTag.textContent = 'D' + $today.get().dayNumber;
  }

  bind(wrap, $today, () => {
    refreshDayTag();
    rerender();
  });
  bind(wrap, $challenge, rerender);
  bind(wrap, $profile, rerender);

  // Hydrate today's check-ins so meal progress reflects what's already in
  // the DB on a cold reload (otherwise $today.missionsDone is empty).
  void (async () => {
    const u = $user.get();
    if (!u) return;
    try {
      const day = $today.get().dayNumber;
      serverCheckIns = await listCheckIns(u.id, day);
      if (segment === 'today') renderToday();
    } catch (err) {
      console.warn('[tasks] listCheckIns failed:', err);
    }
  })();

  return wrap;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;',
  );
}
