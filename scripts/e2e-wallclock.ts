#!/usr/bin/env bun
/**
 * E2E wall-clock check: `bun run ci:e2e-wallclock [--limit N]`.
 *
 * FRESCO-1280 (audit 10 finding F10). ADR-0018 made the `test:e2e` job wall-clock the binding trigger for the
 * parallelism work: an early warning when two consecutive runs on the promotion path pass ~6m30s, a hard trigger
 * at ~8m. Nothing measured it, and `audit-process.md` quoted a number that goes stale. This script reads the
 * last green `test:e2e` jobs of the `staging` pushes from GitHub Actions (the runs `git:promote` gates on),
 * prints their durations and says whether the trigger fired.
 *
 * Read only: it never writes to GitHub and the CI workflow is untouched (the workflow keeps `contents: read`).
 * Exit 0 = no two consecutive runs above the early-warning; 1 = early-warning or hard trigger fired; 2 = it could
 * not tell (GitHub unreachable or fewer than two green runs), which is never read as "fine".
 *
 * A window is the last N green runs (default 12). Any two adjacent runs in the window that are both ABOVE a
 * threshold count; a failed `test:e2e` is skipped because a red run's duration says nothing about the suite.
 * This script is project-owned, `bun run up` does not overwrite it.
 */

import process from 'node:process';

import pc from 'picocolors';

/** ADR-0018 early warning: ~6m30s sustained, begin the parallelism work. */
export const EARLY_WARNING_SECONDS = 390;
/** ADR-0018 hard trigger: ~8m sustained, the migration lands before more `@automatizado` scenarios. */
export const HARD_TRIGGER_SECONDS = 480;

const WORKFLOW = 'pr-check.yml';
const JOB_NAME = 'test:e2e';
const DEFAULT_LIMIT = 12;

export interface E2eRun {
  runId: number
  finishedAt: string
  seconds: number
}

export type Verdict = 'ok' | 'early-warning' | 'hard-trigger' | 'insufficient-data';

export interface Thresholds {
  early: number
  hard: number
}

export interface Evaluation {
  verdict: Verdict
  mean: number
  max: number
}

const DEFAULT_THRESHOLDS: Thresholds = { early: EARLY_WARNING_SECONDS, hard: HARD_TRIGGER_SECONDS };

/** `370` -> `6m10s`, `59` -> `59s`. */
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const rest = seconds % 60;
  return `${Math.floor(seconds / 60)}m${String(rest).padStart(2, '0')}s`;
}

/** Whether two ADJACENT runs of the window are both strictly above `limit` (a run exactly at it has not crossed it). */
function hasConsecutivePairAbove(runs: readonly E2eRun[], limit: number): boolean {
  return runs.some((run, index) => index > 0 && run.seconds > limit && runs[index - 1].seconds > limit);
}

/**
 * The verdict for a window of green runs (order does not matter: adjacency is symmetric). Fewer than two runs cannot
 * show a sustained crossing, so the answer is `insufficient-data`, never `ok`.
 */
export function evaluateWallclock(runs: readonly E2eRun[], thresholds: Thresholds = DEFAULT_THRESHOLDS): Evaluation {
  if (runs.length < 2) {
    return { verdict: 'insufficient-data', mean: runs[0]?.seconds ?? 0, max: runs[0]?.seconds ?? 0 };
  }

  const seconds = runs.map(run => run.seconds);
  const mean = Math.round(seconds.reduce((sum, value) => sum + value, 0) / seconds.length);
  const max = Math.max(...seconds);

  if (hasConsecutivePairAbove(runs, thresholds.hard)) {
    return { verdict: 'hard-trigger', mean, max };
  }
  if (hasConsecutivePairAbove(runs, thresholds.early)) {
    return { verdict: 'early-warning', mean, max };
  }
  return { verdict: 'ok', mean, max };
}

/** `--limit N`, at least 2 (a pair is the smallest sustained crossing). */
export function parseLimit(argv: readonly string[]): number {
  const index = argv.indexOf('--limit');
  if (index === -1) {
    return DEFAULT_LIMIT;
  }
  const value = Number(argv[index + 1]);
  if (!Number.isInteger(value) || value < 2) {
    throw new Error('--limit needs an integer of at least 2');
  }
  return value;
}

