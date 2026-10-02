import { describe, expect, test } from 'bun:test';
import { diffRequiredChecks, mergeRequiredChecks, parseDeclaredChecks } from './required-checks';

/**
 * FRESCO-781 (audit-6 A6-T3 + A6-D4) — `git:policy` does not model
 * `required_status_checks` (it carries them forward untouched), and they live
 * in the classic branch protection, so the declared list and the host drifted
 * silently: `test:db-integration` and `deno:check` ran on every PR but were not
 * required, and a PR could merge with both red. These pure helpers back
 * `bun run git:checks verify|apply`.
 */

describe('diffRequiredChecks', () => {
  test('reports declared checks the host does not require as missing', () => {
    expect(diffRequiredChecks(['a', 'b', 'c'], ['a'])).toEqual({ missing: ['b', 'c'], extra: [] });
  });

  test('reports required checks nobody declared as extra, informationally', () => {
    expect(diffRequiredChecks(['a'], ['a', 'z'])).toEqual({ missing: [], extra: ['z'] });
  });

  test('is clean when both sides agree, regardless of order', () => {
    expect(diffRequiredChecks(['a', 'b'], ['b', 'a'])).toEqual({ missing: [], extra: [] });
  });
});

describe('mergeRequiredChecks', () => {
  test('keeps every check already required and appends the missing ones', () => {
    expect(mergeRequiredChecks(['x', 'a'], ['a', 'b'])).toEqual(['x', 'a', 'b']);
  });

  test('never removes a check the host requires, even when it is not declared', () => {
    expect(mergeRequiredChecks(['legacy'], ['a'])).toContain('legacy');
  });

  test('does not duplicate', () => {
    expect(mergeRequiredChecks(['a'], ['a', 'a'])).toEqual(['a']);
  });
});

describe('parseDeclaredChecks', () => {
  test('reads the list from the strategy policy', () => {
    expect(parseDeclaredChecks({ policy: { required_checks: ['a', 'b'] } })).toEqual(['a', 'b']);
  });

  test('refuses an absent or empty declaration rather than treating it as "nothing required"', () => {
    expect(() => parseDeclaredChecks({ policy: {} })).toThrow(/required_checks/);
    expect(() => parseDeclaredChecks({ policy: { required_checks: [] } })).toThrow(/required_checks/);
    expect(() => parseDeclaredChecks({})).toThrow(/required_checks/);
  });

  test('refuses entries that are not non-empty strings', () => {
    expect(() => parseDeclaredChecks({ policy: { required_checks: ['a', 3 as unknown as string] } })).toThrow(/required_checks/);
  });
});
