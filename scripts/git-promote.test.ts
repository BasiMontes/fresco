import { describe, expect, test } from 'bun:test';
import { applyOverride, evaluatePromotion, hasPullRequestRef, isDocsOnly } from './git-promote';

/**
 * FRESCO-829 (external audit 6): the staging -> main promotion is a manual
 * fast-forward, so the rule "what reaches main passed the staging PR Check" had
 * no enforcement. These helpers back `bun run git:promote`.
 */

const green = { status: 'completed', conclusion: 'success' };
const clean = {
  sha: 'a'.repeat(40),
  authorEmail: '76871306+BasiMontes@users.noreply.github.com',
  committerEmail: '76871306+BasiMontes@users.noreply.github.com',
  subject: 'fix(FRESCO-1): something (#12)',
  files: ['lib/x.ts'],
};

describe('evaluatePromotion, staging run', () => {
  test('passes with a green run and a clean commit', () => {
    expect(evaluatePromotion({ runs: [green], commits: [clean] })).toEqual([]);
  });

  test('refuses a red run', () => {
    const problems = evaluatePromotion({ runs: [{ status: 'completed', conclusion: 'failure' }], commits: [clean] });
    expect(problems.map(p => p.kind)).toEqual(['run']);
    expect(problems[0].message).toContain('failure');
  });

  test('refuses a pending run, the case that slipped through on the day of the audit', () => {
    const problems = evaluatePromotion({ runs: [{ status: 'queued', conclusion: null }], commits: [clean] });
    expect(problems[0].message).toContain('queued');
  });

  test('refuses a SHA with no run at all', () => {
    expect(evaluatePromotion({ runs: [], commits: [clean] })[0].message).toContain('no pr-check.yml run');
  });

  test('judges only the latest run, so a green re-run after a red one passes', () => {
    expect(evaluatePromotion({ runs: [green, { status: 'completed', conclusion: 'failure' }], commits: [clean] })).toEqual([]);
  });
});

describe('evaluatePromotion, commits', () => {
  test('refuses a placeholder author or committer', () => {
    const problems = evaluatePromotion({ runs: [green], commits: [{ ...clean, authorEmail: 'test@example.com' }] });
    expect(problems.map(p => p.kind)).toEqual(['identity']);
    const committer = evaluatePromotion({ runs: [green], commits: [{ ...clean, committerEmail: 'x@EXAMPLE.com' }] });
    expect(committer.map(p => p.kind)).toEqual(['identity']);
  });

  test('refuses a code commit with no (#PR)', () => {
    const problems = evaluatePromotion({ runs: [green], commits: [{ ...clean, subject: 'fix: direct', files: ['lib/x.ts'] }] });
    expect(problems.map(p => p.kind)).toEqual(['pull-request']);
  });

  test('lets a docs-only commit without (#PR) through, per docs_changes: direct-to-main-ok', () => {
    const docs = { ...clean, subject: 'docs: bitacora FRESCO-1', files: ['.context/bitacora.md'] };
    expect(evaluatePromotion({ runs: [green], commits: [docs] })).toEqual([]);
  });

  test('reports a commit with both problems twice', () => {
    const bad = { ...clean, authorEmail: 'test@example.com', subject: 'fix: direct' };
    expect(evaluatePromotion({ runs: [green], commits: [bad] }).map(p => p.kind)).toEqual(['identity', 'pull-request']);
  });
});

describe('applyOverride', () => {
  const problems = [
    { kind: 'run' as const, message: 'flake' },
    { kind: 'pull-request' as const, message: 'no pr' },
    { kind: 'identity' as const, message: 'example.com' },
  ];

  test('without a reason keeps every problem', () => {
    expect(applyOverride(problems, undefined)).toEqual(problems);
    expect(applyOverride(problems, '   ')).toEqual(problems);
  });

  test('with a reason waives run and pull-request problems but never identity', () => {
    expect(applyOverride(problems, 'flake confirmed after re-run').map(p => p.kind)).toEqual(['identity']);
  });
});

describe('helpers', () => {
  test('isDocsOnly follows the docs_changes policy paths', () => {
    expect(isDocsOnly(['docs/a.md', '.context/b.md', 'README.md', '.agents/x/SKILL.md'])).toBe(true);
    expect(isDocsOnly(['docs/a.md', 'lib/x.ts'])).toBe(false);
    expect(isDocsOnly([])).toBe(false);
  });

  test('hasPullRequestRef needs the (#N) suffix of a squash merge', () => {
    expect(hasPullRequestRef('feat(FRESCO-1): x (#472)')).toBe(true);
    expect(hasPullRequestRef('feat: mentions #472 in the middle')).toBe(false);
  });
});
