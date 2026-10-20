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

const workflow = parse(readFileSync(WORKFLOW, 'utf8')) as { jobs: { refresh: { steps: Step[] } } };
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
});
