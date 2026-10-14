import { describe, expect, test } from 'bun:test';
import { findClosedWithoutEvidence, findDefectsWithoutTraceability, parseDays } from './check-closure-evidence';

/** FRESCO-812: the closure-evidence check keeps the ticket's metric reproducible. */

const issue = (key: string, commentCount: number) => ({ key, summary: `summary ${key}`, issueType: 'Tarea', commentCount, hasParent: true, linkCount: 1 });

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

/**
 * FRESCO-926 (audit A4-H17): a defect is traceable when it has an epic (`parent`) and a
 * link to what it regressed. The Definition of Done already asked for it; this measures it
 * the way the closure-evidence rule is measured, over the same recent window.
 */
const defect = (key: string, extra: { hasParent?: boolean, linkCount?: number, issueType?: string } = {}) => ({
  key,
  summary: `summary ${key}`,
  issueType: extra.issueType ?? 'Error',
  commentCount: 1,
  hasParent: extra.hasParent ?? true,
  linkCount: extra.linkCount ?? 1,
});

describe('findDefectsWithoutTraceability', () => {
  test('flags a defect with no epic, saying so', () => {
    expect(findDefectsWithoutTraceability([defect('FRESCO-1', { hasParent: false })]))
      .toEqual([{ issue: defect('FRESCO-1', { hasParent: false }), missing: ['epic'] }]);
  });

  test('flags a defect with no link, saying so', () => {
    expect(findDefectsWithoutTraceability([defect('FRESCO-2', { linkCount: 0 })])[0].missing).toEqual(['link']);
  });

  test('says both when it has neither', () => {
    expect(findDefectsWithoutTraceability([defect('FRESCO-3', { hasParent: false, linkCount: 0 })])[0].missing).toEqual(['epic', 'link']);
  });

  test('a defect with an epic and a link is fine', () => {
    expect(findDefectsWithoutTraceability([defect('FRESCO-4')])).toEqual([]);
  });

  test('never looks at other ticket kinds, which have their own rules', () => {
    const tasks = [defect('FRESCO-5', { issueType: 'Tarea', hasParent: false, linkCount: 0 }), defect('FRESCO-6', { issueType: 'Historia', hasParent: false })];

    expect(findDefectsWithoutTraceability(tasks)).toEqual([]);
  });

  test('reports only the untraceable defects of a mixed list, in order', () => {
    const result = findDefectsWithoutTraceability([defect('FRESCO-7'), defect('FRESCO-8', { linkCount: 0 }), defect('FRESCO-9', { hasParent: false }), defect('FRESCO-10')]);

    expect(result.map(r => r.issue.key)).toEqual(['FRESCO-8', 'FRESCO-9']);
  });
});
