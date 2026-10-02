#!/usr/bin/env bun
/**
 * check-adrs.ts — FRESCO-789 (audit-6 A6-A2 / A6-A10)
 *
 * ADRs drift in three quiet ways, and each one already happened here: a
 * decision sits `Proposed` for weeks while its code ships and other ADRs cite
 * it as in force (0032/0033/0035), two files share a number (two ADR-0002), and
 * the README index — the file every session reads first — stops listing a file.
 *
 * Checks (all of `.context/ADR/ADR-<NNNN>-*.md`, template excluded):
 *   1. No two files share a number (numbers are never reused).
 *   2. The README index links every file.
 *   3. No ADR is `Proposed` for more than 14 days (by its `Date`).
 *   4. The README Status column agrees with the file's status word.
 *
 * Part of `repo:check` (cheap, no network). Usage:
 *   bun scripts/check-adrs.ts      # exit 0 clean, 1 on findings
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const MAX_PROPOSED_DAYS = 14;
const DAY_MS = 86_400_000;

export interface AdrFile {
  name: string
  content: string
}

/** First word of a status line: `Accepted (2026-10-01, founder)` -> `Accepted`. */
export function statusWord(content: string): string | null {
  const match = /^- \*\*Status:\*\*\s*([A-Z][a-z]+)/m.exec(content);
  return match ? match[1] : null;
}

function adrDate(content: string): Date | null {
  const match = /^- \*\*Date:\*\*\s*(\d{4}-\d{2}-\d{2})/m.exec(content);
  return match ? new Date(`${match[1]}T00:00:00Z`) : null;
}

/** README index rows keyed by file name, with the status word of the row. */
function readmeStatuses(readme: string): Map<string, string> {
  const rows = new Map<string, string>();
  for (const line of readme.split('\n')) {
    const link = /^\|\s*\[ADR-\d{4}\]\(\.\/(ADR-\d{4}-[^)]+\.md)\)/.exec(line);
    if (!link) { continue; }
    const cells = line.split('|').map(cell => cell.trim());
    // | ADR | Title | Status | Supersedes | Superseded by |  -> cells[3] is the status
    rows.set(link[1], /^[A-Z][a-z]+/.exec(cells[3] ?? '')?.[0] ?? '');
  }
  return rows;
}

export function checkAdrs(files: AdrFile[], readme: string, today: Date): string[] {
  const findings: string[] = [];

  const byNumber = new Map<string, string[]>();
  for (const { name } of files) {
    const number = /^ADR-(\d{4})-/.exec(name)?.[1];
    if (number) { byNumber.set(number, [...(byNumber.get(number) ?? []), name]); }
  }
  for (const [number, names] of byNumber) {
    if (names.length > 1) { findings.push(`ADR-${number} is used by ${names.length} files: ${names.join(', ')}`); }
  }

  const indexed = readmeStatuses(readme);
  for (const { name, content } of files) {
    const row = indexed.get(name);
    if (row === undefined) {
      findings.push(`${name} is not listed in .context/ADR/README.md`);
    }

    const status = statusWord(content);
    if (!status) {
      findings.push(`${name} has no parseable "- **Status:**" line`);
      continue;
    }
    if (row !== undefined && row !== status) {
      findings.push(`${name}: README says "${row}" but the file says "${status}"`);
    }

    if (status === 'Proposed') {
      const date = adrDate(content);
      const ageDays = date ? Math.floor((today.getTime() - date.getTime()) / DAY_MS) : null;
      if (ageDays === null) {
        findings.push(`${name} is Proposed and has no parseable "- **Date:**" line`);
      }
      else if (ageDays > MAX_PROPOSED_DAYS) {
        findings.push(`${name} has been Proposed for ${ageDays} days (limit ${MAX_PROPOSED_DAYS}): accept, reject or supersede it`);
      }
    }
  }

  return findings;
}

function main(): void {
  const dir = join(import.meta.dir, '..', '.context', 'ADR');
  const files = readdirSync(dir)
    .filter(name => /^ADR-\d{4}-.+\.md$/.test(name))
    .map(name => ({ name, content: readFileSync(join(dir, name), 'utf8') }));
  const readme = readFileSync(join(dir, 'README.md'), 'utf8');

  const findings = checkAdrs(files, readme, new Date());
  if (findings.length === 0) {
    console.log(`check-adrs: ${files.length} ADRs, index complete, no stale Proposed.`);
    return;
  }
  console.error(`check-adrs: ${findings.length} finding(s)`);
  for (const finding of findings) { console.error(`  - ${finding}`); }
  process.exit(1);
}

if (import.meta.main) { main(); }
