/**
 * Check-in step 4 — celebration + wallet action.
 *
 * Sequenced acts (CSS-driven):
 *   ACT 1 (0–1000ms): +XP burst floats up from the pet
 *   ACT 2 (1000–2000ms): 30-day progress fills up to today
 *   ACT 3 (2000–3000ms): wallet/pet panel slides in
 *
 * Tap anywhere on the body before ACT 3 settles → jump to settled state.
 *
 * Earned XP no longer feeds the pet directly. It lands in xp_balances
 * and the user chooses what to do with it from this screen:
 *   - 餵小綠 +K XP — transfer K = min(balance, 100 - fed_today) into pet_states
 *   - 換寶石 +K   — when fed_today >= 100, dump the wallet at 1 XP = 1 Gem
 * Continue + Share remain available throughout.
 */
import { navigate } from '@/router';
import { $checkin, resetCheckin } from '@/store/checkin';
import { $today } from '@/store/today';
import { $user } from '@/store/user';
import { reloadWallet } from '@/store/pet';
import {
  PET_DAILY_XP_CAP,
  getXpBalance,
  getOrBootstrapXpBalance,
  feedPet,
  convertXpToGems,
  type XpBalance,
} from '@/api/xp-wallet';

const MEAL_LABEL: Record<number, string> = { 1: '早餐', 2: '午餐', 3: '晚餐' };

export default function success(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'checkin-screen checkin-success act-1';
  const r = $checkin.get().lastResult;
  if (!r) {
    wrap.innerHTML = `
      <div class="checkin-body checkin-fallback">
        <p>沒有可顯示的打卡結果。</p>
        <button class="btn text-btn-m btn-primary btn-l text-btn-l" id="back">回首頁</button>
      </div>
    `;
    wrap.querySelector('#back')?.addEventListener('click', () => navigate('/home'));
    return wrap;
  }

  const replaced = $checkin.get().wasMeatReplaced;
  const today = $today.get().dayNumber;
  const segments = Array.from({ length: 30 }, (_, i) => i + 1)
    .map((d) => `<span class="seg ${d <= today ? 'fill' : ''} ${d === today ? 'now' : ''}"></span>`)
    .join('');

  wrap.innerHTML = `
    <div class="success-body">
      <div class="xp-burst" aria-hidden="true">
        <span class="xp-bubble xp-1">+${r.xpEarned} XP</span>
        ${r.luckyColorMatched ? '<span class="xp-bubble xp-2">幸運色 +15 XP</span>' : ''}
        ${replaced ? '<span class="xp-bubble xp-3">替代為植物肉</span>' : ''}
      </div>
      <div class="success-progress" aria-label="30-day progress">${segments}</div>
      <div class="success-pet">🐸</div>
      <h1 class="success-title">打卡成功！</h1>
      <p class="success-text">
        <strong>${r.xpEarned} XP</strong> 已存入小綠的食物袋。<br/>
        灰霧消散 <strong>${r.fogReductionPct}%</strong>。
      </p>
      <div class="wallet-panel" id="wallet-panel" hidden>
        <div class="wallet-meter">
          <div class="wallet-meter-label">
            <span>今日餵食</span>
            <span><strong id="fed-today">0</strong> / ${PET_DAILY_XP_CAP} XP</span>
          </div>
          <div class="wallet-meter-bar"><div class="wallet-meter-fill" id="fed-fill"></div></div>
        </div>
        <p class="wallet-balance">食物袋餘額：<strong id="wallet-balance">0</strong> XP</p>
        <button class="btn text-btn-m btn-primary btn-l text-btn-l" id="wallet-action" hidden></button>
        <p class="wallet-hint" id="wallet-hint" hidden></p>
      </div>
      <div class="success-actions">
        <button class="btn text-btn-m btn-secondary btn-l text-btn-l" id="share">
          <span class="ms">share</span>分享成果
        </button>
        <button class="btn text-btn-m btn-primary btn-l text-btn-l" id="next">繼續守護</button>
      </div>
    </div>
  `;

  const acts = [
    { ms: 1000, cls: 'act-2' },
    { ms: 2000, cls: 'act-3' },
    { ms: 3000, cls: 'settled' },
  ];
  const timers: number[] = [];
  for (const { ms, cls } of acts) {
    timers.push(window.setTimeout(() => {
      wrap.classList.remove('act-1', 'act-2', 'act-3');
      wrap.classList.add(cls);
    }, ms));
  }

  function settle() {
    timers.forEach(window.clearTimeout);
    wrap.classList.remove('act-1', 'act-2', 'act-3');
    wrap.classList.add('settled');
  }
  wrap.querySelector('.success-body')?.addEventListener('click', settle, { once: true });

  // Wallet panel hydrates from drust once the user is known.
  void hydrateWallet(wrap);

  wrap.querySelector('#next')?.addEventListener('click', () => {
    timers.forEach(window.clearTimeout);
    resetCheckin();
    navigate('/home');
  });

  wrap.querySelector('#share')?.addEventListener('click', () => {
    void shareSummary(today, r.xpEarned, r.luckyColorMatched);
  });

  return wrap;
}

