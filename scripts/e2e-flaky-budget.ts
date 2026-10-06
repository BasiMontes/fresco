#!/usr/bin/env bun
/**
 * e2e-flaky-budget.ts — FRESCO-797 (audit-6 A6-T7)
 *
 * `retries: 1` in CI keeps a flaky scenario green, so a flake costs nothing
 * until it grows: about 12 % of recent runs had one flaky scenario and some
 * had two, with no budget and no record. This reads the Playwright JSON report
 * the CI run writes, lists every scenario that needed a retry in the job
 * summary, warns from the first one and FAILS the job from the third.
 *
 * ## The budget
 *
 *   flaky = 0                 nothing to say
 *   1 <= flaky < FAIL_AT      a warning annotation + a table in the summary
 *   flaky >= FAIL_AT          the job fails
 *
 * `FAIL_AT` is 3 on purpose: audit-6 saw at most 2, so today's runs stay
 * green, while a suite that degrades to 3 stops hiding behind its retry.
 * Raise or lower it here, in the same PR that explains why.
 *
 * Each warning is a ticket to open: a flake is a defect of the test or of the
 * app, not noise (`definition-of-done.md`, "Flaky e2e scenario").
 *
 * ## Usage
 *
 *   bun scripts/e2e-flaky-budget.ts [report.json] [--require-report]
 *
 * Without `--require-report` a missing report is a notice, not an error (the
 * run may have died before writing one and the real failure is already red).
 * With it, a missing report fails: when e2e passed there MUST be a report, or
 * the budget would be silently skipped.
 */

import { appendFile } from 'node:fs/promises';

export const WARN_AT = 1;
export const FAIL_AT = 3;
export const DEFAULT_REPORT = 'test-results/e2e-results.json';

interface JsonTest { status?: string, projectName?: string, results?: { retry?: number }[] }
interface JsonSpec { title: string, file?: string, tests?: JsonTest[] }
interface JsonSuite { title?: string, file?: string, specs?: JsonSpec[], suites?: JsonSuite[] }
export interface PlaywrightJsonReport { suites?: JsonSuite[] }

export interface FlakyTest { title: string, file: string, project: string, retries: number }

function walk(suite: JsonSuite, found: FlakyTest[]): void {
  for (const spec of suite.specs ?? []) {
    for (const test of spec.tests ?? []) {
      if (test.status === 'flaky') {
        found.push({
          title: spec.title,
          file: spec.file ?? suite.file ?? '',
          project: test.projectName ?? '',
          retries: Math.max(0, ...(test.results ?? []).map(r => r.retry ?? 0)),
        });
      }
    }
  }
  for (const child of suite.suites ?? []) {
    walk(child, found);
  }
}

/** Every scenario Playwright marked `flaky` (failed, then passed on a retry). */
export function findFlaky(report: PlaywrightJsonReport): FlakyTest[] {
  const found: FlakyTest[] = [];
  for (const suite of report.suites ?? []) {
    walk(suite, found);
  }
  return found;
}

export type BudgetVerdict = 'ok' | 'warn' | 'fail';

export function verdictFor(flaky: number): BudgetVerdict {
  if (flaky >= FAIL_AT) { return 'fail'; }
  if (flaky >= WARN_AT) { return 'warn'; }
  return 'ok';
}

export function renderSummary(flaky: FlakyTest[]): string {
  const verdict = verdictFor(flaky.length);
  const head = `### e2e flakiness budget\n\nFlaky scenarios (failed, then passed on retry): **${flaky.length}** (warn from ${WARN_AT}, fail from ${FAIL_AT}).`;
  if (flaky.length === 0) {
    return `${head}\n`;
  }
  const rows = flaky.map(f => `| ${f.title.replace(/\|/g, '\\|')} | \`${f.file}\` | ${f.project} |`).join('\n');
  const next = verdict === 'fail'
    ? 'Over the budget: the job fails. Fix or quarantine the scenarios below before merging.'
    : 'Open a ticket per scenario below. A flake is a defect, not noise.';
  return `${head}\n\n${next}\n\n| Scenario | File | Project |\n|---|---|---|\n${rows}\n`;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const requireReport = args.includes('--require-report');
  const path = args.find(a => !a.startsWith('--')) ?? DEFAULT_REPORT;

  const file = Bun.file(path);
  if (!(await file.exists())) {
    const message = `e2e flakiness budget: no report at ${path}`;
    if (requireReport) {
      console.error(`::error::${message} (e2e passed, so the budget cannot be skipped)`);
      process.exit(1);
    }
    console.log(`::notice::${message}`);
    return;
  }

  const flaky = findFlaky(await file.json() as PlaywrightJsonReport);
  const summary = renderSummary(flaky);
  console.log(summary);
  if (process.env.GITHUB_STEP_SUMMARY) {
    await appendFile(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`);
  }

  const verdict = verdictFor(flaky.length);
  for (const f of flaky) {
    console.log(`::warning file=${f.file}::flaky e2e scenario (passed on retry): ${f.title}`);
  }
  if (verdict === 'fail') {
    console.error(`::error::e2e flakiness budget exceeded: ${flaky.length} flaky scenarios (limit ${FAIL_AT - 1})`);
    process.exit(1);
  }
}

if (import.meta.main) {
  await main();
}
