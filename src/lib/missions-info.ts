/**
 * Missions-detail info modal — opens from the ⓘ icon next to 「今日任務」.
 *
 * Same visual family as `openVeganTierInfo` (centred card, click-outside
 * to dismiss, ✕ close button). Lists each daily mission with a short
 * description of how to complete it. Descriptions live in lib/i18n
 * under `mission.detail.*` so they translate.
 */
import { t } from './i18n';

interface MissionDetail {
  emoji: string;
  descKey: string;
}

const DETAILS: MissionDetail[] = [
  { emoji: '🍽️', descKey: 'mission.detail.meal' },
  { emoji: '🏅', descKey: 'mission.detail.allMeals' },
  { emoji: '🧪', descKey: 'mission.detail.quiz' },
  { emoji: '🍀', descKey: 'mission.detail.lucky' },
  { emoji: '🌱', descKey: 'mission.detail.r' },
];

export function openMissionsInfo(host: HTMLElement): void {
  const existing = host.querySelector('.vegan-info-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'vegan-info-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.innerHTML = `
    <div class="vegan-info-card">
      <header class="vegan-info-header">
        <h2 class="vegan-info-title">${t('home.missionsInfo')}</h2>
        <button class="vegan-info-close" type="button" aria-label="${t('common.close')}">
          <span class="ms">close</span>
        </button>
      </header>
      <ul class="vegan-info-list">
        ${DETAILS.map((d) => `
          <li class="vegan-info-row mission-info-row">
            <span class="mission-info-emoji" aria-hidden="true">${d.emoji}</span>
            <span class="vegan-info-desc">${t(d.descKey)}</span>
          </li>
        `).join('')}
      </ul>
    </div>
  `;

  const close = () => overlay.remove();
  overlay.querySelector('.vegan-info-close')?.addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  host.appendChild(overlay);
}
