/**
 * 守護者典藏冊 — one card per completed guardian.
 *
 * A pet only lands here once it has reached LV30. The card shows its
 * adult-form portrait, its custom name (the user-chosen one from
 * onboarding), the species tag, and the date completed. Two
 * separately-named frogs appear as two separate cards.
 *
 * Phase 2 (merging two same-species cards) is intentionally not
 * surfaced yet — when it ships it will live alongside this list as a
 * sibling action, not a transform of these cards.
 */
import { navigate } from '@/router';
import {
  listCompletedPets,
  SPECIES_EMOJI,
  type CompletedPet,
  type PetSpecies,
} from '@/lib/pet-collection';
import { spriteFor } from '@/lib/pet-sprites';
import { t, $locale } from '@/lib/i18n';
import { bind } from '@/lib/lifecycle';

/** Sprite artwork only exists for the frog right now; other species
 *  fall back to an emoji placeholder so the layout still reads as a
 *  proper card grid. */
function portraitHtml(species: PetSpecies, name: string): string {
  if (species === 'frog') {
    return `<img class="collection-sprite" src="${spriteFor('adult', 'happy')}" alt="${escapeAttr(name)}" draggable="false" />`;
  }
  return `<span class="collection-emoji" aria-hidden="true">${SPECIES_EMOJI[species]}</span>`;
}

function renderCard(pet: CompletedPet): string {
  const mealsLabel = t('collection.mealsFmt').replace('{n}', String(pet.mealsLogged));
  return `
    <article class="collection-card" data-pet-id="${escapeAttr(pet.id)}">
      <div class="collection-portrait">${portraitHtml(pet.species, pet.name)}</div>
      <div class="collection-card-body">
        <h2 class="collection-pet-name">${escapeHtml(pet.name)}</h2>
        <span class="collection-meals">${escapeHtml(mealsLabel)}</span>
      </div>
    </article>
  `;
}

function renderEmpty(): string {
  return `
    <div class="collection-empty">
      <span class="ms collection-empty-icon">menu_book</span>
      <h2 class="collection-empty-title">${escapeHtml(t('collection.emptyTitle'))}</h2>
      <p class="collection-empty-body">${escapeHtml(t('collection.emptyBody'))}</p>
    </div>
  `;
}

export default function petCollection(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'collection-screen';
  wrap.innerHTML = `
    <header class="checkin-header">
      <button class="checkin-back" id="back-btn" aria-label="${t('common.back')}">
        <span class="ms">arrow_back</span>
      </button>
      <span class="checkin-title" data-bind="title">${t('collection.title')}</span>
      <span></span>
    </header>
    <div class="checkin-body">
      <p class="collection-sub" data-bind="sub">—</p>
      <p class="collection-hint" data-bind="hint">${t('collection.howHint')}</p>
      <section class="collection-grid" id="grid"></section>
    </div>
  `;

  wrap.querySelector('#back-btn')?.addEventListener('click', () => navigate('/profile'));

  function paint(): void {
    const pets = listCompletedPets();
    const sub = wrap.querySelector<HTMLElement>('[data-bind="sub"]');
    if (sub) {
      sub.textContent = t('collection.subFmt')
        .replace('{n}', String(pets.length))
        .replace('{s}', pets.length === 1 ? '' : 's');
    }
    const title = wrap.querySelector<HTMLElement>('[data-bind="title"]');
    if (title) title.textContent = t('collection.title');
    const hint = wrap.querySelector<HTMLElement>('[data-bind="hint"]');
    if (hint) hint.textContent = t('collection.howHint');

    const grid = wrap.querySelector<HTMLElement>('#grid');
    if (!grid) return;
    grid.innerHTML = pets.length === 0
      ? renderEmpty()
      : pets.map(renderCard).join('');
  }

  // Locale flips need a re-render so species labels + date copy swap.
  bind(wrap, $locale, paint);
  paint();

  return wrap;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;',
  );
}

function escapeAttr(s: string): string {
  return escapeHtml(s);
}
