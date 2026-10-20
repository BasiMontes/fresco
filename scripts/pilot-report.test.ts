import { describe, expect, test } from 'bun:test';
import { buildRows, isActive, isoWeekOf, parsePseudonymMap, repeats, streaks, weekIndex, weeksBetween } from './pilot-report';

const none = { menus: 0, cooked: 0, discarded: 0, generatedList: false };

describe('isoWeekOf and week arithmetic', () => {
  test('ISO weeks across the year boundary', () => {
    expect(isoWeekOf(new Date('2026-12-31T12:00:00Z'))).toBe('2026-W53');
    expect(isoWeekOf(new Date('2027-01-03T12:00:00Z'))).toBe('2026-W53');
    expect(isoWeekOf(new Date('2027-01-04T00:00:00Z'))).toBe('2027-W01');
    expect(isoWeekOf(new Date('2024-12-30T10:00:00Z'))).toBe('2025-W01');
    expect(isoWeekOf(new Date('2026-10-28T10:00:00Z'))).toBe('2026-W44');
  });

  test('consecutive weeks differ by one, also over a 53-week year and a 52-week one', () => {
    expect(weekIndex('2027-W01') - weekIndex('2026-W53')).toBe(1);
    expect(weekIndex('2026-W01') - weekIndex('2025-W52')).toBe(1);
    expect(weeksBetween('2026-W52', '2027-W02')).toEqual(['2026-W52', '2026-W53', '2027-W01', '2027-W02']);
  });

  test('rejects a malformed week', () => {
    expect(() => weekIndex('2026-44')).toThrow();
  });
});

describe('active', () => {
  test('a menu, a mark or a list each make a week active; nothing does not', () => {
    expect(isActive({ ...none, menus: 1 })).toBe(true);
    expect(isActive({ ...none, cooked: 1 })).toBe(true);
    expect(isActive({ ...none, discarded: 1 })).toBe(true);
    expect(isActive({ ...none, generatedList: true })).toBe(true);
    expect(isActive(none)).toBe(false);
  });
});

describe('repeats', () => {
  test('three active weeks in a row repeat', () => {
    expect(repeats([true, true, true])).toBe(true);
  });

  test('a quiet week between two active ones breaks the run', () => {
    expect(repeats([true, true, false, true, true])).toBe(false);
    expect(streaks([true, true, false, true, true])).toEqual([1, 2, 0, 1, 2]);
  });

  test('two weeks is not enough, and the run can start anywhere', () => {
    expect(repeats([true, true])).toBe(false);
    expect(repeats([false, true, true, true, false])).toBe(true);
  });
});

describe('buildRows', () => {
  const events = {
    P02: [{ week: '2026-W53', kind: 'menu' as const }, { week: '2027-W01', kind: 'cocinada' as const }, { week: '2027-W02', kind: 'list' as const }],
    P01: [],
  };
  const rows = buildRows(events, '2026-W52', '2027-W02');

  test('one row per pseudonym and week, sorted, with the quiet weeks present', () => {
    expect(rows).toHaveLength(8);
    expect(rows[0]).toMatchObject({ pseudonym: 'P01', week: '2026-W52', active: false, streak: 0 });
    expect(rows.filter(r => r.pseudonym === 'P02').map(r => r.week)).toEqual(['2026-W52', '2026-W53', '2027-W01', '2027-W02']);
  });

  test('a run that crosses the ISO year counts as consecutive', () => {
    expect(rows.filter(r => r.pseudonym === 'P02').map(r => r.streak)).toEqual([0, 1, 2, 3]);
  });

  test('counts cooked, discarded and menus separately', () => {
    const row = buildRows({ P01: [{ week: '2026-W44', kind: 'cocinada' }, { week: '2026-W44', kind: 'cocinada' }, { week: '2026-W44', kind: 'descartada' }, { week: '2026-W44', kind: 'menu' }] }, '2026-W44', '2026-W44')[0];
    expect(row).toMatchObject({ menus: 1, cooked: 2, discarded: 1, generatedList: false, active: true });
  });

  test('rows hold pseudonyms and counts only', () => {
    expect(Object.keys(rows[0]).sort()).toEqual(['active', 'cooked', 'discarded', 'generatedList', 'menus', 'pseudonym', 'streak', 'week']);
  });
});

describe('parsePseudonymMap', () => {
  test('accepts an object of non-empty ids', () => {
    expect(parsePseudonymMap('{"P01":"abc"}')).toEqual({ P01: 'abc' });
  });

  test('rejects invalid JSON, arrays, empty maps and empty ids', () => {
    for (const bad of ['nope', '[]', '{}', '{"P01":""}', '{"P01":3}']) {
      expect(typeof parsePseudonymMap(bad)).toBe('string');
    }
  });
});
