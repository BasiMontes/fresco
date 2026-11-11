import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'bun:test';
import { parse } from 'yaml';

/**
 * FRESCO-1017 (audit 7b, A7-SUPPLY-03/05): pins the hardening of `refresh-mercadona-catalog.yml`.
 *
 * The job installs dependencies and runs generators over a downloaded dataset before it ever needs to
 * push. A token persisted in `.git/config` by `actions/checkout` is readable by all of that, so the
 * checkout keeps no credentials and the personal access token reaches only the last step. The dataset
 * is read at one commit SHA that the freshness check resolves, not at whatever `main` is by then.
 */

const WORKFLOW = '.github/workflows/refresh-mercadona-catalog.yml';
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

const workflow = parse(readFileSync(WORKFLOW, 'utf8')) as { jobs: { refresh: { steps: Step[], permissions?: Record<string, string> } } };
const steps = workflow.jobs.refresh.steps;
const usesToken = (step: Step) => JSON.stringify(step).includes(TOKEN);

/** A GitHub Actions expression and a shell variable, as the workflow file spells them. */
const ghExpr = (inner: string) => `\${{ ${inner} }}`;
const shellVar = (name: string) => `\${${name}}`;

describe('refresh-mercadona-catalog.yml', () => {
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

  test('the push carries the token in the URL, because the checkout persisted none', () => {
    const [prStep] = steps.filter(usesToken);

    expect(prStep.run).toContain(`x-access-token:${shellVar('GH_TOKEN')}@github.com`);
    expect(prStep.run).not.toMatch(/git push origin\b/);
  });

  test('the PR names its head branch, because a push by URL leaves no upstream for gh to infer it from', () => {
    const [prStep] = steps.filter(usesToken);

    expect(prStep.run).toMatch(/gh pr create[^\n]*--head "\$branch"/);
  });

  test('the freshness check resolves the revision and the generator reads exactly that one', () => {
    const freshness = steps.find(step => step.run?.includes('check-mercadona-dataset-freshness'));
    const generator = steps.find(step => step.run?.includes('gen-mercadona-catalog'));

    expect(freshness?.id).toBe('freshness');
    expect(generator?.env?.MERCADONA_DATASET_REVISION).toBe(ghExpr('steps.freshness.outputs.revision'));
  });

  test('the freshness check runs before the generator', () => {
    const indexOf = (needle: string) => steps.findIndex(step => step.run?.includes(needle));

    expect(indexOf('check-mercadona-dataset-freshness')).toBeGreaterThanOrEqual(0);
    expect(indexOf('check-mercadona-dataset-freshness')).toBeLessThan(indexOf('gen-mercadona-catalog'));
  });

  test('the PR body names the revision so the reviewer can open that tree', () => {
    const [prStep] = steps.filter(usesToken);

    expect(prStep.env?.DATASET_REVISION).toBe(ghExpr('steps.freshness.outputs.revision'));
    expect(prStep.run).toContain(`huggingface.co/datasets/datania/mercadona-catalog/tree/${shellVar('DATASET_REVISION')}`);
  });

  /** FRESCO-1181: a run that failed, or was blocked by an open refresh PR, must raise an issue. */
  describe('failures are seen (FRESCO-1181)', () => {
    const alert = steps.find(step => step.if === 'failure()');
    const [prStep] = steps.filter(usesToken);

    test('a failed run opens an issue, or comments on the one that is open, with the repo token and write access to issues', () => {
      expect(alert).toBeDefined();
      expect(alert?.run).toContain('gh issue list');
      expect(alert?.run).toContain('gh issue comment');
      expect(alert?.run).toContain('gh issue create');
      expect(workflow.jobs.refresh.permissions?.issues).toBe('write');
      // The alert uses the repo's own token, never the personal one.
      expect(usesToken(alert as Step)).toBe(false);
      expect(alert?.env?.GH_TOKEN).toBe(ghExpr('github.token'));
    });

    test('the alert is the last step, so it sees a failure of any step before it', () => {
      expect(steps.at(-1)).toBe(alert);
    });

    test('a refresh PR that is already open fails the run instead of ending it green', () => {
      const branch = (prStep.run ?? '').split('\n').findIndex(line => line.includes('A refresh PR is already open.'));
      const lines = (prStep.run ?? '').split('\n');

      expect(branch).toBeGreaterThan(0);
      expect(lines.slice(branch - 3, branch + 3).join('\n')).toContain('exit 1');
      expect(lines.slice(branch - 3, branch + 3).join('\n')).not.toContain('exit 0');
      expect(lines.slice(branch - 3, branch + 3).join('\n')).toContain('::error::');
    });

    test('"no price changes" is still a green run: nothing to merge is not a failure', () => {
      const lines = (prStep.run ?? '').split('\n');
      const noChanges = lines.findIndex(line => line.includes('No price changes.'));

      expect(noChanges).toBeGreaterThan(0);
      expect(lines[noChanges + 1]).toContain('exit 0');
    });

    test('the commit and the push run with husky off, and nothing builds the alias that only the hook needed', () => {
      expect(prStep.env?.HUSKY).toBe('0');
      expect(steps.some(step => step.run?.includes('agents:compat'))).toBe(false);
    });
  });
});
