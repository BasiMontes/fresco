import { describe, expect, test } from 'bun:test';
import { hoyEnMadrid, sumarDias } from './madrid-date';

describe('hoyEnMadrid', () => {
  test('uses the Madrid calendar date, not UTC: 23:30 UTC in summer is already tomorrow in Madrid', () => {
    expect(hoyEnMadrid(new Date('2026-07-14T23:30:00Z'))).toBe('2026-07-15');
  });

  test('uses the Madrid calendar date in winter (UTC+1)', () => {
    expect(hoyEnMadrid(new Date('2026-12-31T23:30:00Z'))).toBe('2027-01-01');
  });

  test('keeps the same date when UTC and Madrid agree', () => {
    expect(hoyEnMadrid(new Date('2026-10-09T10:00:00Z'))).toBe('2026-10-09');
  });
});

describe('sumarDias', () => {
  test('adds days inside a month', () => {
    expect(sumarDias('2026-10-05', 3)).toBe('2026-10-08');
  });

  test('crosses a month and a year boundary', () => {
    expect(sumarDias('2026-12-30', 3)).toBe('2027-01-02');
  });

  test('zero days returns the same date', () => {
    expect(sumarDias('2026-10-09', 0)).toBe('2026-10-09');
  });
});
