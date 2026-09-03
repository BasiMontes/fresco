#!/usr/bin/env bun
/**
 * check-functions-drift.ts — FRESCO-414
 *
 * Sibling of `check-migration-drift.ts` (FRESCO-413), for the Edge Functions
 * layer. The audit-4 ola-3 sweep promoted `supabase/functions/*` code to `main`
 * without redeploying it to the shared Supabase project — `reassign-guest-data`
 * kept serving the exploitable v19 for ~24h after the ticket was closed on
 * paper (see the FRESCO-414 description). Nothing detected it.
 *
 * The deployed bundle hash (`ezbr_sha256` from `supabase functions list`) CANNOT
 * be recomputed locally — it is an internal eszip bundle format and the CLI has
 * no `--dry-run` / bundle-only mode. So the drift signal here is a git-mtime
 * heuristic, the same comparison a human did by hand to build the evidence
 * table on the ticket:
 *
 *   for each function dir, take the most recent commit timestamp across
 *   `supabase/functions/<fn>/`, `supabase/functions/_shared/` and
 *   `supabase/functions/deno.json`. If that is newer than the deployed
 *   function's `updated_at`, the repo has moved on without a redeploy.
 *
 * It is self-healing: a real `supabase functions deploy` bumps `updated_at` past
 * the commit time and the signal clears. A `_shared/**` change flags every
 * importer — that is correct, they all need redeploying.
 *
 * Two failure signals (exit 1):
 *   undeployed   a function dir exists in the repo with no deployed counterpart.
 *   stale        the repo sources are newer than the deployed `updated_at`.
 *
 * One non-fatal signal (reported, exit unaffected):
 *   orphan       a deployed function with no dir in the repo.
 *
 * NOT wired into pr-check.yml — `supabase functions list` needs credentials for
 * the production project and the per-PR path must not carry them (ADR-0017). It
 * runs from `.github/workflows/edge-functions-drift.yml`: weekly on a schedule,
 * and on `push: [staging]` right after the auto-deploy job, as a gate on the
 * commit about to be fast-forwarded to `main`.
 *
 * Usage:
 *   bun scripts/check-functions-drift.ts            # exit 0 clean, 1 drift, 2 error
 *   bun scripts/check-functions-drift.ts --json
 *
 * Env (CI passes these; locally the linked `supabase/.temp` cache is enough):
 *   SUPABASE_ACCESS_TOKEN   personal access token for `supabase functions list`
 */

import { readdir } from 'node:fs/promises';
import { $ } from 'bun';

const PROJECT_REF = 'jdqemhewjrjuopssdurn';
const FUNCTIONS_DIR = 'supabase/functions';
/** Sources that fan out to every function: a change here means redeploy all. */
const SHARED_PATHS = [`${FUNCTIONS_DIR}/_shared`, `${FUNCTIONS_DIR}/deno.json`];
/**
 * Files that are NOT part of the deployed bundle — `deno.json` excludes test
 *  files, and `.md` is docs. A commit that only touches these must not read as
 *  drift (FRESCO-411 added `index.test.ts` files and would have flagged three
 *  functions that were byte-identical to their deploy).
 */
// `*` in a plain pathspec crosses `/`, so these also match nested files
// (`_shared/foo.test.ts`); `**` would instead REQUIRE a subdir and miss
// `functions/README.md`.
const NOT_BUNDLED = [
  `:(exclude)${FUNCTIONS_DIR}/*.test.ts`,
  `:(exclude)${FUNCTIONS_DIR}/*.md`,
];
/**
 * Deploy timestamps have second granularity and land a few seconds after the
 *  commit that triggered them; don't flag that as drift.
 */
const SKEW_MS = 120_000;

interface DeployedFn {
  slug: string
  version: number
  updated_at: number
}

interface DriftReport {
  undeployed: string[]
  stale: { slug: string, repoTouchedAt: string, deployedAt: string }[]
  orphan: string[]
  synced: number
  clean: boolean
}

/** Deployed functions from `supabase functions list --output-format json`. */
async function readDeployed(): Promise<Map<string, DeployedFn>> {
  const out = await $`supabase functions list --project-ref ${PROJECT_REF} --output-format json`.text();

  const jsonLine = out
    .split('\n')
    .map(l => l.trim())
    .find(l => l.startsWith('{') && l.includes('"functions"'));

  if (!jsonLine) {
    throw new Error(`could not find the functions JSON in \`supabase functions list\` output:\n${out}`);
  }

  const parsed = JSON.parse(jsonLine) as { functions?: DeployedFn[] };
  if (!Array.isArray(parsed.functions)) {
    throw new TypeError('functions JSON did not contain a "functions" array');
  }

  return new Map(parsed.functions.map(f => [f.slug, f]));
}

