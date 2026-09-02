import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { addIsoWeeks, formatWeekRangeLabel, getDateFromIsoWeek, getIsoWeek, getIsoWeekMonday } from './iso-week';

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

describe('formatWeekRangeLabel', () => {
  test('a week within a single month omits the start month (FRESCO-109)', () => {
    expect(formatWeekRangeLabel('2026-02-02')).toBe('2–8 feb');
  });

  test('a week crossing a month boundary shows both months (FRESCO-109)', () => {
    // Monday 2026-07-27 -> Sunday 2026-08-02.
    expect(formatWeekRangeLabel('2026-07-27')).toBe('27 jul – 2 ago');
  });

  test('a week crossing a year boundary shows both months', () => {
    // Monday 2026-12-28 -> Sunday 2027-01-03.
    expect(formatWeekRangeLabel('2026-12-28')).toBe('28 dic – 3 ene');
  });
});

// FRESCO-397 (A4-L12): before the fix, `toUtcDateOnly` read local-time
// getters while the rest of the module read `getUTC*`. Any runtime in a
// negative UTC offset then computed the wrong week whenever a `Date` whose
// UTC and local calendar days differ flowed through `getIsoWeek()` — most
// visibly via `addIsoWeeks()`, which round-trips a UTC-anchored `Date` from
// `getDateFromIsoWeek()`. CI runs in UTC, so the bug was invisible without
// pinning a negative-offset zone here. Spain (UTC+1/+2) was never affected.
describe('negative-UTC-offset runtime (America/Los_Angeles)', () => {
  const originalTz = process.env.TZ;

  beforeAll(() => {
    process.env.TZ = 'America/Los_Angeles';
  });

  afterAll(() => {
    if (originalTz === undefined) {
      delete process.env.TZ;
    }
    else {
      process.env.TZ = originalTz;
    }
  });

  test('getIsoWeek reads a Monday-00:00Z date as that Monday, not the previous Sunday', () => {
    // 2026-01-05T00:00:00Z is a Monday (ISO 2026-W02). In UTC-8 the local
    // clock reads Sunday 2026-01-04 16:00 — the exact split the old code
    // tripped on.
    expect(getIsoWeek(new Date(Date.UTC(2026, 0, 5)))).toBe('2026-W02');
  });

  test('addIsoWeeks round-trips (the reported break: prev/next week navigation)', () => {
    const original = '2026-W02';
    expect(addIsoWeeks(original, 1)).toBe('2026-W03');
    expect(addIsoWeeks(original, -1)).toBe('2026-W01');
    expect(addIsoWeeks(addIsoWeeks(original, 5), -5)).toBe(original);
  });

  test('addIsoWeeks across a year boundary stays correct', () => {
    // 2026-W53 is the ISO leap week; +1 lands in 2027-W01.
    expect(addIsoWeeks('2026-W53', 1)).toBe('2027-W01');
    expect(addIsoWeeks('2027-W01', -1)).toBe('2026-W53');
  });

  test('getIsoWeekMonday still returns a real Monday in YYYY-MM-DD', () => {
    const monday = getIsoWeekMonday(new Date(Date.UTC(2026, 1, 12)));
    expect(monday).toBe('2026-02-09');
    expect(new Date(`${monday}T00:00:00.000Z`).getUTCDay()).toBe(1);
  });

  test('getDateFromIsoWeek is unaffected (already all-UTC)', () => {
    expect(getDateFromIsoWeek('2026-W02').toISOString().slice(0, 10)).toBe('2026-01-05');
  });
});
