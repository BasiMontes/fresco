import type { PlaywrightJsonReport } from './e2e-flaky-budget';
import { describe, expect, test } from 'bun:test';
import { FAIL_AT, findFlaky, renderSummary, verdictFor, WARN_AT } from './e2e-flaky-budget';

const report: PlaywrightJsonReport = {
  suites: [{
    title: 'regression.feature',
    file: 'regression.feature',
    suites: [{
      title: 'Compra',
      specs: [
        { title: 'pasa a la primera', file: 'a.spec.ts', tests: [{ status: 'expected', projectName: 'chromium', results: [{ retry: 0 }] }] },
        { title: 'pasa tras reintento', file: 'b.spec.ts', tests: [{ status: 'flaky', projectName: 'chromium', results: [{ retry: 0 }, { retry: 1 }] }] },
        { title: 'falla siempre', file: 'c.spec.ts', tests: [{ status: 'unexpected', projectName: 'chromium', results: [{ retry: 0 }, { retry: 1 }] }] },
      ],
    }],
  }],
};

describe('findFlaky', () => {
  test('counts only the scenarios that failed and then passed on a retry, in nested suites', () => {
    expect(findFlaky(report)).toEqual([{ title: 'pasa tras reintento', file: 'b.spec.ts', project: 'chromium', retries: 1 }]);
  });

  test('an empty or missing report has no flaky scenario', () => {
    expect(findFlaky({})).toEqual([]);
    expect(findFlaky({ suites: [] })).toEqual([]);
  });
});

describe('verdictFor', () => {
  test('is silent at 0, warns from WARN_AT and fails from FAIL_AT', () => {
    expect(verdictFor(0)).toBe('ok');
    expect(verdictFor(WARN_AT)).toBe('warn');
    expect(verdictFor(FAIL_AT - 1)).toBe('warn');
    expect(verdictFor(FAIL_AT)).toBe('fail');
    expect(verdictFor(FAIL_AT + 5)).toBe('fail');
  });

  test('keeps the agreed budget: warn at 1, fail at 3', () => {
    expect([WARN_AT, FAIL_AT]).toEqual([1, 3]);
  });
});

describe('renderSummary', () => {
  test('states the count and lists each flaky scenario', () => {
    const text = renderSummary(findFlaky(report));
    expect(text).toContain('**1**');
    expect(text).toContain('pasa tras reintento');
    expect(text).toContain('Open a ticket per scenario');
  });

  test('says the job fails when over the budget', () => {
    const many = Array.from({ length: FAIL_AT }, (_, i) => ({ title: `s${i}`, file: 'x.spec.ts', project: 'chromium', retries: 1 }));
    expect(renderSummary(many)).toContain('the job fails');
  });

  test('prints no table when nothing was flaky', () => {
    expect(renderSummary([])).not.toContain('| Scenario |');
  });
});
