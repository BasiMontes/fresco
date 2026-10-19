import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, test } from 'bun:test';
import { parse } from 'yaml';

/**
 * FRESCO-1016 (A7-TEST-09) — a hung `wait-on` or Playwright run used to burn up to 360 minutes of the Actions
 * budget because only one step in all of CI had a timeout. Every job of every workflow now declares
 * `timeout-minutes`, and none is allowed to be more than an hour.
 */
const DIR = new URL('../.github/workflows/', import.meta.url);
const MAX_MINUTES = 60;

interface Job { 'timeout-minutes'?: unknown, 'uses'?: string }
const workflows = readdirSync(DIR).filter(file => file.endsWith('.yml')).map(file => ({
  file,
  jobs: Object.entries((parse(readFileSync(new URL(file, DIR), 'utf8')) as { jobs?: Record<string, Job> }).jobs ?? {}),
}));

describe('workflow job timeouts', () => {
  test('there are workflows to check', () => {
    expect(workflows.length).toBeGreaterThan(10);
  });

  test.each(workflows)('$file: every job has a timeout-minutes between 1 and an hour', ({ jobs }) => {
    for (const [name, job] of jobs) {
      if (job.uses) { continue; } // a reusable workflow carries its own
      const minutes = job['timeout-minutes'];
      expect(typeof minutes, `job "${name}" has no timeout-minutes`).toBe('number');
      expect(minutes as number, `job "${name}"`).toBeGreaterThanOrEqual(1);
      expect(minutes as number, `job "${name}"`).toBeLessThanOrEqual(MAX_MINUTES);
    }
  });

  test('the post-deploy smoke fails the run when a test user cannot be deleted', () => {
    const smoke = readFileSync(new URL('post-deploy-smoke.yml', DIR), 'utf8');

    expect(smoke).toContain('E2E_STRICT_CLEANUP: \'1\'');
  });
});
