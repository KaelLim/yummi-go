/**
 * Pet hero view — frog illustration + stage + mood + fog overlay.
 *
 * Stage drives the pet container class (egg/baby/youth/adult/max). Egg stage
 * hides the frog and shows a 🥚 placeholder; later stages scale the frog up
 * and may layer accessories (crown for adult, sparkle for max). Mood is a
 * second class that applies a CSS filter (saturate / grayscale / brightness).
 *
 * Fog overlay is a sibling .fog-overlay element whose opacity is set via the
 * `--fog-opacity` custom property. setFogOpacity() is exposed so future
 * Phase 9 check-in logic can adjust it after each meal capture.
 *
 * Subscribes to $pet via bind() so the element auto-cleans up when removed
 * from the DOM (no subscriber leaks across navigations).
 */
import { $pet, type PetStoreShape } from '@/store/pet';
import { bind } from '@/lib/lifecycle';

const STAGES = ['egg', 'baby', 'youth', 'adult', 'max'] as const;
const MOODS = ['normal', 'happy', 'weak', 'critical', 'evolve'] as const;

export interface PetViewHandle {
  el: HTMLElement;
  setFogOpacity: (value: number) => void;
}

export function createPetView(): PetViewHandle {
  const wrap = document.createElement('div');
  wrap.className = 'pet-view pet-stage-egg pet-mood-normal';
  wrap.innerHTML = `
    <div class="pet-shell" aria-hidden="true">🥚</div>
    <img class="pet-frog" src="/pet-frog.png" alt="守護者" draggable="false" />
    <div class="pet-accessory" aria-hidden="true"></div>
    <div class="fog-overlay" style="--fog-opacity:0"></div>
  `;

  function applyState(p: PetStoreShape | null) {
    for (const s of STAGES) wrap.classList.remove(`pet-stage-${s}`);
    for (const m of MOODS) wrap.classList.remove(`pet-mood-${m}`);
    const stage = (p?.stage ?? 'egg') as (typeof STAGES)[number];
    const mood = (p?.mood ?? 'normal') as (typeof MOODS)[number];
    wrap.classList.add(`pet-stage-${STAGES.includes(stage) ? stage : 'egg'}`);
    wrap.classList.add(`pet-mood-${MOODS.includes(mood) ? mood : 'normal'}`);
  }

  bind(wrap, $pet, applyState);

  return {
    el: wrap,
    setFogOpacity(value: number) {
      const fog = wrap.querySelector<HTMLElement>('.fog-overlay');
      if (fog) fog.style.setProperty('--fog-opacity', String(Math.max(0, Math.min(1, value))));
    },
  };
}

/** Map consecutive missed-checkin days to fog opacity per spec (0%/30%/60%). */
export function fogOpacityForMissedDays(missed: number): number {
  if (missed <= 0) return 0;
  if (missed === 1) return 0.3;
  return 0.6;
}