async function hydrateWallet(wrap: HTMLElement): Promise<void> {
  const u = $user.get();
  if (!u) return;
  try {
    const row = await getOrBootstrapXpBalance(u.id);
    renderWallet(wrap, row);
    // Mirror the latest balance into $gems so the home header is
    // already correct by the time the user backs out of this screen.
    void reloadWallet(u.id);
  } catch (err) {
    console.warn('[success] wallet hydrate failed:', err);
  }
}

function renderWallet(wrap: HTMLElement, row: XpBalance): void {
  const panel = wrap.querySelector<HTMLElement>('#wallet-panel');
  const fedNum = wrap.querySelector<HTMLElement>('#fed-today');
  const fedFill = wrap.querySelector<HTMLElement>('#fed-fill');
  const balanceEl = wrap.querySelector<HTMLElement>('#wallet-balance');
  const actionBtn = wrap.querySelector<HTMLButtonElement>('#wallet-action');
  const hint = wrap.querySelector<HTMLElement>('#wallet-hint');
  if (!panel || !fedNum || !fedFill || !balanceEl || !actionBtn || !hint) return;

  panel.hidden = false;
  fedNum.textContent = String(row.fed_today);
  fedFill.style.width = `${Math.min(100, (row.fed_today / PET_DAILY_XP_CAP) * 100)}%`;
  balanceEl.textContent = String(row.balance);

  if (row.balance <= 0) {
    actionBtn.hidden = true;
    hint.hidden = false;
    hint.textContent =
      row.fed_today >= PET_DAILY_XP_CAP
        ? '今天小綠已經吃飽了，明天再來！'
        : '食物袋空空 — 再去打卡或答題賺 XP 吧。';
    return;
  }

  const capRemaining = Math.max(0, PET_DAILY_XP_CAP - row.fed_today);
  if (capRemaining > 0) {
    const willFeed = Math.min(row.balance, capRemaining);
    actionBtn.hidden = false;
    actionBtn.textContent = `🌱 餵小綠 +${willFeed} XP`;
    actionBtn.dataset.action = 'feed';
    hint.hidden = true;
  } else {
    // Cap reached today — offer to convert remainder to gems.
    actionBtn.hidden = false;
    actionBtn.textContent = `💎 換寶石 +${row.balance}`;
    actionBtn.dataset.action = 'convert';
    hint.hidden = false;
    hint.textContent = '今日已餵滿 100 XP — 多的可以換成寶石。';
  }

  actionBtn.onclick = async () => {
    const u = $user.get();
    if (!u) return;
    actionBtn.disabled = true;
    const action = actionBtn.dataset.action;
    try {
      if (action === 'feed') {
        await feedPet(u.id);
      } else if (action === 'convert') {
        await convertXpToGems(u.id);
      }
      const fresh = await getXpBalance(u.id);
      if (fresh) renderWallet(wrap, fresh);
      // Push the new wallet/gem totals into $gems so the home header
      // already reflects the change before this screen unmounts.
      void reloadWallet(u.id);
    } catch (err) {
      console.error('[success] wallet action failed:', err);
    } finally {
      actionBtn.disabled = false;
    }
  };
}

async function shareSummary(day: number, xp: number, lucky: boolean): Promise<void> {
  const meal = MEAL_LABEL[$checkin.get().mealIndex] ?? '一餐';
  const text = `我在 Yummi Go 完成第 D${day} 天 ${meal} +${xp} XP${lucky ? ' 🍀' : ''}`;
  try {
    if (navigator.share) {
      await navigator.share({ title: 'Yummi Go', text });
      return;
    }
  } catch {
    /* user cancel — fall through */
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
