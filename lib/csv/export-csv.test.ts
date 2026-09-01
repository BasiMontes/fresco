import { describe, expect, it } from 'bun:test';
import { rowsToCsv, toCsvValue } from './export-csv';

describe('toCsvValue', () => {
  it('passes a plain value through', () => {
    expect(toCsvValue('Laura')).toBe('Laura');
    expect(toCsvValue(42)).toBe('42');
  });

  it('empties null / undefined', () => {
    expect(toCsvValue(null)).toBe('');
    expect(toCsvValue(undefined)).toBe('');
  });

  it('RFC 4180 quotes values with comma / quote / newline / CR', () => {
    expect(toCsvValue('a,b')).toBe('"a,b"');
    expect(toCsvValue('she said "hi"')).toBe('"she said ""hi"""');
    expect(toCsvValue('line1\nline2')).toBe('"line1\nline2"');
    expect(toCsvValue('line1\rline2')).toBe('"line1\rline2"');
  });

  it('JSON-stringifies objects and arrays', () => {
    expect(toCsvValue(['gluten', 'lactosa'])).toBe('"[""gluten"",""lactosa""]"');
  });

  describe('formula injection (A4-L3)', () => {
    it('prefixes a leading = + - @ with a single quote', () => {
      expect(toCsvValue('=1+1')).toBe('\'=1+1');
      expect(toCsvValue('@SUM(A1:A9)')).toBe('\'@SUM(A1:A9)');
      expect(toCsvValue('-2+3')).toBe('\'-2+3');
      expect(toCsvValue('+cmd|calc')).toBe('\'+cmd|calc');
    });

    it('prefixes a leading tab / CR', () => {
      expect(toCsvValue('\t=danger')).toBe('\'\t=danger');
      // a CR also trips the RFC-4180 quote-wrap
      expect(toCsvValue('\rHIDDEN')).toBe('"\'\rHIDDEN"');
    });

    it('leaves a value with = in the middle alone', () => {
      expect(toCsvValue('a=b')).toBe('a=b');
    });
  });
});

describe('rowsToCsv', () => {
  it('returns null for an empty table', () => {
    expect(rowsToCsv([])).toBeNull();
  });

  it('emits a header from the union of row keys', () => {
    const csv = rowsToCsv([{ a: 1, b: 2 }, { a: 3, c: 4 }]);
    expect(csv).toBe('a,b,c\n1,2,\n3,,4');
  });

  it('neutralizes a formula-injecting cell in a real row', () => {
    const csv = rowsToCsv([{ nombre: '=1+1', plan: 'free' }]);
    expect(csv).toBe('nombre,plan\n\'=1+1,free');
  });
});
