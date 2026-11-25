#!/usr/bin/env bun
/**
 * Manual-scenario guarantee check: `bun run qa:manual-stale [--today YYYY-MM-DD]`.
 *
 * FRESCO-1289 (audit 11 F5). `.context/qa/regression.feature` keeps scenarios that are checked by hand
 * (`@solo-manual`). Its own rule says a `@verificado-manual-YYYY-MM-DD` date older than 6 weeks is no longer a
 * current guarantee, and nothing listed those: the audit recounted 42 expired, 16 undated and 1 current by
 * reading the file. This prints that list in one screen.
 *
 * A manual scenario counts as guaranteed when ANY of these holds, checked in this order:
 *   - guarded: a comment line `# Cubierto por: <path>[, <path>]` names a test file that exists. The cheapest test
 *     that covers the risk is the guarantee, so the date stops mattering.
 *   - current: its `@verificado-manual-` date is not older than 6 weeks (42 days).
 * Otherwise it is `expired` (a date older than 6 weeks) or `undated` (no date, no guard). A `Cubierto por:` that
 * names a file which does not exist is reported as `broken-guard`, never as guarded.
 *
 * A NOTICE, never a blocker: the exit code is always 0. `.context/audits/audit-process.md` section 8 asks each
 * pass to run it. `@automatizado` scenarios are exempt (a test is their guarantee). Project-owned: `bun run up`
 * does not overwrite this script.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

import picocolors from 'picocolors';

// Colour only for a person at a terminal (picocolors would colour a pipe whenever `CI` is set).
const pc = picocolors.createColors(Boolean(process.stdout.isTTY) && !process.env.NO_COLOR);

const FEATURE = '.context/qa/regression.feature';
/** A date older than this many days is no longer a current guarantee (README, 6 weeks). */
export const MAX_AGE_DAYS = 42;

export interface ScenarioInfo {
  /** 1-based line of the `Escenario:` keyword. */
  line: number
  name: string
  tags: string[]
  comments: string[]
}

export type Status = 'guarded' | 'current' | 'expired' | 'undated' | 'broken-guard';

export interface Evaluation {
  scenario: ScenarioInfo
  status: Status
  /** The `@verificado-manual-` day, when there is one. */
  verified: string | null
  guards: string[]
  missingGuards: string[]
}

// ---------------------------------------------------------------------------
// Pure helpers (unit-tested in manual-scenarios.test.ts)
// ---------------------------------------------------------------------------

