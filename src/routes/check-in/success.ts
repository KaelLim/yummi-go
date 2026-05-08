/**
 * Check-in step 4 — celebration screen.
 *
 * XP burst (a column of floating "+N XP" labels staggered into view) plus a
 * fog-reduction line copied from the day's challenge_scripts. Tapping
 * Continue resets the transient $checkin draft and routes back to /home.
 */
import { navigate } from '@/router';
import { $checkin, resetCheckin } from '@/store/checkin';

export default function success(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'checkin-screen checkin-success';
  const r = $checkin.get().lastResult;
  if (!r) {
    wrap.innerHTML = `
      <div class="checkin-body checkin-fallback">
        <p>沒有可顯示的打卡結果。</p>
        <button class="btn btn-primary btn-l" id="back">回首頁</button>
      </div>
    `;
    wrap.querySelector('#back')?.addEventListener('click', () => navigate('/home'));
    return wrap;
  }

  const replaced = $checkin.get().wasMeatReplaced;

  wrap.innerHTML = `
    <div class="success-body">
      <div class="xp-burst" aria-hidden="true">
        <span class="xp-bubble xp-1">+${r.xpEarned} XP</span>
        ${r.luckyColorMatched ? '<span class="xp-bubble xp-2">幸運色！</span>' : ''}
        ${replaced ? '<span class="xp-bubble xp-3">替代為植物肉</span>' : ''}
      </div>
      <div class="success-pet">🐸</div>
      <h1 class="success-title">打卡成功！</h1>
      <p class="success-text">
        守護者吸收了 <strong>${r.xpEarned} XP</strong> 的真實能量。<br/>
        灰霧消散 <strong>${r.fogReductionPct}%</strong>。
      </p>
      <button class="btn btn-primary btn-l" id="next">繼續守護</button>
    </div>
  `;

  wrap.querySelector('#next')?.addEventListener('click', () => {
    resetCheckin();
    navigate('/home');
  });

  return wrap;
}
