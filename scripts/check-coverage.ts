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
 * ## Two numbers, two floors (FRESCO-795, audit-6 A6-T4)
 *
 * lcov only lists files some test actually loads, so the figure above is a
 * ratchet over the LOADED set: it goes up by deleting an import as easily as
 * by adding a test. 130 of 316 source files (about half the code, e.g.
 * `app/signup/page.tsx`, `generate-meal-plan/index.ts`) were outside it.
 * The script therefore prints both:
 *
 *   - LOADED coverage  (functions + lines)  floor `FLOOR`
 *   - HONEST coverage  (lines only)         floor `HONEST_FLOOR_LINES`
 *
 * HONEST = hit lines / (lcov lines + non-empty, non-comment lines of every
 * source file under `app/ components/ lib/ supabase/functions/` that lcov
 * never listed). It is an approximation, deliberately on the low side: those
 * files add every non-empty line, not only executable ones, so the true
 * number sits a few points higher. A ratchet needs a stable, conservative
 * number, not a precise one. Functions have no honest figure: counting them
 * in unloaded files needs an AST parse, not worth it for a floor.
 * Generated files (`GENERATED_FILES`) never enter the denominator.
 *
 * ## The floor
 *
 * `FLOOR` below is the line-weighted total on the day this landed, rounded
 * DOWN to absorb any runner-vs-local noise. Test-support code (`tests/`,
 * `bun-test-setup.ts`) and CI scripts (`scripts/`) are excluded — their
 * coverage is not a quality signal and a ratchet on it would punish adding
 * an un-exercised branch to a mock.
 *
 * 2026-09-07 (FRESCO-454, boilerplate sync to 7ede94e): `cli/` added to the
 * exclusion list for the same reason as `scripts/` — it's the synced
 * boilerplate-updater's own tooling (`update-boilerplate.ts`, `doctor.ts`,
 * `install.ts`, `lib/updater-*.ts`, `lib/agent-compatibility*.ts`), not this
 * project's app code, and it ships with its own test suite maintained
 * upstream. Without this exclusion the sync's ~30 new `cli/` files (much of
 * it interactive-TUI / self-update paths that aren't meaningfully
 * unit-testable) pulled the weighted total down to functions 72.13% /
 * lines 55.57% -- not a real drop in this project's own code quality, just
 * a denominator shift. With `cli/` excluded, coverage holds at
 * functions 83.66% / lines 84.87%, still above FLOOR unchanged.
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
 *   bun scripts/check-coverage.ts --print --unloaded   # + the unloaded files, by risk class
 */

