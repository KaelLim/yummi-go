import { describe, it, expect } from 'vitest';
import { parseCSV } from '../csv';

describe('parseCSV', () => {
  it('parses a simple row', () => {
    expect(parseCSV('a,b,c')).toEqual([['a', 'b', 'c']]);
  });

  it('parses multiple rows', () => {
    expect(parseCSV('a,b\nc,d')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });

  it('handles quoted field with comma', () => {
    expect(parseCSV('a,"b,c",d')).toEqual([['a', 'b,c', 'd']]);
  });

  it('handles embedded newline in quotes', () => {
    expect(parseCSV('a,"b\nb",c')).toEqual([['a', 'b\nb', 'c']]);
  });

  it('handles escaped double-quote', () => {
    expect(parseCSV('a,"b""x",c')).toEqual([['a', 'b"x', 'c']]);
  });

  it('handles empty fields', () => {
    expect(parseCSV('a,,c')).toEqual([['a', '', 'c']]);
  });

  it('strips trailing CR (CRLF input)', () => {
    expect(parseCSV('a,b\r\nc,d')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });

  it('handles a final row without newline', () => {
    expect(parseCSV('a,b\nc,d')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });

  it('returns empty array for empty input', () => {
    expect(parseCSV('')).toEqual([]);
  });
});