/** Every `Escenario:` of a feature file, with the tags above it and the comment lines between the tags and it. */
export function parseScenarios(text: string): ScenarioInfo[] {
  const scenarios: ScenarioInfo[] = [];
  let tags: string[] = [];
  let comments: string[] = [];
  const lines = text.split('\n');
  for (const [index, raw] of lines.entries()) {
    const line = raw.trim();
    if (line.startsWith('@')) {
      // A tag line right after comments starts a new scenario header: what came before belonged to a section.
      if (comments.length > 0) { tags = []; comments = []; }
      tags.push(...line.split(/\s+/).map(tag => tag.replace(/^@/, '')));
    }
    else if (line.startsWith('#')) {
      if (tags.length > 0) { comments.push(line.replace(/^#\s?/, '')); }
    }
    else if (line.startsWith('Escenario:')) {
      scenarios.push({ line: index + 1, name: line.slice('Escenario:'.length).trim(), tags, comments });
      tags = [];
      comments = [];
    }
    else if (line.startsWith('Característica:') || line.startsWith('Antecedentes:')) {
      tags = [];
      comments = [];
    }
  }
  return scenarios;
}

/** The newest `@verificado-manual-YYYY-MM-DD` day among a scenario's tags. */
export function verifiedDay(tags: readonly string[]): string | null {
  const days = tags.flatMap((tag) => {
    const match = /^verificado-manual-(\d{4}-\d{2}-\d{2})$/.exec(tag);
    return match ? [match[1]] : [];
  });
  return days.length === 0 ? null : days.reduce((newest, day) => (day > newest ? day : newest));
}

/** Paths named by `Cubierto por: a, b` comment lines, backticks stripped. */
export function guardPaths(comments: readonly string[]): string[] {
  return comments.flatMap((comment) => {
    const match = /Cubierto por:\s*(\S.*)$/.exec(comment);
    if (!match) { return []; }
    return match[1].split(',').map(path => path.replace(/[`*]/g, '').replace(/\s*\(.*$/, '').trim()).filter(Boolean);
  });
}

/** Whole days from `from` to `to` (both `YYYY-MM-DD`, UTC). */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** Judges one manual scenario. `fileExists` is injected so the rule is testable without a disk. */
export function evaluate(scenario: ScenarioInfo, today: string, fileExists: (path: string) => boolean): Evaluation {
  const verified = verifiedDay(scenario.tags);
  const guards = guardPaths(scenario.comments);
  const missingGuards = guards.filter(path => !fileExists(path));
  const base = { scenario, verified, guards, missingGuards };
  if (guards.length > 0) {
    return { ...base, status: missingGuards.length === 0 ? 'guarded' : 'broken-guard' };
  }
  if (verified === null) { return { ...base, status: 'undated' }; }
  return { ...base, status: daysBetween(verified, today) > MAX_AGE_DAYS ? 'expired' : 'current' };
}

/** The scenarios this check judges: manual ones. `@automatizado` is exempt, a test is its guarantee. */
export function isManual(scenario: ScenarioInfo): boolean {
  if (scenario.tags.includes('automatizado')) { return false; }
  return scenario.tags.includes('solo-manual') || verifiedDay(scenario.tags) !== null;
}

export function summarize(evaluations: readonly Evaluation[]): Record<Status, number> {
  const counts: Record<Status, number> = { 'guarded': 0, 'current': 0, 'expired': 0, 'undated': 0, 'broken-guard': 0 };
  for (const evaluation of evaluations) { counts[evaluation.status]++; }
  return counts;
}

// ---------------------------------------------------------------------------
// Command
// ---------------------------------------------------------------------------

function todayArg(): string {
  const index = process.argv.indexOf('--today');
  const given = index === -1 ? undefined : process.argv[index + 1];
  return given && /^\d{4}-\d{2}-\d{2}$/.test(given) ? given : new Date().toISOString().slice(0, 10);
}

function main(): number {
  const root = join(import.meta.dir, '..', '..');
  const today = todayArg();
  const evaluations = parseScenarios(readFileSync(join(root, FEATURE), 'utf8'))
    .filter(isManual)
    .map(scenario => evaluate(scenario, today, path => existsSync(join(root, path))));
  const counts = summarize(evaluations);

  console.log(pc.bold(`\nManual scenarios: guarantee as of ${today} (a notice, never a failure)`));
  console.log('='.repeat(64));
  console.log(`${evaluations.length} manual scenarios in ${FEATURE}`);
  console.log(`  ${pc.green('✔')} guarded by a test      ${counts.guarded}`);
  console.log(`  ${pc.green('✔')} verified, under ${MAX_AGE_DAYS} days  ${counts.current}`);
  console.log(`  ${pc.yellow('!')} expired                ${counts.expired}`);
  console.log(`  ${pc.yellow('!')} undated                ${counts.undated}`);
  console.log(`  ${pc.yellow('!')} guard names no file    ${counts['broken-guard']}`);

  for (const status of ['broken-guard', 'expired', 'undated'] as const) {
    const rows = evaluations.filter(evaluation => evaluation.status === status);
    if (rows.length === 0) { continue; }
    console.log(`\n${pc.bold(status)} (${rows.length})`);
    for (const row of rows) {
      const detail = status === 'expired'
        ? `verified ${row.verified} (${daysBetween(row.verified ?? today, today)} days ago)`
        : status === 'broken-guard' ? `missing: ${row.missingGuards.join(', ')}` : 'no date, no guard';
      console.log(`  ${FEATURE}:${row.scenario.line}  ${row.scenario.name.slice(0, 70)}  [${detail}]`);
    }
  }
  const stale = counts.expired + counts.undated + counts['broken-guard'];
  console.log(stale === 0
    ? `\n${pc.green('✔')} every manual scenario has a current guarantee.`
    : `\n${pc.yellow('!')} ${stale} manual scenario(s) have no current guarantee. A notice: re-verify it, guard it with a test, or automate it.`);
  return 0;
}

if (import.meta.main) {
  process.exit(main());
}
