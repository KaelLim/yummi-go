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
import { t } from '@/lib/i18n';

export default function capture(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'checkin-screen checkin-capture';
  wrap.innerHTML = `
    <header class="checkin-header">
      <button class="checkin-back" id="back-btn" aria-label="${t('common.back')}">
        <span class="ms">arrow_back</span>
      </button>
      <span class="checkin-title">${t('checkin.captureTitle')}</span>
      <span class="checkin-meal" id="meal-tag"></span>
    </header>
    <div class="checkin-body">
      <div class="capture-frame" id="frame">
        <div class="capture-placeholder">
          <span class="ms capture-icon">photo_camera</span>
          <p class="capture-hint">${t('checkin.capturePlaceholder')}</p>
        </div>
        <img class="capture-preview" id="preview" hidden alt="${t('checkin.capturePreviewAlt')}" />
      </div>
      <input id="file" type="file" accept="image/*" capture="environment" hidden />
      <div class="capture-actions" id="actions">
        <button class="btn text-btn-m btn-primary btn-l text-btn-l" id="shutter">
          <span class="ms">photo_camera</span>
          ${t('checkin.startShoot')}
        </button>
      </div>
      <div class="capture-actions" id="confirm-actions" hidden>
        <button class="btn text-btn-m btn-secondary btn-l text-btn-l" id="retake">${t('checkin.retake')}</button>
        <button class="btn text-btn-m btn-primary btn-l text-btn-l" id="analyze">${t('checkin.analyze')}</button>
      </div>
    </div>
  `;

  resetCheckin();
  const idx = inferMealIndex();
  setMealIndex(idx);
  const mealLabel = idx === 1 ? t('checkin.meal1') : idx === 2 ? t('checkin.meal2') : t('checkin.meal3');
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
