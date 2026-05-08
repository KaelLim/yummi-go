import { describe, it, expect } from 'vitest';
import { matchesLucky, dailyLuckyColor, COLORS, normalizeLuckyColor } from '../lucky-color';

describe('matchesLucky', () => {
  it('matches plain color directly', () => {
    expect(matchesLucky(['red'], 'red')).toBe(true);
    expect(matchesLucky(['green'], 'green')).toBe(true);
    expect(matchesLucky(['white'], 'white')).toBe(true);
  });

  it('returns false when colors do not match', () => {
    expect(matchesLucky(['green'], 'red')).toBe(false);
    expect(matchesLucky([], 'red')).toBe(false);
  });

  it('groups purple and black together', () => {
    expect(matchesLucky(['black'], 'purple')).toBe(true);
    expect(matchesLucky(['purple'], 'black')).toBe(true);
    expect(matchesLucky(['black'], 'black')).toBe(true);
    expect(matchesLucky(['purple'], 'purple')).toBe(true);
  });

  it('groups yellow with orange', () => {
    expect(matchesLucky(['orange'], 'yellow')).toBe(true);
    expect(matchesLucky(['yellow'], 'yellow')).toBe(true);
  });

  it('does not group yellow back from orange-target — orange is not a lucky color', () => {
    expect(matchesLucky(['red'], 'yellow')).toBe(false);
  });
});

describe('dailyLuckyColor', () => {
  it('rotates through 5-color cycle', () => {
    expect(dailyLuckyColor(0)).toBe('red');
    expect(dailyLuckyColor(1)).toBe('yellow');
    expect(dailyLuckyColor(2)).toBe('green');
    expect(dailyLuckyColor(3)).toBe('purple');
    expect(dailyLuckyColor(4)).toBe('white');
    expect(dailyLuckyColor(5)).toBe('red');
    expect(dailyLuckyColor(10)).toBe('red');
  });
});

describe('COLORS', () => {
  it('contains 6 entries', () => {
    expect(COLORS.length).toBe(6);
    expect(COLORS).toContain('red');
    expect(COLORS).toContain('black');
  });
});

describe('normalizeLuckyColor', () => {
  it('returns null for empty/null/whitespace', () => {
    expect(normalizeLuckyColor(null)).toBeNull();
    expect(normalizeLuckyColor(undefined)).toBeNull();
    expect(normalizeLuckyColor('')).toBeNull();
  });

  it('passes through canonical English keys', () => {
    expect(normalizeLuckyColor('red')).toBe('red');
    expect(normalizeLuckyColor('Green')).toBe('green');
    expect(normalizeLuckyColor('  white  ')).toBe('white');
  });

  it('maps Traditional Chinese to palette keys', () => {
    expect(normalizeLuckyColor('紅色')).toBe('red');
    expect(normalizeLuckyColor('黃色')).toBe('yellow');
    expect(normalizeLuckyColor('橘色')).toBe('yellow');
    expect(normalizeLuckyColor('黃色/橘色')).toBe('yellow');
    expect(normalizeLuckyColor('綠色')).toBe('green');
    expect(normalizeLuckyColor('紫色')).toBe('purple');
    expect(normalizeLuckyColor('黑色')).toBe('black');
    expect(normalizeLuckyColor('白色')).toBe('white');
  });

  it('returns null for unrecognised values', () => {
    expect(normalizeLuckyColor('rainbow')).toBeNull();
    expect(normalizeLuckyColor('xyz')).toBeNull();
  });
});
