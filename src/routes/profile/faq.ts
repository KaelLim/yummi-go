/**
 * /profile/faq — frequently-asked questions page.
 *
 * Five accordion-style Q&A rows + a contact-us footer. The accordion
 * uses <details>/<summary> so it's accessible and works without JS.
 * Each Q&A pair comes from i18n keys faq.qN / faq.aN.
 */
import { navigate } from '@/router';
import { $locale, t } from '@/lib/i18n';
import { bind } from '@/lib/lifecycle';

const QUESTIONS = [1, 2, 3, 4, 5, 6] as const;

export default function faq(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'static-page-screen';

  function paint(): void {
    const items = QUESTIONS.map((n) => `
      <details class="faq-item">
        <summary class="faq-question">
          <span class="faq-question-text">${t(`faq.q${n}`)}</span>
          <span class="ms faq-chevron">expand_more</span>
        </summary>
        <p class="faq-answer">${t(`faq.a${n}`)}</p>
      </details>
    `).join('');

    wrap.innerHTML = `
      <header class="checkin-header">
        <button class="checkin-back" id="back-btn" aria-label="${t('common.back')}">
          <span class="ms">arrow_back</span>
        </button>
        <span class="checkin-title">${t('faq.title')}</span>
        <span></span>
      </header>
      <div class="static-page-body">
        <div class="faq-list">${items}</div>
        <p class="static-page-contact">${t('faq.contact')}</p>
      </div>
    `;
    wrap.querySelector('#back-btn')?.addEventListener('click', () => navigate('/profile'));
  }

  paint();
  bind(wrap, $locale, paint);
  return wrap;
}
