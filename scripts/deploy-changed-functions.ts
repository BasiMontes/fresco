#!/usr/bin/env bun
/**
 * deploy-changed-functions.ts — FRESCO-414
 *
 * Auto-deploys the Edge Functions that changed in a git range to the shared
 * Supabase project. Runs from `.github/workflows/edge-functions-drift.yml` on
 * `push: [staging]` — the last hop before the manual `staging -> main`
 * fast-forward — so `main` never again carries function code that was never
 * deployed (the FRESCO-414 root cause).
 *
 * Which functions:
 *   - `supabase/functions/_shared/**` or `deno.json` changed  ->  ALL functions
 *     (every importer needs the new shared code).
 *   - otherwise                                               ->  just the
 *     `supabase/functions/<slug>/` dirs that changed.
 *   - range missing / unresolvable (first push, force-push)   ->  ALL functions.
 *
 * How: `supabase functions deploy <slug> --use-api --import-map <deno.json>`.
 *   --use-api      bundles server-side, no Docker (GH runners have none here).
 *   --import-map   passed explicitly — without it the remote bundler does not
 *                  resolve `@supabase/supabase-js` (matches the manual sweep on
 *                  the FRESCO-414 ticket).
 *   --no-verify-jwt is appended exactly when `supabase/config.toml` declares
 *                  `[functions.<slug>] verify_jwt = false` (FRESCO-1169: today the
 *                  two pg_cron-invoked functions). The block is the source of
 *                  truth; a function with no block is NOT deployed, so a new one
 *                  cannot slip in with a default nobody chose.
 *
 * Env:
 *   SUPABASE_ACCESS_TOKEN   personal access token (required; `supabase link` +
 *                           deploy both use it).
 *   BEFORE, AFTER           git SHAs bounding the range. CI passes
 *                           github.event.before / github.sha. Falls back to
 *                           HEAD~1..HEAD locally, then to "deploy all".
 *
 * Usage:
 *   BEFORE=<sha> AFTER=<sha> bun scripts/deploy-changed-functions.ts
 *   bun scripts/deploy-changed-functions.ts <before> <after>
 *   bun scripts/deploy-changed-functions.ts <before> <after> --dry-run
 */

import { readdir } from 'node:fs/promises';
import { $ } from 'bun';
import { deployArgs, readDeclaredVerifyJwt } from './lib/edge-function-config';

const PROJECT_REF = 'jdqemhewjrjuopssdurn';
const FUNCTIONS_DIR = 'supabase/functions';
const IMPORT_MAP = `${FUNCTIONS_DIR}/deno.json`;
const CONFIG_TOML = 'supabase/config.toml';
const ZERO_SHA = '0000000000000000000000000000000000000000';
/**
 * Not in the deployed bundle (`deno.json` excludes test files; `.md` is docs)
 *  — a change confined to these must not trigger a redeploy.
 */
// `*` in a plain pathspec crosses `/`, so these also match nested files;
// `**` would instead REQUIRE a subdir and miss `functions/README.md`.
const NOT_BUNDLED = [
  `:(exclude)${FUNCTIONS_DIR}/*.test.ts`,
  `:(exclude)${FUNCTIONS_DIR}/*.md`,
];

async function repoFunctions(): Promise<string[]> {
  const entries = await readdir(FUNCTIONS_DIR, { withFileTypes: true });
  const slugs: string[] = [];
  for (const e of entries) {
    if (!e.isDirectory() || e.name === '_shared') { continue; }
    if (await Bun.file(`${FUNCTIONS_DIR}/${e.name}/index.ts`).exists()) {
      slugs.push(e.name);
    }
  }
  return slugs.sort();
}

async function isValidRef(ref: string | undefined): Promise<boolean> {
  if (!ref || ref === ZERO_SHA) { return false; }
  return $`git rev-parse --verify --quiet ${`${ref}^{commit}`}`.quiet().nothrow().then(r => r.exitCode === 0);
}

/** Slugs to deploy, and why. `null` slugs = deploy everything. */
async function resolveTargets(
  before: string | undefined,
  after: string,
  allSlugs: string[],
): Promise<{ slugs: string[], reason: string }> {
  if (!(await isValidRef(before))) {
    return { slugs: allSlugs, reason: `range start ${before ?? '(unset)'} unresolvable — deploying all` };
  }

  const diff = await $`git diff --name-only ${before} ${after} -- ${FUNCTIONS_DIR} ${NOT_BUNDLED}`.text();
  const changed = diff.split('\n').map(l => l.trim()).filter(Boolean);

  if (changed.length === 0) {
    return { slugs: [], reason: 'no changes under supabase/functions/' };
  }

  const sharedChanged = changed.some(
    p => p.startsWith(`${FUNCTIONS_DIR}/_shared/`) || p === IMPORT_MAP,
  );
  if (sharedChanged) {
    return { slugs: allSlugs, reason: '_shared/** or deno.json changed — deploying all importers' };
  }

  const touched = new Set<string>();
  for (const p of changed) {
    const m = p.match(new RegExp(`^${FUNCTIONS_DIR}/([^/]+)/`));
    if (m && allSlugs.includes(m[1])) { touched.add(m[1]); }
  }
  return { slugs: [...touched].sort(), reason: `${touched.size} function dir(s) changed` };
}

async function deployOne(slug: string, dryRun: boolean, declared: Record<string, boolean>): Promise<void> {
  const verifyJwt = declared[slug];
  if (verifyJwt === undefined) {
    throw new Error(`${slug} has no [functions.${slug}] block with verify_jwt in ${CONFIG_TOML}: declare whether it requires a session before deploying it`);
  }
  const args = deployArgs({ slug, projectRef: PROJECT_REF, importMap: IMPORT_MAP, verifyJwt });

  console.log(`\n→ supabase ${args.join(' ')}`);
  if (dryRun) {
    console.log('  (dry run — not executed)');
    return;
  }
  const res = await $`supabase ${args}`.nothrow();
  if (res.exitCode !== 0) {
    throw new Error(`deploy failed for ${slug} (exit ${res.exitCode})`);
  }
}

async function main(): Promise<void> {
  const positional = process.argv.slice(2).filter(a => !a.startsWith('--'));
  const dryRun = process.argv.includes('--dry-run');
  const before = process.env.BEFORE ?? positional[0] ?? 'HEAD~1';
  const after = process.env.AFTER ?? positional[1] ?? 'HEAD';

  const allSlugs = await repoFunctions();
  if (allSlugs.length === 0) {
    console.error('deploy-changed-functions: no function dirs found');
    process.exit(2);
  }

  const declared = readDeclaredVerifyJwt(await Bun.file(CONFIG_TOML).text());
  const { slugs, reason } = await resolveTargets(before, after, allSlugs);
  console.log(`Target: ${reason}`);

  if (slugs.length === 0) {
    console.log('Nothing to deploy.');
    return;
  }

  console.log(`Deploying${dryRun ? ' (dry run)' : ''}: ${slugs.join(', ')}`);
  const failed: string[] = [];
  for (const slug of slugs) {
    try {
      await deployOne(slug, dryRun, declared);
    }
    catch (err) {
      console.error(`  ✗ ${(err as Error).message}`);
      failed.push(slug);
    }
  }

  if (failed.length > 0) {
    console.error(`\n${failed.length}/${slugs.length} deploy(s) failed: ${failed.join(', ')}`);
    process.exit(1);
  }
  console.log(`\n✓ ${slugs.length} function(s) deployed.`);
}

await main();
