/**
 * Check-in step 2 — mock AI scanning.
 *
 * Animated shimmer + grid-overlay over the captured image. After ~2 seconds
 * mockScan() fabricates 3-6 ingredients (with a small chance of meat or a
 * scan-fail). On success we stash the result in $checkin and route to
 * /check-in/result. On failure we surface a retry CTA.
 *
 * Falls back to /check-in (capture) if the user landed here without an
 * image — most common cause is a hard refresh that wiped the transient
 * store.
 */
import { navigate } from '@/router';
import { mockScan } from '@/lib/mock-ai';
import { $checkin, setScan } from '@/store/checkin';
import { onUnmount } from '@/lib/lifecycle';

const SCAN_MS = 2000;

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
      <p class="scan-meta">辨識食材與營養素，估計需要 2 秒</p>
    </div>
  `;

  const id = window.setTimeout(() => {
    const result = mockScan();
    if (result.scanFailed) {
      const status = wrap.querySelector<HTMLElement>('#scan-status');
      if (status) {
        status.innerHTML = '<span class="ms">error</span><span>辨識失敗，請重試</span>';
      }
      const retry = document.createElement('button');
      retry.className = 'btn text-btn-m btn-primary btn-l text-btn-l';
      retry.textContent = '重新拍照';
      retry.addEventListener('click', () => navigate('/check-in'));
      wrap.querySelector('.checkin-body')?.appendChild(retry);
      return;
    }
    setScan(result);
    navigate('/check-in/result');
  }, SCAN_MS);

  onUnmount(wrap, () => window.clearTimeout(id));

  return wrap;
}
