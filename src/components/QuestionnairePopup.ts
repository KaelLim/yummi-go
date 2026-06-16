/**
 * Modal-style questionnaire popup driven by a Milestone — every
 * question in the milestone is rendered in the same card, with a
 * single submit at the bottom. Submit is enabled once every question
 * has a pick (so the user can't half-answer the session). Skipping
 * dismisses the whole milestone.
 *
 * Pure DOM — no framework. Owner is responsible for appending the
 * returned element to the document; resolution removes it.
 */
import { $locale, type Locale } from '@/lib/i18n';
import { bind } from '@/lib/lifecycle';
import {
  type Milestone,
  type Question,
  type QuestionOption,
  type StoredAnswer,
  recordMilestoneAnswers,
  markMilestoneDeferred,
} from '@/lib/questionnaires';

export interface QuestionnairePopupHandle {
  el: HTMLElement;
  /** Remove from DOM. */
  close: () => void;
}

export interface QuestionnairePopupOptions {
  milestone: Milestone;
  /** Called after the user submits or skips — popup auto-closes. */
  onResolved?: () => void;
}

const COPY = {
  submit: { zh: '送出', en: 'Submit' },
  skip:   { zh: '稍後再說', en: 'Maybe later' },
  freeTextPlaceholder: { zh: '請補充…', en: 'Tell us more…' },
  closeAria: { zh: '關閉', en: 'Close' },
};

function text(value: { zh: string; en: string }, locale: Locale): string {
  return locale === 'en' ? value.en : value.zh;
}

