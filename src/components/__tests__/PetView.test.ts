import { describe, it, expect, beforeEach } from 'vitest';
import { createPetView, fogOpacityForMissedDays } from '../PetView';
import { $pet } from '@/store/pet';

describe('PetView', () => {
  beforeEach(() => {
    $pet.set(null);
  });

  it('renders .pet-view with default egg/normal sprite when $pet is null', () => {
    const { el } = createPetView();
    const img = el.querySelector<HTMLImageElement>('img.pet-frog');
    expect(el.classList.contains('pet-view')).toBe(true);
    expect(img).not.toBeNull();
    expect(img!.getAttribute('src')).toBe('/pet/egg/normal.png');
  });

  it('contains accessory and fog overlay slots', () => {
    const { el } = createPetView();
    expect(el.querySelector('.pet-accessory')).not.toBeNull();
    expect(el.querySelector('.fog-overlay')).not.toBeNull();
  });

  it('updates <img src> to the sprite for current $pet.stage and mood', () => {
    const { el } = createPetView();
    document.body.appendChild(el);
    const img = el.querySelector<HTMLImageElement>('img.pet-frog')!;

    $pet.set({ level: 19, currentXp: 0, accumulatedXp: 1000, stage: 'youth', mood: 'happy', strikes: 0, poisonedUntil: null });
    expect(img.getAttribute('src')).toBe('/pet/youth/happy.png');

    $pet.set({ level: 80, currentXp: 0, accumulatedXp: 9999, stage: 'max', mood: 'evolve', strikes: 0, poisonedUntil: null });
    expect(img.getAttribute('src')).toBe('/pet/max/normal.png');

    el.remove();
  });

  it('falls back to egg/normal for unknown stage values', () => {
    const { el } = createPetView();
    document.body.appendChild(el);
    const img = el.querySelector<HTMLImageElement>('img.pet-frog')!;
    $pet.set({ level: 1, currentXp: 0, accumulatedXp: 0, stage: 'bogus' as never, mood: 'whatever' as never, strikes: 0, poisonedUntil: null });
    expect(img.getAttribute('src')).toBe('/pet/egg/normal.png');
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