function gh(args: string[]): string {
  const result = Bun.spawnSync(['gh', ...args], { stdout: 'pipe', stderr: 'pipe' });
  if (result.exitCode !== 0) {
    throw new Error(`gh ${args.slice(0, 2).join(' ')} failed: ${result.stderr.toString().trim()}`);
  }
  return result.stdout.toString();
}

interface RunSummary { databaseId: number }
interface JobsPayload { jobs: { name: string, conclusion: string | null, started_at: string, completed_at: string }[] }

/** The last `limit` green `test:e2e` jobs of the `staging` push runs, newest first. */
function readGreenRuns(limit: number): E2eRun[] {
  const listed = JSON.parse(gh([
    'run',
    'list',
    '--workflow',
    WORKFLOW,
    '--branch',
    'staging',
    '--event',
    'push',
    '--status',
    'completed',
    '--limit',
    String(limit * 3),
    '--json',
    'databaseId',
  ])) as RunSummary[];

  const runs: E2eRun[] = [];
  for (const { databaseId } of listed) {
    if (runs.length === limit) {
      break;
    }
    const payload = JSON.parse(gh(['api', `repos/{owner}/{repo}/actions/runs/${databaseId}/jobs`])) as JobsPayload;
    const job = payload.jobs.find(candidate => candidate.name === JOB_NAME && candidate.conclusion === 'success');
    if (job) {
      runs.push({
        runId: databaseId,
        finishedAt: job.completed_at,
        seconds: Math.round((Date.parse(job.completed_at) - Date.parse(job.started_at)) / 1000),
      });
    }
  }
  return runs;
}

function printReport(runs: readonly E2eRun[], evaluation: Evaluation): void {
  console.log(pc.bold(`${JOB_NAME} wall-clock on staging (last ${runs.length} green runs, newest first)`));
  for (const run of runs) {
    const tone = run.seconds > HARD_TRIGGER_SECONDS ? pc.red : run.seconds > EARLY_WARNING_SECONDS ? pc.yellow : pc.green;
    console.log(`  ${run.runId}  ${run.finishedAt.slice(0, 16).replace('T', ' ')}Z  ${tone(formatDuration(run.seconds).padStart(6))}`);
  }
  console.log(`mean ${formatDuration(evaluation.mean)}, max ${formatDuration(evaluation.max)}; early-warning ${formatDuration(EARLY_WARNING_SECONDS)}, hard ${formatDuration(HARD_TRIGGER_SECONDS)} (ADR-0018)`);
}

const EXIT_CODE: Record<Verdict, number> = { 'ok': 0, 'early-warning': 1, 'hard-trigger': 1, 'insufficient-data': 2 };

const MESSAGE: Record<Verdict, string> = {
  'ok': `${pc.green('✔')} No two consecutive runs above ${formatDuration(EARLY_WARNING_SECONDS)}.`,
  'early-warning': `${pc.yellow('▲')} Early warning: two consecutive runs above ${formatDuration(EARLY_WARNING_SECONDS)}. ADR-0018: start the parallelism work, do not wait for pain.`,
  'hard-trigger': `${pc.red('✖')} Hard trigger: two consecutive runs above ${formatDuration(HARD_TRIGGER_SECONDS)}. ADR-0018: the migration lands before any further @automatizado scenario.`,
  'insufficient-data': `${pc.red('✖')} Fewer than two green ${JOB_NAME} runs found: cannot tell. Widen --limit or check that \`gh\` is signed in.`,
};

function main(): void {
  let runs: E2eRun[];
  try {
    runs = readGreenRuns(parseLimit(process.argv.slice(2)));
  }
  catch (error) {
    console.error(`${pc.red('✖')} ${error instanceof Error ? error.message : String(error)}`);
    process.exit(2);
  }

  const evaluation = evaluateWallclock(runs);
  printReport(runs, evaluation);
  console.log(MESSAGE[evaluation.verdict]);
  process.exit(EXIT_CODE[evaluation.verdict]);
}

if (import.meta.main) {
  main();
}
