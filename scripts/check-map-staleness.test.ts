import { describe, expect, test } from 'bun:test';

import { contextMapSkill } from '../cli/lib/context-maps.ts';
import { checkMap, DESCRIBES, exitCodeFor, mapDateOf, migrationDate, migrationsNewerThan, undatedSections } from './check-map-staleness';

/**
 * FRESCO-1292 (audit 11 F6): the three business maps drift behind what they describe, and nothing said so.
 * These helpers back `bun run context:stale`, which warns and never fails.
 */

const dataSkill = contextMapSkill('business-data-context')!;
const apiSkill = contextMapSkill('business-api-context')!;
const noCommits = () => [] as string[];

describe('mapDateOf', () => {
  test('is the newest valid data-updated of the sections', () => {
    expect(mapDateOf([{ updated: '2026-10-29' }, { updated: '2026-11-03' }, { updated: '2026-10-30' }])).toBe('2026-11-03');
  });

  test('ignores a missing or malformed date, and is null when none is valid', () => {
    expect(mapDateOf([{ updated: null }, { updated: '2026-10-29' }, { updated: 'yesterday' }])).toBe('2026-10-29');
    expect(mapDateOf([{ updated: null }, { updated: '29/10/2026' }])).toBeNull();
    expect(mapDateOf([])).toBeNull();
  });
});

describe('migrations', () => {
  test('migrationDate reads the day from the 14 digits of the name', () => {
    expect(migrationDate('supabase/migrations/20261112100000_user_profiles_tour_seen.sql')).toBe('2026-11-12');
    expect(migrationDate('notes.md')).toBeNull();
    expect(migrationDate('2026111_short.sql')).toBeNull();
  });

  test('migrationsNewerThan counts only days after the map day, oldest first', () => {
    const files = ['20261112100000_c.sql', '20261029160000_same_day.sql', '20261103180000_a.sql', '20261029090000_older.sql', 'README.md'];
    expect(migrationsNewerThan(files, '2026-10-29')).toEqual(['20261103180000_a.sql', '20261112100000_c.sql']);
  });
});

describe('undatedSections', () => {
  test('lists the sections that have no valid data-updated', () => {
    expect(undatedSections([{ id: 'a', updated: '2026-10-29' }, { id: 'b', updated: null }, { id: 'c', updated: 'x' }])).toEqual(['b', 'c']);
  });
});

describe('exitCodeFor', () => {
  test('is 0 by default, whatever is stale: a notice, never a blocker', () => {
    expect(exitCodeFor(4, false)).toBe(0);
    expect(exitCodeFor(0, false)).toBe(0);
  });

  test('fails only when asked to (the weekly workflow) and something is stale', () => {
    expect(exitCodeFor(4, true)).toBe(1);
    expect(exitCodeFor(0, true)).toBe(0);
  });
});

describe('checkMap', () => {
  const files = ['20261029160000_prune.sql', '20261103180000_a.sql', '20261112100000_b.sql'];

  test('warns when migrations are newer than the data map, naming how many and the newest', () => {
    const findings = checkMap({ skill: dataSkill, mapDate: '2026-10-29', undated: [], migrationFiles: files, commitDaysSince: noCommits });
    expect(findings).toHaveLength(1);
    expect(findings[0].level).toBe('warn');
    expect(findings[0].text).toContain('2 newer than the map (2026-10-29)');
    expect(findings[0].text).toContain('20261112100000_b.sql');
  });

  test('is fine when the map is newer than every migration', () => {
    const findings = checkMap({ skill: dataSkill, mapDate: '2026-11-25', undated: [], migrationFiles: files, commitDaysSince: noCommits });
    expect(findings.map(f => f.level)).toEqual(['ok']);
  });

  test('warns for routes and Edge Functions by the commits after the map, and is fine when there are none', () => {
    const touched = checkMap({ skill: apiSkill, mapDate: '2026-10-29', undated: [], migrationFiles: [], commitDaysSince: path => (path === 'app/api' ? ['2026-11-20', '2026-11-02'] : []) });
    expect(touched.map(f => f.level)).toEqual(['warn', 'ok']);
    expect(touched[0].text).toContain('2 commit(s) after the map (2026-10-29), newest 2026-11-20');
    expect(checkMap({ skill: apiSkill, mapDate: '2026-11-25', undated: [], migrationFiles: [], commitDaysSince: noCommits }).map(f => f.level)).toEqual(['ok', 'ok']);
  });

  test('does not read "git could not be read" as "nothing changed"', () => {
    const findings = checkMap({ skill: apiSkill, mapDate: '2026-10-29', undated: [], migrationFiles: [], commitDaysSince: () => null });
    expect(findings.map(f => f.level)).toEqual(['warn', 'warn']);
    expect(findings[0].text).toContain('NOT checked');
  });

  test('a map with no valid date is a warning, never fresh', () => {
    expect(checkMap({ skill: dataSkill, mapDate: null, undated: [], migrationFiles: files, commitDaysSince: noCommits })[0].level).toBe('warn');
  });

  test('sections without a date are reported as unknown', () => {
    const findings = checkMap({ skill: dataSkill, mapDate: '2026-11-25', undated: ['entity-x', 'flow-y'], migrationFiles: files, commitDaysSince: noCommits });
    expect(findings.at(-1)?.text).toContain('2 section(s) have no valid data-updated date');
    expect(findings.at(-1)?.text).toContain('entity-x, flow-y');
  });

  test('a map skill with no registered description is reported, not skipped', () => {
    const unknown = { ...dataSkill, slug: 'business-new-context' };
    expect(checkMap({ skill: unknown, mapDate: '2026-10-29', undated: [], migrationFiles: [], commitDaysSince: noCommits })[0].text).toContain('NOT checked');
  });

  test('every shipped map skill has a description of what it covers', () => {
    for (const slug of ['business-data-context', 'business-api-context', 'business-feature-context']) {
      expect(DESCRIBES[slug]?.length).toBeGreaterThan(0);
    }
  });
});
