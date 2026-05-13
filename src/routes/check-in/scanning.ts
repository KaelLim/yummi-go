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

export default function scanning(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'checkin-screen checkin-scan';
  const draft = $checkin.get();
  if (!draft.imageDataUrl) {
    wrap.innerHTML = `
      <div class="checkin-body checkin-fallback">
        <p>請先拍下一張餐點照片。</p>
        <button class="btn text-btn-m btn-primary btn-l text-btn-l" id="back">回到拍照</button>
      </div>
    `;
    wrap.querySelector('#back')?.addEventListener('click', () => navigate('/check-in'));
    return wrap;
  }

  wrap.innerHTML = `
    <div class="checkin-body">
      <div class="scan-frame">
        <img class="scan-image" src="${draft.imageDataUrl}" alt="掃描中" />
        <div class="scan-grid"></div>
        <div class="scan-line"></div>
        <div class="scan-status" id="scan-status">
          <span class="ms scan-status-icon">auto_awesome</span>
          <span>食物精靈分析中…</span>
        </div>
      </div>
      <div class="scan-dev" id="scan-dev">
        <div class="scan-dev-head">
          <span class="ms">science</span>
          <span>Prototype — 演示兩種流程</span>
        </div>
        <div class="scan-dev-actions">
          <button class="btn text-btn-m btn-secondary btn-l text-btn-l" id="scan-veg">
            🌱 無肉流程
          </button>
          <button class="btn text-btn-m btn-primary btn-l text-btn-l" id="scan-meat">
            🥩 有肉流程
          </button>
        </div>
        <p class="scan-dev-hint">真實 AI 接上後，這個選擇器會自動拿掉。</p>
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
