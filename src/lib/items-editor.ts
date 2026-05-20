/**
 * Shared items-editor sheet — opens a bottom-sheet form for tweaking
 * AI-scanned food items (name + weight per row). Used by the
 * review/verify success cards so their 修改內容 button maps to the same
 * widget the user already knows from /check-in/success.
 *
 * The editor manages its own working copy and only commits via `onSave`
 * so a cancelled edit leaves the caller's state untouched. Save also
 * recomputes the nutrition totals so the caller can re-render the
 * nutrition card without aggregating itself.
 *
 * NOTE: This deliberately reuses the existing `.edit-sheet` CSS already
 * shipped for /check-in/success. /check-in/success still has its own
 * inline implementation tied to `$checkin.lastResult`; promoting it
 * here is a future refactor.
 */
import type { MockFood } from './mock-ai';

export interface NutritionTotals {
  cal: number; protein: number; carb: number; fat: number; fiber: number;
}

export interface ItemsEditorArgs {
  /** Element to append the sheet onto (typically the route's root). */
  host: HTMLElement;
  initial: MockFood[];
  onSave: (items: MockFood[], nutrition: NutritionTotals) => void | Promise<void>;
}

export function aggregateNutrition(items: MockFood[]): NutritionTotals {
  const acc: NutritionTotals = { cal: 0, protein: 0, carb: 0, fat: 0, fiber: 0 };
  for (const it of items) {
    const m = it.weightG / 100;
    acc.cal += it.cal * m;
    acc.protein += it.protein * m;
    acc.carb += it.carb * m;
    acc.fat += it.fat * m;
    acc.fiber += it.fiber * m;
  }
  for (const k of Object.keys(acc) as Array<keyof NutritionTotals>) {
    acc[k] = Math.round(acc[k] * 10) / 10;
  }
  return acc;
}

export function openItemsEditor({ host, initial, onSave }: ItemsEditorArgs): void {
  const sheet = document.createElement('div');
  sheet.className = 'edit-sheet';
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');
  sheet.innerHTML = `
    <div class="edit-sheet-card">
      <h2 class="edit-sheet-title text-h3">修改本餐內容</h2>
      <p class="edit-sheet-sub text-mini">調整 AI 辨識的食材與份量（不會影響已發放的 XP）</p>
      <div class="edit-sheet-list" id="ie-list"></div>
      <button type="button" class="edit-sheet-add" id="ie-add">
        <span class="ms">add</span>新增食材
      </button>
      <p class="edit-sheet-error" id="ie-error" hidden></p>
      <div class="edit-sheet-actions">
        <button type="button" class="btn text-btn-m btn-secondary btn-l text-btn-l" id="ie-cancel">取消</button>
        <button type="button" class="btn text-btn-m btn-primary btn-l text-btn-l" id="ie-save">儲存</button>
      </div>
    </div>
  `;

  let working: MockFood[] = initial.map((it) => ({ ...it }));

  const list = sheet.querySelector<HTMLElement>('#ie-list')!;
  const errorEl = sheet.querySelector<HTMLElement>('#ie-error')!;
  const addBtn = sheet.querySelector<HTMLButtonElement>('#ie-add')!;
  const cancelBtn = sheet.querySelector<HTMLButtonElement>('#ie-cancel')!;
  const saveBtn = sheet.querySelector<HTMLButtonElement>('#ie-save')!;

  function renderList(): void {
    list.innerHTML = working
      .map(
        (it, i) => `
        <div class="edit-row" data-index="${i}">
          <input class="input edit-row-name" type="text" maxlength="24" value="${escapeHtml(it.name)}" placeholder="食材名稱" />
          <input class="input edit-row-weight" type="number" min="0" step="10" value="${it.weightG}" inputmode="numeric" />
          <span class="edit-row-unit text-mini">g</span>
          <button type="button" class="edit-row-remove" aria-label="移除"><span class="ms">close</span></button>
        </div>
      `,
      )
      .join('');
    list.querySelectorAll<HTMLInputElement>('.edit-row-name').forEach((el, i) => {
      el.addEventListener('input', () => { working[i] = { ...working[i], name: el.value }; });
    });
    list.querySelectorAll<HTMLInputElement>('.edit-row-weight').forEach((el, i) => {
      el.addEventListener('input', () => {
        const w = Math.max(0, Number(el.value) || 0);
        working[i] = { ...working[i], weightG: w };
      });
    });
    list.querySelectorAll<HTMLButtonElement>('.edit-row-remove').forEach((el, i) => {
      el.addEventListener('click', () => {
        working.splice(i, 1);
        renderList();
      });
    });
  }

  function close(): void { sheet.remove(); }

  function showError(msg: string): void {
    errorEl.hidden = false;
    errorEl.textContent = msg;
  }

  addBtn.addEventListener('click', () => {
    working.push({
      name: '',
      cal: 50,
      protein: 2,
      carb: 8,
      fat: 1,
      fiber: 1,
      isVeg: true,
      colors: ['green'],
      weightG: 100,
    });
    renderList();
  });

  cancelBtn.addEventListener('click', close);

  saveBtn.addEventListener('click', () => {
    void doSave();
  });

  async function doSave(): Promise<void> {
    errorEl.hidden = true;
    const cleaned = working
      .map((it) => ({ ...it, name: it.name.trim() }))
      .filter((it) => it.name.length > 0);
    if (cleaned.length === 0) {
      showError('至少保留一項食材');
      return;
    }
    saveBtn.disabled = true;
    saveBtn.textContent = '儲存中…';
    try {
      const nutrition = aggregateNutrition(cleaned);
      await onSave(cleaned, nutrition);
      close();
    } catch (err) {
      console.error('[items-editor] save failed:', err);
      showError((err as Error).message ?? '儲存失敗');
      saveBtn.disabled = false;
      saveBtn.textContent = '儲存';
    }
  }

  renderList();
  host.appendChild(sheet);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;',
  );
}
