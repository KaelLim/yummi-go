/**
 * Pet hero view — sprite-driven illustration that swaps art based on
 * ($pet.stage, $pet.mood). Resolution is centralized in lib/pet-sprites.
 *
 * Subscribes to $pet via bind() so subscribers auto-cleanup when the
 * element is removed from the DOM (no leaks across navigations). When the
 * pet is in an active poison window the view forces mood='critical' and
 * adds the .poisoned class so CSS can layer a green sickly tint.
 */
import { $pet, effectiveMood, type PetStoreShape } from '@/store/pet';
import { bind } from '@/lib/lifecycle';
import { spriteFor } from '@/lib/pet-sprites';
import type { PetStage } from '@/lib/pet-evolution';

export interface PetViewHandle {
  el: HTMLElement;
  setFogOpacity: (value: number) => void;
}

export function createPetView(): PetViewHandle {
  const wrap = document.createElement('div');
  wrap.className = 'pet-view';
  wrap.innerHTML = `
    <img class="pet-frog" src="${spriteFor('egg', 'normal')}" alt="守護者" draggable="false" />
    <div class="pet-accessory" aria-hidden="true"></div>
    <div class="fog-overlay" style="--fog-opacity:0"></div>
  `;

  const img = wrap.querySelector<HTMLImageElement>('img.pet-frog')!;

  function applyState(p: PetStoreShape | null) {
    const stage = (p?.stage ?? 'egg') as PetStage;
    const mood = effectiveMood(p);
    const poisoned = !!(p?.poisonedUntil && p.poisonedUntil > Date.now());
    wrap.classList.toggle('poisoned', poisoned);
    img.setAttribute('src', spriteFor(stage, mood));
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
