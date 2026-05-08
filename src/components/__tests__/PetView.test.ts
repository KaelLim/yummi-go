import { describe, it, expect, beforeEach } from 'vitest';
import { createPetView, fogOpacityForMissedDays } from '../PetView';
import { $pet } from '@/store/pet';

describe('PetView', () => {
  beforeEach(() => {
    $pet.set(null);
  });

  it('renders .pet-view with default egg + normal classes when $pet is null', () => {
    const { el } = createPetView();
    expect(el.classList.contains('pet-view')).toBe(true);
    expect(el.classList.contains('pet-stage-egg')).toBe(true);
    expect(el.classList.contains('pet-mood-normal')).toBe(true);
  });

  it('contains shell, frog img, accessory and fog overlay slots', () => {
    const { el } = createPetView();
    expect(el.querySelector('.pet-shell')).not.toBeNull();
    expect(el.querySelector('img.pet-frog')).not.toBeNull();
    expect(el.querySelector('.pet-accessory')).not.toBeNull();
    expect(el.querySelector('.fog-overlay')).not.toBeNull();
  });

  it('reflects $pet stage and mood when mounted', () => {
    const { el } = createPetView();
    document.body.appendChild(el);
    $pet.set({ level: 19, currentXp: 0, accumulatedXp: 1000, stage: 'youth', mood: 'happy' });
    expect(el.classList.contains('pet-stage-youth')).toBe(true);
    expect(el.classList.contains('pet-stage-egg')).toBe(false);
    expect(el.classList.contains('pet-mood-happy')).toBe(true);
    expect(el.classList.contains('pet-mood-normal')).toBe(false);
    el.remove();
  });

  it('falls back to egg + normal for unknown stage/mood values', () => {
    const { el } = createPetView();
    document.body.appendChild(el);
    $pet.set({ level: 1, currentXp: 0, accumulatedXp: 0, stage: 'bogus' as never, mood: 'whatever' });
    expect(el.classList.contains('pet-stage-egg')).toBe(true);
    expect(el.classList.contains('pet-mood-normal')).toBe(true);
    el.remove();
  });

  it('setFogOpacity writes the custom property and clamps to [0,1]', () => {
    const { el, setFogOpacity } = createPetView();
    const fog = el.querySelector<HTMLElement>('.fog-overlay')!;
    setFogOpacity(0.5);
    expect(fog.style.getPropertyValue('--fog-opacity')).toBe('0.5');
    setFogOpacity(2);
    expect(fog.style.getPropertyValue('--fog-opacity')).toBe('1');
    setFogOpacity(-1);
    expect(fog.style.getPropertyValue('--fog-opacity')).toBe('0');
  });

  it('fogOpacityForMissedDays maps spec values', () => {
    expect(fogOpacityForMissedDays(0)).toBe(0);
    expect(fogOpacityForMissedDays(1)).toBe(0.3);
    expect(fogOpacityForMissedDays(2)).toBe(0.6);
    expect(fogOpacityForMissedDays(5)).toBe(0.6);
  });
});
