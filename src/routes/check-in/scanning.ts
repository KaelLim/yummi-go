/**
 * Check-in step 2 — mock AI scanning, prototype dev picker.
 *
 * Animated shimmer + grid-overlay over the captured image runs for ~2s.
 * Instead of resolving randomly, we surface two dev choices so the
 * developer/demo viewer can see both flows on demand:
 *
 *   🌱 演示：無肉流程 → mockScan({ forceMeat: false })  → /check-in/result
 *                                                       (auto-submit → success)
 *   🥩 演示：有肉流程 → mockScan({ forceMeat: true })   → /check-in/result
 *                                                       (banner with detected meat)
 *
 * Falls back to /check-in if there's no captured image.
 */
import { navigate } from '@/router';
import { mockScan } from '@/lib/mock-ai';
import { $checkin, setScan } from '@/store/checkin';
import { t } from '@/lib/i18n';

export default function scanning(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'checkin-screen checkin-scan';
  const draft = $checkin.get();
  if (!draft.imageDataUrl) {
    wrap.innerHTML = `
      <div class="checkin-body checkin-fallback">
        <p>${t('checkin.scanFallback')}</p>
        <button class="btn text-btn-m btn-primary btn-l text-btn-l" id="back">${t('checkin.fallbackBack')}</button>
      </div>
    `;
    wrap.querySelector('#back')?.addEventListener('click', () => navigate('/check-in'));
    return wrap;
  }

  wrap.innerHTML = `
    <div class="checkin-body">
      <div class="scan-frame">
        <img class="scan-image" src="${draft.imageDataUrl}" alt="${t('checkin.scanAlt')}" />
        <div class="scan-grid"></div>
        <div class="scan-line"></div>
        <div class="scan-status" id="scan-status">
          <span class="ms scan-status-icon">auto_awesome</span>
          <span>${t('checkin.scanStatus')}</span>
        </div>
      </div>
      <div class="scan-dev" id="scan-dev">
        <div class="scan-dev-head">
          <span class="ms">science</span>
          <span>${t('checkin.scanDevHead')}</span>
        </div>
        <div class="scan-dev-actions">
          <button class="btn text-btn-m btn-secondary btn-l text-btn-l" id="scan-veg">
            ${t('checkin.scanDevVeg')}
          </button>
          <button class="btn text-btn-m btn-primary btn-l text-btn-l" id="scan-meat">
            ${t('checkin.scanDevMeat')}
          </button>
        </div>
        <p class="scan-dev-hint">${t('checkin.scanDevHint')}</p>
      </div>
    </div>
  `;

  function pick(forceMeat: boolean): void {
    const r = mockScan({ forceMeat, failRate: 0 });
    setScan(r);
    navigate('/check-in/result');
  }

  wrap.querySelector('#scan-veg')?.addEventListener('click', () => pick(false));
  wrap.querySelector('#scan-meat')?.addEventListener('click', () => pick(true));

  return wrap;
}
