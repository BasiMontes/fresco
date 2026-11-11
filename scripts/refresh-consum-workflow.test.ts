import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'bun:test';
import { parse } from 'yaml';

/**
 * FRESCO-1192: pins `refresh-consum-catalog.yml`, the weekly refresh of
 * `lib/grocery/consum-catalog.generated.ts`.
 *
 * Consum prices stop showing 30 days after the file's date (FRESCO-1028), and the file dates the day the
 * generator read them (FRESCO-1177), so without a scheduled run they all disappear. The job follows the
 * hardening of the Mercadona one (FRESCO-1017): no credentials persisted by the checkout, the personal
 * token only in the step that opens the PR. It adds what a source we call ourselves needs (ADR-0037): a
 * low, paused request rate is the generator's job, and a failed run must raise an issue instead of dying
 * silently, or the 30 days run out unseen.
 */

const WORKFLOW = '.github/workflows/refresh-consum-catalog.yml';
const TOKEN = 'secrets.CATALOG_REFRESH_TOKEN';

interface Step {
  id?: string
  name?: string
  uses?: string
  run?: string
  with?: Record<string, unknown>
  env?: Record<string, string>
  if?: string
}

interface Workflow {
  on: { schedule?: { cron: string }[], workflow_dispatch?: unknown }
  permissions?: Record<string, string>
  jobs: { refresh: { 'steps': Step[], 'permissions'?: Record<string, string>, 'timeout-minutes'?: number } }
}

const workflow = parse(readFileSync(WORKFLOW, 'utf8')) as Workflow;
const steps = workflow.jobs.refresh.steps;
const usesToken = (step: Step) => JSON.stringify(step).includes(TOKEN);
const indexOf = (needle: string) => steps.findIndex(step => step.run?.includes(needle));

/** A GitHub Actions expression and a shell variable, as the workflow file spells them. */
const ghExpr = (inner: string) => `\${{ ${inner} }}`;
const shellVar = (name: string) => `\${${name}}`;

describe('refresh-consum-catalog.yml', () => {
  test('runs weekly and can be started by hand', () => {
    const [schedule] = workflow.on.schedule ?? [];
    const [minute, hour, dayOfMonth, month, dayOfWeek] = (schedule?.cron ?? '').split(' ');

    expect(schedule).toBeDefined();
    expect(Number.isInteger(Number(minute)) && Number.isInteger(Number(hour))).toBe(true);
    expect([dayOfMonth, month]).toEqual(['*', '*']);
    // One day of the week: a weekly job keeps the file well inside the 14 days before prices are flagged old.
    expect(Number.isInteger(Number(dayOfWeek))).toBe(true);
    expect(workflow.on.workflow_dispatch).toBeDefined();
  });

  test('every checkout keeps no credentials and uses no personal token', () => {
    const checkouts = steps.filter(step => step.uses?.startsWith('actions/checkout@'));

    expect(checkouts.length).toBeGreaterThan(0);
    for (const checkout of checkouts) {
      expect(checkout.with?.['persist-credentials']).toBe(false);
      expect(checkout.with?.token).toBeUndefined();
    }
  });

  test('the personal access token appears in exactly one step: the one that opens the PR', () => {
    const withToken = steps.filter(usesToken);

    expect(withToken).toHaveLength(1);
    expect(withToken[0].run).toContain('gh pr create');
  });

  test('the push carries the token in the URL and the PR names its head branch', () => {
    const [prStep] = steps.filter(usesToken);

    expect(prStep.run).toContain(`x-access-token:${shellVar('GH_TOKEN')}@github.com`);
    expect(prStep.run).not.toMatch(/git push origin\b/);
    expect(prStep.run).toMatch(/gh pr create[^\n]*--head "\$branch"/);
  });

  test('the PR is opened only when the catalog changed, and only one refresh PR is open at a time', () => {
    const [prStep] = steps.filter(usesToken);

    expect(prStep.run).toContain('git diff --quiet');
    expect(prStep.run).toContain('chore/consum-catalog-refresh-');
    expect(prStep.run).toContain('A refresh PR is already open.');
  });

  test('the generator runs before the dictionary, and both before the PR step', () => {
    expect(indexOf('gen-consum-catalog')).toBeGreaterThanOrEqual(0);
    expect(indexOf('gen-consum-catalog')).toBeLessThan(indexOf('gen-grocery-dictionary'));
    expect(indexOf('gen-grocery-dictionary')).toBeLessThan(indexOf('gh pr create'));
  });

  test('the PR commits the catalog and the dictionary built from its pack sizes, nothing else', () => {
    const [prStep] = steps.filter(usesToken);

    expect(prStep.run).toContain('lib/grocery/consum-catalog.generated.ts');
    expect(prStep.run).toContain('lib/grocery/ingredient-dictionary.ts');
    expect(prStep.run).toMatch(/git add \$files/);
  });

  test('the generator output (the list of new, changed and gone entries) reaches the PR body', () => {
    const generator = steps.find(step => step.run?.includes('gen-consum-catalog'));
    const [prStep] = steps.filter(usesToken);

    expect(generator?.run).toContain('tee');
    expect(prStep.run).toContain('--body-file');
  });

  test('a failed run opens one issue, so the 30 days do not run out unseen', () => {
    const alert = steps.find(step => step.if === 'failure()');

    expect(alert).toBeDefined();
    expect(alert?.run).toContain('gh issue create');
    expect(alert?.run).toContain('gh issue list');
    // FRESCO-1196: a second failure while the issue is open is a comment on it, not silence.
    expect(alert?.run).toContain('gh issue comment');
    expect(workflow.jobs.refresh.permissions?.issues).toBe('write');
    // The alert uses the repo's own token, never the personal one.
    expect(usesToken(alert as Step)).toBe(false);
    expect(alert?.env?.GH_TOKEN).toBe(ghExpr('github.token'));
  });

  test('the job cannot run forever', () => {
    expect(workflow.jobs.refresh['timeout-minutes']).toBeLessThanOrEqual(20);
  });

  /** FRESCO-1196: the same two findings FRESCO-1181 fixed for Mercadona. */
  describe('a blocked run is seen and the runner runs no husky hooks (FRESCO-1196)', () => {
    const [prStep] = steps.filter(usesToken);
    const lines = (prStep.run ?? '').split('\n');

    test('a refresh PR that is already open fails the run instead of ending it green', () => {
      const at = lines.findIndex(line => line.includes('A refresh PR is already open.'));
      const around = lines.slice(at - 3, at + 3).join('\n');

      expect(at).toBeGreaterThan(0);
      expect(around).toContain('exit 1');
      expect(around).not.toContain('exit 0');
      expect(around).toContain('::error::');
    });

    test('"no changes" is still a green run', () => {
      const at = lines.findIndex(line => line.includes('No changes.'));

      expect(at).toBeGreaterThan(0);
      expect(lines[at + 1]).toContain('exit 0');
    });

    test('the commit and the push run with husky off, and nothing builds the alias that only the hook needed', () => {
      expect(prStep.env?.HUSKY).toBe('0');
      expect(steps.some(step => step.run?.includes('agents:compat'))).toBe(false);
    });

    test('the alert is the last step, so it sees a failure of any step before it', () => {
      expect(steps.at(-1)?.if).toBe('failure()');
    });
  });
});
