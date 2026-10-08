import { describe, expect, test } from 'bun:test';

import { compareCounts, parseCounts, readinessProbeArgs } from './db-backup';

describe('parseCounts', () => {
  test('reads schema.table,count lines and ignores blanks', () => {
    expect(parseCounts('public.recipes,42\n\nauth.users,7\n')).toEqual({
      'public.recipes': 42,
      'auth.users': 7,
    });
  });

  test('throws on a line that is not table,count', () => {
    expect(() => parseCounts('public.recipes,many')).toThrow('Unparseable');
  });
});

describe('compareCounts', () => {
  const before = { 'public.recipes': 100, 'auth.users': 5 };

  test('no mismatch when restored equals the source', () => {
    expect(compareCounts({ before, after: before, restored: before })).toEqual([]);
  });

  test('accepts a count between before and after (source moved during the dump)', () => {
    const after = { 'public.recipes': 104, 'auth.users': 5 };
    const restored = { 'public.recipes': 102, 'auth.users': 5 };
    expect(compareCounts({ before, after, restored })).toEqual([]);
  });

  test('flags a table restored with fewer rows than the source ever had', () => {
    const restored = { 'public.recipes': 99, 'auth.users': 5 };
    expect(compareCounts({ before, after: before, restored })).toEqual([
      { table: 'public.recipes', restored: 99, min: 100, max: 100 },
    ]);
  });

  test('flags a table missing from the restore', () => {
    const restored = { 'public.recipes': 100 };
    expect(compareCounts({ before, after: before, restored })).toEqual([
      { table: 'auth.users', restored: null, min: 5, max: 5 },
    ]);
  });
});

describe('readinessProbeArgs', () => {
  test('probes over TCP, which only the final server answers', () => {
    // The official image first runs a temporary init server that listens on the unix
    // socket only, then restarts. A socket probe passes during init and the next psql
    // lands in the restart gap (the 2026-10-04 scheduled backup failed this way).
    const args = readinessProbeArgs('verify-container');
    expect(args[args.indexOf('-h') + 1]).toBe('127.0.0.1');
    expect(args).toContain('verify-container');
  });
});
