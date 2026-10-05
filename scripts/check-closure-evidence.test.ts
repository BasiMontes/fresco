import { describe, expect, test } from 'bun:test';
import { findClosedWithoutEvidence, parseDays } from './check-closure-evidence';

/** FRESCO-812: the closure-evidence check keeps the ticket's metric reproducible. */

const issue = (key: string, commentCount: number) => ({ key, summary: `summary ${key}`, issueType: 'Tarea', commentCount });

describe('findClosedWithoutEvidence', () => {
  test('keeps only the closed tickets with zero comments', () => {
    const result = findClosedWithoutEvidence([issue('FRESCO-1', 0), issue('FRESCO-2', 1), issue('FRESCO-3', 4), issue('FRESCO-4', 0)]);

    expect(result.map(i => i.key)).toEqual(['FRESCO-1', 'FRESCO-4']);
  });

  test('is empty when every closed ticket has a comment', () => {
    expect(findClosedWithoutEvidence([issue('FRESCO-1', 1), issue('FRESCO-2', 2)])).toEqual([]);
  });
});

describe('parseDays', () => {
  test('defaults to 7 days', () => {
    expect(parseDays([])).toBe(7);
  });

  test('reads --days', () => {
    expect(parseDays(['--days', '14'])).toBe(14);
  });

  test.each([['0'], ['-3'], ['abc'], ['1.5']])('rejects %s', (value) => {
    expect(() => parseDays(['--days', value])).toThrow('--days needs a positive whole number');
  });
});
