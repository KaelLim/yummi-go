/**
 * Level-3 interstitial — "守護者圖鑑".
 *
 * Sits between challenge-level (when value === 3 is picked) and the next
 * post-first-checkin step (eat-times or /home, depending on whether
 * eat_times is already set).
 *
 * Pure visual tease — no collection table or unlock flag is written to
 * drust. The 6 silhouetted cards are placeholders for a future pet-
 * variants feature; the copy is a generic hint that more guardians wait
 * after the user's current pet evolves, not a level-3-only reward.
 */
import { navigate } from '@/router';
import { $profile } from '@/store/user';

export default function level3Unlock(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'onb-screen level3-unlock';

  wrap.innerHTML = `
    <div class="onb-body">
      <div class="unlock-celebration">
        <span class="ms unlock-trophy">emoji_events</span>
        <h1 class="unlock-title">守護者圖鑑</h1>
        <p class="unlock-sub">完成這次進化後，還有更多守護者等你發現</p>
      </div>
      <div class="unlock-grid">
        ${Array.from({ length: 6 })
          .map(
            () => `
              <div class="unlock-card">
                <span class="unlock-silhouette">❓</span>
                <span class="unlock-label">???</span>
              </div>
            `,
          )
          .join('')}
      </div>
      <p class="unlock-hint">完成挑戰後解鎖更多守護者外觀</p>
      <button class="btn text-btn-m btn-primary btn-l text-btn-l" id="continue-btn">繼續</button>
    </div>
  `;

  wrap.querySelector('#continue-btn')?.addEventListener('click', () => {
    // Mirror challenge-level's tail logic: eat-times if not yet set,
    // otherwise straight to /home.
    const eatTimes = $profile.get()?.eat_times;
    navigate(eatTimes ? '/home' : '/onboarding/eat-times');
  });

  return wrap;
}
