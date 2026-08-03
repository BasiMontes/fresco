import { describe, expect, test } from 'bun:test';
import { addIsoWeeks, getDateFromIsoWeek, getIsoWeek, getIsoWeekMonday } from './iso-week';

function utc(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day));
}

describe('getIsoWeek', () => {
  test('4 January is always in week 1 of its own year (ISO 8601 definition)', () => {
    for (const year of [2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027]) {
      expect(getIsoWeek(utc(year, 0, 4))).toBe(`${year}-W01`);
    }
  });

  test('28 December is always in the last ISO week of its own year (ISO 8601 definition)', () => {
    for (const year of [2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027]) {
      expect(getIsoWeek(utc(year, 11, 28)).startsWith(`${year}-W`)).toBe(true);
    }
  });

  test('year-boundary rollover: 31 Dec 2018 (Monday) belongs to 2019-W01, not 2018', () => {
    expect(getIsoWeek(utc(2018, 11, 31))).toBe('2019-W01');
  });

  test('year-boundary rollover: 1 Jan 2019 (Tuesday) also belongs to 2019-W01', () => {
    expect(getIsoWeek(utc(2019, 0, 1))).toBe('2019-W01');
  });

  test('year-boundary rollover: 1 Jan 2023 (Sunday) belongs to the PREVIOUS year, 2022-W52', () => {
    expect(getIsoWeek(utc(2023, 0, 1))).toBe('2022-W52');
  });

  test('defaults to the current date when called with no argument', () => {
    expect(getIsoWeek()).toMatch(/^\d{4}-W\d{2}$/);
  });
});

describe('getIsoWeekMonday', () => {
  test('always returns a Monday, and always within the same ISO week as the input date', () => {
    // Sweep a full month so every weekday (Mon..Sun) is exercised at least once.
    for (let day = 1; day <= 31; day++) {
      const date = utc(2026, 0, day);
      const monday = getIsoWeekMonday(date);
      const mondayDate = new Date(`${monday}T00:00:00.000Z`);

      expect(mondayDate.getUTCDay()).toBe(1); // 1 = Monday

      const diffDays = (date.getTime() - mondayDate.getTime()) / (24 * 60 * 60 * 1000);
      expect(diffDays).toBeGreaterThanOrEqual(0);
      expect(diffDays).toBeLessThan(7);
    }
  });

  test('returns YYYY-MM-DD format', () => {
    expect(getIsoWeekMonday(utc(2026, 0, 7))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('defaults to the current date when called with no argument', () => {
    expect(getIsoWeekMonday()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('getDateFromIsoWeek', () => {
  test('is the exact inverse of getIsoWeek across a full year sweep', () => {
    for (let day = 1; day <= 365; day += 3) {
      const date = new Date(Date.UTC(2026, 0, day));
      const isoWeek = getIsoWeek(date);
      const monday = getDateFromIsoWeek(isoWeek);
      expect(getIsoWeek(monday)).toBe(isoWeek);
    }
  });

  test('returns the Monday matching getIsoWeekMonday for the same date', () => {
    const date = utc(2026, 1, 15);
    const isoWeek = getIsoWeek(date);
    const monday = getDateFromIsoWeek(isoWeek);
    expect(monday.toISOString().slice(0, 10)).toBe(getIsoWeekMonday(date));
  });

  test('throws on a malformed ISO week string', () => {
    expect(() => getDateFromIsoWeek('not-a-week')).toThrow();
    expect(() => getDateFromIsoWeek('2026-13')).toThrow();
  });
});

describe('addIsoWeeks', () => {
  test('adding 1 week then subtracting 1 week returns to the original week', () => {
    const original = '2026-W05';
    expect(addIsoWeeks(addIsoWeeks(original, 1), -1)).toBe(original);
  });

  test('adding 0 weeks is a no-op', () => {
    expect(addIsoWeeks('2026-W20', 0)).toBe('2026-W20');
  });

  test('crosses a year boundary correctly (last week of 2026 + 1 = first week of 2027)', () => {
    // 2026-12-28 is a Monday, ISO week 2026-W53 per the ISO 8601 leap-week rule.
    const lastWeekOf2026 = getIsoWeek(utc(2026, 11, 28));
    expect(addIsoWeeks(lastWeekOf2026, 1)).toBe('2027-W01');
  });
});
