/**
 * Makeup-card wallet — fragments progress, card inventory, gem→card swap.
 *
 * Reads from $profile (populated by get_user_full RPC) for fast paint, but
 * after a swap we refresh $profile from the server so the next render
 * shows the new totals. The "用 100 寶石換 1 張補簽卡" button is disabled
 * when balance < 100; backend errors surface inline.
 */
import { navigate } from '@/router';
import { $user, $profile } from '@/store/user';
import { getUserFull } from '@/api/profile';
import { swapGemsForCard, GEMS_PER_CARD } from '@/api/wallet';
import { bind } from '@/lib/lifecycle';

export default function makeup(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'makeup-screen';
  wrap.innerHTML = `
    <header class="checkin-header">
      <button class="checkin-back" id="back-btn" aria-label="返回">
        <span class="ms">arrow_back</span>
      </button>
      <span class="checkin-title">補簽 / 寶石</span>
      <span></span>
    </header>
    <div class="makeup-screen-body">
      <section class="wallet-card">
        <div class="wallet-row">
          <span class="ms wallet-icon">diamond</span>
          <span class="wallet-label">寶石</span>
          <strong class="wallet-value" data-bind="gems">0</strong>
        </div>
        <div class="wallet-row">
          <span class="ms wallet-icon">style</span>
          <span class="wallet-label">補簽卡</span>
          <strong class="wallet-value" data-bind="cards">0</strong>
        </div>
        <div class="wallet-row">
          <span class="ms wallet-icon">extension</span>
          <span class="wallet-label">碎片</span>
          <strong class="wallet-value" data-bind="fragments">0</strong>
        </div>
        <div class="wallet-progress" id="frag-progress">
          <span class="bar"><span data-bind="frag-fill" style="width:0%"></span></span>
          <span class="muted" data-bind="frag-help">…</span>
        </div>
      </section>

      <section class="swap-card">
        <h2 class="swap-title">用寶石兌換補簽卡</h2>
        <p class="swap-help">每 ${GEMS_PER_CARD} 寶石換 1 張補簽卡，可補上錯過的一天打卡。</p>
        <div class="swap-error" id="error" hidden></div>
        <button class="btn btn-primary btn-l" id="swap-btn">
          <span class="ms">swap_horiz</span>
          用 ${GEMS_PER_CARD} 寶石換 1 張
        </button>
      </section>

      <section class="info-card">
        <h2 class="swap-title">碎片如何取得？</h2>
        <p class="swap-help">
          當天 XP 超過 100 後，每多 100 XP 換 1 個碎片。<br/>
          4 個碎片自動合成 1 張補簽卡。
        </p>
      </section>
    </div>
  `;

  const $$ = (sel: string) => wrap.querySelector<HTMLElement>(sel);
  const errorEl = $$('#error')!;
  const swapBtn = $$('#swap-btn') as HTMLButtonElement;

  function render() {
    const p = $profile.get();
    const gems = p?.gems ?? 0;
    const cards = p?.card_count ?? 0;
    const fragments = p?.fragment_count ?? 0;

    setText('[data-bind="gems"]', String(gems));
    setText('[data-bind="cards"]', String(cards));
    setText('[data-bind="fragments"]', String(fragments));

    const fragsInProgress = fragments % 4;
    const pctFill = (fragsInProgress / 4) * 100;
    const fragFill = $$('[data-bind="frag-fill"]');
    if (fragFill) fragFill.style.width = pctFill + '%';
    setText(
      '[data-bind="frag-help"]',
      fragsInProgress === 0
        ? '尚未開始合成下一張'
        : `還差 ${4 - fragsInProgress} 個碎片可合成下一張`,
    );

    swapBtn.disabled = gems < GEMS_PER_CARD;
    swapBtn.textContent = '';
    swapBtn.innerHTML = `<span class="ms">swap_horiz</span>用 ${GEMS_PER_CARD} 寶石換 1 張`;
  }

  function setText(sel: string, value: string) {
    const el = wrap.querySelector(sel);
    if (el) el.textContent = value;
  }

  wrap.querySelector('#back-btn')?.addEventListener('click', () => navigate('/tasks'));

  swapBtn.addEventListener('click', () => {
    void doSwap();
  });

  async function doSwap(): Promise<void> {
    errorEl.hidden = true;
    const u = $user.get();
    if (!u) {
      navigate('/login');
      return;
    }
    swapBtn.disabled = true;
    swapBtn.textContent = '兌換中…';
    try {
      await swapGemsForCard(u.id);
      const refreshed = await getUserFull(u.id);
      if (refreshed) $profile.set(refreshed);
    } catch (err) {
      errorEl.hidden = false;
      errorEl.textContent = (err as Error).message ?? '兌換失敗';
    } finally {
      render();
    }
  }

  bind(wrap, $profile, render);

  return wrap;
}
