/**
 * Check-in step 1 — capture (or pick) a meal photo.
 *
 * Uses an `<input type="file" accept="image/*" capture="environment">` which
 * opens the device camera on mobile (or the file picker on desktop). The
 * raw file is converted to a data-URL preview and stashed in $checkin so
 * the next screen can decide what to do with it.
 *
 * No live getUserMedia viewfinder — prototype-grade. The mock scanner
 * fabricates ingredients regardless of the actual image bytes.
 */
import { navigate } from '@/router';
import { resetCheckin, setCapture, setMealIndex, inferMealIndex } from '@/store/checkin';

export default function capture(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'checkin-screen checkin-capture';
  wrap.innerHTML = `
    <header class="checkin-header">
      <button class="checkin-back" id="back-btn" aria-label="返回">
        <span class="ms">arrow_back</span>
      </button>
      <span class="checkin-title">拍照打卡</span>
      <span class="checkin-meal" id="meal-tag"></span>
    </header>
    <div class="checkin-body">
      <div class="capture-frame" id="frame">
        <div class="capture-placeholder">
          <span class="ms capture-icon">photo_camera</span>
          <p class="capture-hint">拍下今天的這一餐<br/>食物精靈會幫你辨識</p>
        </div>
        <img class="capture-preview" id="preview" hidden alt="餐點預覽" />
      </div>
      <input id="file" type="file" accept="image/*" capture="environment" hidden />
      <div class="capture-actions" id="actions">
        <button class="btn btn-primary btn-l" id="shutter">
          <span class="ms">photo_camera</span>
          開始拍照
        </button>
      </div>
      <div class="capture-actions" id="confirm-actions" hidden>
        <button class="btn btn-secondary btn-l" id="retake">重新拍</button>
        <button class="btn btn-primary btn-l" id="analyze">進行分析</button>
      </div>
    </div>
  `;

  resetCheckin();
  const idx = inferMealIndex();
  setMealIndex(idx);
  const mealLabel = idx === 1 ? '早餐' : idx === 2 ? '午餐' : '晚餐';
  (wrap.querySelector('#meal-tag') as HTMLElement).textContent = mealLabel;

  const fileInput = wrap.querySelector<HTMLInputElement>('#file')!;
  const preview = wrap.querySelector<HTMLImageElement>('#preview')!;
  const placeholder = wrap.querySelector<HTMLElement>('.capture-placeholder')!;
  const initialActions = wrap.querySelector<HTMLElement>('#actions')!;
  const confirmActions = wrap.querySelector<HTMLElement>('#confirm-actions')!;

  function showPreview(dataUrl: string) {
    preview.src = dataUrl;
    preview.hidden = false;
    placeholder.style.display = 'none';
    initialActions.hidden = true;
    confirmActions.hidden = false;
    setCapture(dataUrl);
  }

  function reset() {
    preview.hidden = true;
    placeholder.style.display = '';
    initialActions.hidden = false;
    confirmActions.hidden = true;
    setCapture(null);
    fileInput.value = '';
  }

  wrap.querySelector('#back-btn')?.addEventListener('click', () => navigate('/home'));
  wrap.querySelector('#shutter')?.addEventListener('click', () => fileInput.click());
  wrap.querySelector('#retake')?.addEventListener('click', reset);
  wrap.querySelector('#analyze')?.addEventListener('click', () => navigate('/check-in/scanning'));

  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => showPreview(String(reader.result ?? ''));
    reader.readAsDataURL(file);
  });

  return wrap;
}