import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Line-weighted total coverage floor, in percent. Normally only raised.
 *
 * 2026-09-03 (FRESCO-411 merged): functions 83.85 %, lines 85.78 %.
 * 2026-09-03 (FRESCO-419): lowered to functions 82.0 / lines 84.0. Adding
 *   the `Dialog`-mounting component tests pulled `components/ui/dialog.tsx`
 *   plus the `delete-week-button` / `delete-account-dialog` /
 *   `create-recipe-form` graphs into the coverage set; their async
 *   submit/delete handlers are e2e-covered, not unit-covered (they are
 *   cross-file-flaky under the shared inert Supabase client — ADR-0024).
 *   The 13 new tests raised real coverage of the dialog cycle + validation
 *   gates; the weighted TOTAL dipped ~1 pp only because the newly-loaded
 *   files carry uncovered handlers. Net positive — a documented,
 *   reviewed one-off dip, per .context/qa/coverage-ratchet.md.
 * 2026-10-06 (FRESCO-795): raised to functions 85.5 / lines 87.0 (measured
 *   86.63 / 87.57 on the loaded set; the previous 84.5 / 86.2 had drifted
 *   below the doc's 82 / 84). Honest floor introduced beside it.
 * 2026-10-14 (FRESCO-916): raised to functions 87.5 / lines 88.7 (measured
 *   88.12 / 89.30). The floor had sat 2.6 pp under the real number: a drop of
 *   that size would have passed CI without a word.
 * 2026-10-19 (FRESCO-991): raised to functions 89.0 / lines 89.7 (measured
 *   89.60 / 90.10) after the Edge handler tests landed.
 */
const FLOOR = { functions: 89.0, lines: 89.7 } as const;

/**
 * Floor for the HONEST line coverage (unloaded files counted as zero). Only
 * raised. 2026-10-06 (FRESCO-795): measured 49.6 % (hit 9570 of 19293 lines),
 * floored at 49.0 to absorb runner noise.
 * 2026-10-14 (FRESCO-916): measured 55.26 %, floored at 54.5. This is the first
 * tranche of the plan in `.context/qa/coverage-ratchet.md` ("Tranches"): the 49.0
 * floor sat 6.3 pp under the real number, so a 6-point regression would not have
 * failed. The next tranche is 60 %.
 * 2026-10-19 (FRESCO-991): measured 63.35 %, floored at 63.0. The Edge handlers
 * that move money and write plans/lists (generate-meal-plan, generate-shopping-list,
 * get-shopping-list-suggestions, delete-catalog-recipe) and the consent-gated
 * PostHog capture were the highest-risk files no test imported.
 */
const HONEST_FLOOR_LINES = 63.0;

/** Directories whose source files make up the honest denominator. */
const SOURCE_DIRS = ['app', 'components', 'lib', 'supabase/functions'];

/** Generated code: not written by hand, so not a testing signal. */
const GENERATED_FILES = new Set(['lib/supabase/types.ts']);

/** Path prefixes whose files are not part of the ratchet. */
const IGNORE_PREFIXES = ['tests/', 'scripts/', 'cli/', 'bun-test-setup.ts'];

interface Totals { fnFound: number, fnHit: number, lineFound: number, lineHit: number, loaded: Set<string> }

function parseLcov(lcov: string): Totals {
  const t: Totals = { fnFound: 0, fnHit: 0, lineFound: 0, lineHit: 0, loaded: new Set() };
  let currentFileIgnored = false;

  for (const raw of lcov.split('\n')) {
    const line = raw.trim();
    if (line.startsWith('SF:')) {
      const path = line.slice(3);
      currentFileIgnored = IGNORE_PREFIXES.some(p => path.startsWith(p));
      if (!currentFileIgnored) { t.loaded.add(path); }
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

function isSourceFile(path: string): boolean {
  return /\.tsx?$/.test(path)
    && !/\.(?:test|spec)\.tsx?$/.test(path)
    && !path.endsWith('.d.ts')
    && !path.includes('__tests__/')
    && !GENERATED_FILES.has(path);
}

interface UnloadedFile { path: string, lines: number }

/** Non-empty, non-comment lines of every tracked source file lcov never listed. */
async function listUnloadedFiles(loaded: Set<string>): Promise<UnloadedFile[]> {
  const ls = Bun.spawn(['git', 'ls-files', ...SOURCE_DIRS], { stdout: 'pipe', stderr: 'inherit' });
  const listing = await new Response(ls.stdout).text();
  await ls.exited;

  const files: UnloadedFile[] = [];
  for (const path of listing.split('\n').filter(isSourceFile)) {
    if (loaded.has(path)) { continue; }
    const source = await Bun.file(path).text();
    const lines = source.split('\n').filter((raw) => {
      const l = raw.trim();
      return l !== '' && !l.startsWith('//') && !l.startsWith('/*') && !l.startsWith('*');
    }).length;
    files.push({ path, lines });
  }
  return files;
}

/**
 * FRESCO-991: what a bug in the file would cost, most expensive first. Order of the
 * rules is the priority: the first match wins. Type-only files (`types.ts`) have no
 * runtime lines to cover, so they are matched first and sort last.
 */
const RISK_CLASSES: Array<{ name: string, test: RegExp }> = [
  { name: '6 type-only', test: /(^|\/)types\.ts$/ },
  { name: '1 money', test: /billing|stripe|checkout|subscription|pricing|price|entitlement/i },
  { name: '2 allergens and consent', test: /allerg|alergen|diet|substitut|consent|legal|ingredient/i },
  { name: '3 edge handlers', test: /^supabase\/functions\// },
  { name: '4 user-data routes and loaders', test: /^app\/api\/|route\.ts$|load-.*-data|\/server\.ts$|\/service\.ts$/ },
  { name: '5 everything else', test: /./ },
];

function riskClassOf(path: string): string {
  return RISK_CLASSES.find(c => c.test.test(path))!.name;
}

/** `--unloaded`: the files no test imports, by risk class then size, so the next tranche starts at the top. */
function printUnloaded(files: UnloadedFile[]): void {
  const ranked = files
    .map(f => ({ ...f, risk: riskClassOf(f.path) }))
    .sort((a, b) => a.risk.localeCompare(b.risk) || b.lines - a.lines);
  console.log('');
  console.log('  Files no test imports (counted as 0 hit), by risk class then size:');
  let current = '';
  for (const f of ranked) {
    if (f.risk !== current) {
      current = f.risk;
      const total = ranked.filter(r => r.risk === current).reduce((n, r) => n + r.lines, 0);
      console.log(`\n  ${current}  (${total} lines)`);
    }
    console.log(`    ${String(f.lines).padStart(4)}  ${f.path}`);
  }
}

async function main(): Promise<void> {
  const printOnly = process.argv.includes('--print');
  const listUnloaded = process.argv.includes('--unloaded');
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

  const unloadedFiles = await listUnloadedFiles(totals.loaded);
  const unloaded = { files: unloadedFiles.length, lines: unloadedFiles.reduce((n, f) => n + f.lines, 0) };
  const honestLines = pct(totals.lineHit, totals.lineFound + unloaded.lines);

  console.log('');
  console.log('─'.repeat(64));
  console.log('  Unit-test coverage (line-weighted, excl. tests/, scripts/, cli/)');
  console.log('  LOADED  files some test imports');
  console.log(`    functions  ${functions.toFixed(2)} %   (floor ${FLOOR.functions.toFixed(2)} %)`);
  console.log(`    lines      ${lines.toFixed(2)} %   (floor ${FLOOR.lines.toFixed(2)} %)`);
  console.log(`  HONEST  loaded + ${unloaded.files} files no test imports, counted as 0 hit`);
  console.log(`    lines      ${honestLines.toFixed(2)} %   (floor ${HONEST_FLOOR_LINES.toFixed(2)} %)`);
  console.log('─'.repeat(64));

  if (listUnloaded) { printUnloaded(unloadedFiles); }

  if (printOnly) {
    process.exit(0);
  }

  const below: string[] = [];
  if (functions < FLOOR.functions) { below.push(`functions ${functions.toFixed(2)} % < floor ${FLOOR.functions.toFixed(2)} %`); }
  if (lines < FLOOR.lines) { below.push(`lines ${lines.toFixed(2)} % < floor ${FLOOR.lines.toFixed(2)} %`); }
  if (honestLines < HONEST_FLOOR_LINES) { below.push(`honest lines ${honestLines.toFixed(2)} % < floor ${HONEST_FLOOR_LINES.toFixed(2)} %`); }

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

  const headroom = Math.min(functions - FLOOR.functions, lines - FLOOR.lines, honestLines - HONEST_FLOOR_LINES);
  if (headroom >= 1.5) {
    console.log(`  ✓ ${headroom.toFixed(1)} pp of headroom — consider raising FLOOR to`);
    console.log(`    { functions: ${Math.floor(functions * 10) / 10}, lines: ${Math.floor(lines * 10) / 10} } and HONEST_FLOOR_LINES to ${Math.floor(honestLines * 10) / 10} in this or a follow-up PR.`);
  }
  else {
    console.log('  ✓ coverage holds at or above the floor.');
  }
  process.exit(0);
}

await main();
