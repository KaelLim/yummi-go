import { describe, it, expect } from 'vitest';
import { spriteFor, type PetMood } from '@/lib/pet-sprites';
import type { PetStage } from '@/lib/pet-evolution';

describe('spriteFor', () => {
  describe('happy paths', () => {
    const cases: Array<[PetStage, PetMood, string]> = [
      ['egg',   'normal',   '/pet/egg/normal.png'],
      ['egg',   'evolve',   '/pet/egg/crack.png'],
      ['baby',  'normal',   '/pet/baby/normal.png'],
      ['baby',  'happy',    '/pet/baby/happy.png'],
      ['baby',  'weak',     '/pet/baby/weak.png'],
      ['baby',  'critical', '/pet/baby/critical.png'],
      ['baby',  'evolve',   '/pet/baby/evolve.png'],
      ['youth', 'normal',   '/pet/youth/normal.png'],
      ['youth', 'happy',    '/pet/youth/happy.png'],
      ['youth', 'weak',     '/pet/youth/weak.png'],
      ['youth', 'critical', '/pet/youth/critical.png'],
      ['youth', 'evolve',   '/pet/youth/evolve.png'],
      ['adult', 'normal',   '/pet/adult/normal.png'],
      ['adult', 'happy',    '/pet/adult/happy.png'],
      ['adult', 'weak',     '/pet/adult/weak.png'],
      ['adult', 'critical', '/pet/adult/critical.png'],
      ['adult', 'evolve',   '/pet/adult/evolve.png'],
      ['max',   'normal',   '/pet/max/normal.png'],
      ['max',   'happy',    '/pet/max/happy.png'],
      ['max',   'weak',     '/pet/max/weak.png'],
      ['max',   'critical', '/pet/max/critical.png'],
    ];
    it.each(cases)('spriteFor(%s, %s) -> %s', (stage, mood, expected) => {
      expect(spriteFor(stage, mood)).toBe(expected);
    });
  });

  describe('fallbacks', () => {
    it('egg falls back to normal for happy/weak/critical', () => {
      expect(spriteFor('egg', 'happy')).toBe('/pet/egg/normal.png');
      expect(spriteFor('egg', 'weak')).toBe('/pet/egg/normal.png');
      expect(spriteFor('egg', 'critical')).toBe('/pet/egg/normal.png');
    });

    it('max falls back to normal for evolve (no further evolution)', () => {
      expect(spriteFor('max', 'evolve')).toBe('/pet/max/normal.png');
    });

    it('unknown stage defaults to egg/normal (defensive)', () => {
      expect(spriteFor('bogus' as PetStage, 'normal')).toBe('/pet/egg/normal.png');
    });
  });
});