export function createQuestionnairePopup(
  opts: QuestionnairePopupOptions,
): QuestionnairePopupHandle {
  const { milestone, onResolved } = opts;
  const root = document.createElement('div');
  root.className = 'qn-shell';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');

  const card = document.createElement('div');
  card.className = 'qn-card';
  card.addEventListener('click', (e) => e.stopPropagation());
  root.append(card);

  card.innerHTML = `
    <header class="qn-head">
      <span class="qn-title" data-bind="title"></span>
      <button class="qn-close" type="button" data-action="close">
        <span class="ms">close</span>
      </button>
    </header>
    <div class="qn-questions" data-bind="questions"></div>
    <div class="qn-actions">
      <button class="btn btn-secondary btn-sm text-btn-m" type="button" data-action="skip" data-bind="skip-label"></button>
      <button class="btn btn-primary btn-sm text-btn-m" type="button" data-action="submit" data-bind="submit-label" disabled></button>
    </div>
  `;

  /** questionId → picked optionId (or null until the user picks). */
  const picks: Record<string, string | null> = Object.fromEntries(
    milestone.questions.map((q) => [q.id, null]),
  );
  /** questionId → free-text value (only meaningful when the picked option needsFreeText). */
  const freeText: Record<string, string> = {};

  function paint(locale: Locale): void {
    const q = (sel: string) => card.querySelector<HTMLElement>(sel);
    const titleEl = q('[data-bind="title"]');
    if (titleEl) titleEl.textContent = text(milestone.title, locale);
    const submitBtn = q('[data-bind="submit-label"]');
    if (submitBtn) submitBtn.textContent = text(COPY.submit, locale);
    const skipBtn = q('[data-bind="skip-label"]');
    if (skipBtn) skipBtn.textContent = text(COPY.skip, locale);
    const closeBtn = card.querySelector<HTMLButtonElement>('[data-action="close"]');
    if (closeBtn) closeBtn.setAttribute('aria-label', text(COPY.closeAria, locale));

    const questionsList = q('[data-bind="questions"]');
    if (questionsList) {
      questionsList.innerHTML = milestone.questions
        .map((qq) => renderQuestion(qq, locale))
        .join('');
      wireQuestionListeners(questionsList);
    }
    refreshSubmitState();
  }

  function renderQuestion(question: Question, locale: Locale): string {
    const selected = picks[question.id];
    const free = freeText[question.id] ?? '';
    const showFree = selected
      ? question.options.find((o) => o.id === selected)?.needsFreeText === true
      : false;
    return `
      <section class="qn-question-block" data-question-id="${question.id}">
        <span class="qn-question-label">${escapeHtml(text(question.label, locale))}</span>
        <p class="qn-question">${escapeHtml(text(question.prompt, locale))}</p>
        <ul class="qn-options">
          ${question.options.map((o) => renderOption(o, locale, o.id === selected)).join('')}
        </ul>
        <textarea
          class="qn-freetext input"
          data-question-id="${question.id}"
          rows="2"
          placeholder="${escapeAttr(text(COPY.freeTextPlaceholder, locale))}"
          ${showFree ? '' : 'hidden'}
        >${escapeHtml(free)}</textarea>
      </section>
    `;
  }

  function renderOption(o: QuestionOption, locale: Locale, selected: boolean): string {
    return `
      <li class="qn-option ${selected ? 'selected' : ''}" data-option-id="${o.id}">
        <span class="qn-radio" aria-hidden="true"></span>
        <span class="qn-option-label">${escapeHtml(text(o.label, locale))}</span>
      </li>
    `;
  }

  function wireQuestionListeners(container: HTMLElement): void {
    container.querySelectorAll<HTMLElement>('.qn-question-block').forEach((block) => {
      const qid = block.dataset.questionId!;
      block.querySelectorAll<HTMLLIElement>('.qn-option').forEach((li) => {
        li.addEventListener('click', () => pickOption(qid, li.dataset.optionId!));
      });
      const free = block.querySelector<HTMLTextAreaElement>('textarea.qn-freetext');
      if (free) {
        free.addEventListener('input', () => {
          freeText[qid] = free.value;
        });
      }
    });
  }

  function pickOption(questionId: string, optionId: string): void {
    picks[questionId] = optionId;
    const block = card.querySelector<HTMLElement>(`.qn-question-block[data-question-id="${questionId}"]`);
    if (!block) return;
    block.querySelectorAll<HTMLElement>('.qn-option').forEach((li) => {
      li.classList.toggle('selected', li.dataset.optionId === optionId);
    });
    const question = milestone.questions.find((q) => q.id === questionId);
    const free = block.querySelector<HTMLTextAreaElement>('textarea.qn-freetext');
    if (free && question) {
      const needsFree = question.options.find((o) => o.id === optionId)?.needsFreeText === true;
      free.hidden = !needsFree;
      if (!needsFree) {
        free.value = '';
        freeText[questionId] = '';
      }
    }
    refreshSubmitState();
  }

  function allAnswered(): boolean {
    return milestone.questions.every((q) => picks[q.id] !== null);
  }

  function refreshSubmitState(): void {
    const submitBtn = card.querySelector<HTMLButtonElement>('[data-action="submit"]');
    if (submitBtn) submitBtn.disabled = !allAnswered();
  }

  function resolveAndClose(): void {
    handle.close();
    onResolved?.();
  }

  card.querySelector<HTMLButtonElement>('[data-action="submit"]')?.addEventListener('click', () => {
    if (!allAnswered()) return;
    const answers: Record<string, StoredAnswer> = {};
    for (const q of milestone.questions) {
      const optionId = picks[q.id]!;
      const opt = q.options.find((o) => o.id === optionId);
      const ft = opt?.needsFreeText ? (freeText[q.id] ?? '').trim() : '';
      answers[q.id] = ft ? { optionId, freeText: ft } : { optionId };
    }
    recordMilestoneAnswers(milestone.id, answers);
    resolveAndClose();
  });
  card.querySelector<HTMLButtonElement>('[data-action="skip"]')?.addEventListener('click', () => {
    markMilestoneDeferred(milestone.id);
    resolveAndClose();
  });
  card.querySelector<HTMLButtonElement>('[data-action="close"]')?.addEventListener('click', () => {
    markMilestoneDeferred(milestone.id);
    resolveAndClose();
  });

  // First paint + locale subscription so the popup re-translates if
  // the user flips language while it's open (rare but harmless).
  paint($locale.get());
  bind(root, $locale, paint);

  const handle: QuestionnairePopupHandle = {
    el: root,
    close() {
      root.remove();
    },
  };
  return handle;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;',
  );
}

function escapeAttr(s: string): string {
  return escapeHtml(s);
}