/**
 * Function dirs in the repo — every child of `supabase/functions/` that holds
 *  an `index.ts`, excluding `_shared`.
 */
async function readRepoFunctions(): Promise<string[]> {
  const entries = await readdir(FUNCTIONS_DIR, { withFileTypes: true });
  const slugs: string[] = [];
  for (const e of entries) {
    if (!e.isDirectory() || e.name === '_shared') { continue; }
    if (await Bun.file(`${FUNCTIONS_DIR}/${e.name}/index.ts`).exists()) {
      slugs.push(e.name);
    }
  }
  if (slugs.length === 0) {
    throw new Error(`no function dirs found under ${FUNCTIONS_DIR}/`);
  }
  return slugs.sort();
}

/**
 * Epoch ms of the most recent commit touching any of `paths`. 0 if none (or
 *  if history is shallow — the workflow checks out with fetch-depth: 0).
 */
async function lastCommitMs(paths: string[]): Promise<number> {
  const out = await $`git log -1 --format=%ct -- ${paths} ${NOT_BUNDLED}`.text();
  const secs = Number.parseInt(out.trim(), 10);
  return Number.isFinite(secs) ? secs * 1000 : 0;
}

async function analyse(
  deployed: Map<string, DeployedFn>,
  repoSlugs: string[],
): Promise<DriftReport> {
  const sharedTouchedMs = await lastCommitMs(SHARED_PATHS);

  const undeployed: string[] = [];
  const stale: DriftReport['stale'] = [];
  let synced = 0;

  for (const slug of repoSlugs) {
    const dep = deployed.get(slug);
    if (!dep) {
      undeployed.push(slug);
      continue;
    }
    const ownTouchedMs = await lastCommitMs([`${FUNCTIONS_DIR}/${slug}`]);
    const repoTouchedMs = Math.max(ownTouchedMs, sharedTouchedMs);

    if (repoTouchedMs > dep.updated_at + SKEW_MS) {
      stale.push({
        slug,
        repoTouchedAt: new Date(repoTouchedMs).toISOString(),
        deployedAt: new Date(dep.updated_at).toISOString(),
      });
    }
    else {
      synced++;
    }
  }

  const repoSet = new Set(repoSlugs);
  const orphan = [...deployed.keys()].filter(s => !repoSet.has(s)).sort();

  return {
    undeployed,
    stale,
    orphan,
    synced,
    clean: undeployed.length === 0 && stale.length === 0,
  };
}

function printHuman(r: DriftReport): void {
  if (r.clean) {
    let line = `OK: edge functions in sync — ${r.synced} deployed at or after their repo sources, 0 drift.`;
    if (r.orphan.length > 0) {
      line += `\nNote: ${r.orphan.length} deployed function(s) with no repo dir: ${r.orphan.join(', ')}.`;
    }
    console.log(line);
    return;
  }

  console.error('DRIFT: deployed edge functions do not match `supabase/functions/`.\n');

  if (r.undeployed.length > 0) {
    console.error(`  ${r.undeployed.length} function(s) in the repo with no deployed counterpart:`);
    for (const s of r.undeployed) { console.error(`    - ${s}`); }
    console.error('');
  }

  if (r.stale.length > 0) {
    console.error(`  ${r.stale.length} function(s) whose repo sources are newer than the deployed version:`);
    for (const s of r.stale) {
      console.error(`    - ${s.slug}  (repo ${s.repoTouchedAt} > deploy ${s.deployedAt})`);
    }
    console.error('');
  }

  if (r.orphan.length > 0) {
    console.error(`  ${r.orphan.length} deployed function(s) with no repo dir (not a failure): ${r.orphan.join(', ')}\n`);
  }

  console.error(
    '  Fix: redeploy with `bun scripts/deploy-changed-functions.ts` (or\n'
    + '  `supabase functions deploy <fn> --use-api --import-map supabase/functions/deno.json`,\n'
    + '  plus `--no-verify-jwt` for send-weekly-reengagement-push). See supabase/functions/README.md.',
  );
}

async function main(): Promise<void> {
  const asJson = process.argv.includes('--json');

  let report: DriftReport;
  try {
    const [deployed, repoSlugs] = await Promise.all([readDeployed(), readRepoFunctions()]);
    report = await analyse(deployed, repoSlugs);
  }
  catch (err) {
    console.error(`check-functions-drift: ${(err as Error).message}`);
    process.exit(2);
  }

  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
  }
  else {
    printHuman(report);
  }

  process.exit(report.clean ? 0 : 1);
}

await main();
