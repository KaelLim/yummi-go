/**
 * /profile/about — About-us static content page.
 *
 * Three sections (what we do / who we are / contact) + version
 * footer. Static i18n strings; nothing dynamic. Header reuses the
 * shared checkin-header pattern for the back arrow.
 */
import { navigate } from '@/router';
import { $locale, t } from '@/lib/i18n';
import { bind } from '@/lib/lifecycle';

export default function about(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'static-page-screen';

  function paint(): void {
    wrap.innerHTML = `
      <header class="checkin-header">
        <button class="checkin-back" id="back-btn" aria-label="${t('common.back')}">
          <span class="ms">arrow_back</span>
        </button>
        <span class="checkin-title">${t('about.title')}</span>
        <span></span>
      </header>
      <div class="static-page-body">
        <p class="static-page-tagline">${t('about.tagline')}</p>

        <section class="static-page-section">
          <h2 class="static-page-h">${t('about.section1.title')}</h2>
          <p class="static-page-p">${t('about.section1.body')}</p>
        </section>

        <section class="static-page-section">
          <h2 class="static-page-h">${t('about.section2.title')}</h2>
          <p class="static-page-p">${t('about.section2.body')}</p>
        </section>

        <section class="static-page-section">
          <h2 class="static-page-h">${t('about.section3.title')}</h2>
          <p class="static-page-p">${t('about.section3.body')}</p>
        </section>

        <p class="static-page-version">${t('about.version').replace('{ver}', __APP_VERSION__)}</p>
      </div>
    `;
    wrap.querySelector('#back-btn')?.addEventListener('click', () => navigate('/profile'));
  }

  paint();
  bind(wrap, $locale, paint);
  return wrap;
}
