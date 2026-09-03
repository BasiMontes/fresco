#!/usr/bin/env bun
/**
 * check-coverage.ts — FRESCO-412 (epic FRESCO-408, Fase 4)
 *
 * Runs `bun test --coverage` and enforces a RATCHET FLOOR on the project's
 * total unit-test coverage: the job fails if coverage drops below the floor,
 * never if it rises. Same mechanism as the e2e automation ratchet
 * (FRESCO-321) — the floor only moves up, by hand, when someone re-measures.
 *
 * ## Why a script and not `bunfig.toml`'s `coverageThreshold`
 *
 * Bun 1.3's `coverageThreshold` (both the single-number and the
 * `{ lines, functions }` object form) is enforced **per file** — every file
 * must clear the bar. This codebase has many partially-covered source files
 * by design (`lib/push/web-push-client.ts` at ~15%, server-only paths that
 * only e2e exercises), so any per-file bar above ~15% fails immediately and
 * a per-file bar that low catches nothing. What the AC asks for is a
 * **global total** with a conservative floor — bun has no option for that,
 * so this parses the lcov report and computes it.
 *
 * Also note: bun's text-reporter "All files" line is an *unweighted mean of
 * per-file percentages*, which small 100 %-covered files inflate. This
 * script reports the **line-weighted** total (ΣhitLines / ΣfoundLines),
 * which is the honest number.
 *
 * ## The floor
 *
 * `FLOOR` below is the line-weighted total on the day this landed, rounded
 * DOWN to absorb any runner-vs-local noise. Test-support code (`tests/`,
 * `bun-test-setup.ts`) and CI scripts (`scripts/`) are excluded — their
 * coverage is not a quality signal and a ratchet on it would punish adding
 * an un-exercised branch to a mock.
 *
 * ## Raising the floor
 *
 *   bun scripts/check-coverage.ts --print   # measure without enforcing
 *
 * then bump `FLOOR` to (roughly) the new numbers, rounded down a touch.
 * See `.context/qa/coverage-ratchet.md`.
 *
 * ## Usage
 *
 *   bun scripts/check-coverage.ts           # run tests + enforce; exit 1 on drop
 *   bun scripts/check-coverage.ts --print   # measure + print only, always exit 0
 */

import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Line-weighted total coverage floor, in percent. Only ever raise this.
 * Measured 2026-09-03 (FRESCO-411 merged): functions 83.85 %, lines 85.78 %.
 * Set ~0.8 pp below to absorb runner-vs-local noise.
 */
const FLOOR = { functions: 83.0, lines: 85.0 } as const;

/** Path prefixes whose files are not part of the ratchet. */
const IGNORE_PREFIXES = ['tests/', 'scripts/', 'bun-test-setup.ts'];

interface Totals { fnFound: number, fnHit: number, lineFound: number, lineHit: number }

function parseLcov(lcov: string): Totals {
  const t: Totals = { fnFound: 0, fnHit: 0, lineFound: 0, lineHit: 0 };
  let currentFileIgnored = false;

  for (const raw of lcov.split('\n')) {
    const line = raw.trim();
    if (line.startsWith('SF:')) {
      const path = line.slice(3);
      currentFileIgnored = IGNORE_PREFIXES.some(p => path.startsWith(p));
      continue;
    }
    if (currentFileIgnored) {
      continue;
    }
    const match = line.match(/^(FNF|FNH|LF|LH):(\d+)$/);
    if (!match) {
      continue;
    }
    const value = Number(match[2]);
    if (match[1] === 'FNF') { t.fnFound += value; }
    else if (match[1] === 'FNH') { t.fnHit += value; }
    else if (match[1] === 'LF') { t.lineFound += value; }
    else if (match[1] === 'LH') { t.lineHit += value; }
  }
  return t;
}

function pct(hit: number, found: number): number {
  return found === 0 ? 100 : Math.round((10_000 * hit) / found) / 100;
}

async function main(): Promise<void> {
  const printOnly = process.argv.includes('--print');
  const coverageDir = join(tmpdir(), `fresco-coverage-${process.pid}`);

  const proc = Bun.spawn(
    ['bun', 'test', '--coverage', '--coverage-reporter=lcov', `--coverage-dir=${coverageDir}`],
    { stdout: 'inherit', stderr: 'inherit' },
  );
  const testExit = await proc.exited;
  if (testExit !== 0) {
    // A real test failure — surface it as-is, don't also complain about coverage.
    process.exit(testExit);
  }

  const lcovPath = join(coverageDir, 'lcov.info');
  const lcov = await Bun.file(lcovPath).text().catch(() => '');
  await rm(coverageDir, { recursive: true, force: true });

  if (!lcov) {
    console.error(`check-coverage: no lcov report was written to ${lcovPath}`);
    process.exit(2);
  }

  const totals = parseLcov(lcov);
  const functions = pct(totals.fnHit, totals.fnFound);
  const lines = pct(totals.lineHit, totals.lineFound);

  console.log('');
  console.log('─'.repeat(52));
  console.log('  Total unit-test coverage (line-weighted, excl. tests/, scripts/)');
  console.log(`    functions  ${functions.toFixed(2)} %   (floor ${FLOOR.functions.toFixed(2)} %)`);
  console.log(`    lines      ${lines.toFixed(2)} %   (floor ${FLOOR.lines.toFixed(2)} %)`);
  console.log('─'.repeat(52));

  if (printOnly) {
    process.exit(0);
  }

  const below: string[] = [];
  if (functions < FLOOR.functions) { below.push(`functions ${functions.toFixed(2)} % < floor ${FLOOR.functions.toFixed(2)} %`); }
  if (lines < FLOOR.lines) { below.push(`lines ${lines.toFixed(2)} % < floor ${FLOOR.lines.toFixed(2)} %`); }

  if (below.length > 0) {
    console.error('');
    console.error('✗ coverage dropped below the ratchet floor:');
    for (const b of below) { console.error(`    ${b}`); }
    console.error('');
    console.error('  Add tests for the code you changed, or — if the drop is a deliberate,');
    console.error('  reviewed trade-off — lower FLOOR in scripts/check-coverage.ts in the same PR');
    console.error('  and say why. See .context/qa/coverage-ratchet.md.');
    process.exit(1);
  }

  const headroom = Math.min(functions - FLOOR.functions, lines - FLOOR.lines);
  if (headroom >= 1.5) {
    console.log(`  ✓ ${headroom.toFixed(1)} pp of headroom — consider raising FLOOR to`);
    console.log(`    { functions: ${Math.floor(functions * 10) / 10}, lines: ${Math.floor(lines * 10) / 10} } in this or a follow-up PR.`);
  }
  else {
    console.log('  ✓ coverage holds at or above the floor.');
  }
  process.exit(0);
}

await main();
