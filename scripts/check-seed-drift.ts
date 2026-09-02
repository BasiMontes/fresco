#!/usr/bin/env bun
/**
 * check-seed-drift.ts — FRESCO-387 (audit-4 A4-M13)
 *
 * `supabase/seed.sql` is a hand-regenerated `--data-only` dump of prod's
 * `public.recipes` (see FRESCO-310 / FRESCO-31). Nothing checks that it still
 * matches the live catalog — the last regen was manual, and the catalog
 * changes (recipes deleted in FRESCO-301, photos backfilled in FRESCO-31).
 *
 * This compares the SET OF RECIPE IDS in `seed.sql` against the set in prod
 * and fails when they have drifted past a threshold. It deliberately ignores
 * column churn (`foto_url`, `veces_cocinada`, `rating_promedio`,
 * `ultima_vez_en_menu`) — those change continuously and a stale value in the
 * CI fixture is harmless. A recipe added or removed from the catalog is the
 * signal that matters: the e2e suite seeds from `seed.sql`, so a real
 * structural drift means CI is testing against a catalog prod no longer has.
 *
 * NOT wired into pr-check.yml on purpose — reading prod needs credentials the
 * per-PR path must not carry (ADR-0017). Runs from the scheduled
 * `.github/workflows/migration-drift-check.yml` and opens a GitHub issue on
 * drift.
 *
 * Usage:
 *   bun scripts/check-seed-drift.ts            # exit 0 clean, 1 on drift, 2 on error
 *   bun scripts/check-seed-drift.ts --json
 *
 * Env (CI passes these; locally the linked `supabase/.temp` cache is enough):
 *   SUPABASE_DB_PASSWORD    database password for the linked project
 */

import { $ } from 'bun';

/** IDs added/removed beyond this total are a failure. Tolerates the normal FRESCO-31 / FRESCO-301 churn between manual regens. */
const DRIFT_THRESHOLD = 25;

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

interface SeedDriftReport {
  seedCount: number
  prodCount: number
  missingFromSeed: string[]
  extraInSeed: string[]
  threshold: number
  clean: boolean
}

/** Recipe UUIDs from the single `INSERT INTO "public"."recipes" … VALUES` block in seed.sql. */
async function readSeedRecipeIds(): Promise<Set<string>> {
  const sql = await Bun.file('supabase/seed.sql').text();
  const insertAt = sql.indexOf('INSERT INTO "public"."recipes"');
  if (insertAt === -1) {
    throw new Error('supabase/seed.sql has no `INSERT INTO "public"."recipes"` block');
  }
  const body = sql.slice(insertAt);
  const ids = new Set<string>();
  for (const line of body.split('\n')) {
    // Each row is `\t('<uuid>', '<created_at>', …),` — the FIRST uuid on the
    // line is the id. Stop at the statement terminator.
    const trimmed = line.trimStart();
    if (!trimmed.startsWith('(\'')) {
      if (trimmed.endsWith(';') && ids.size > 0) { break; }
      continue;
    }
    const m = trimmed.match(UUID_RE);
    if (m) { ids.add(m[0].toLowerCase()); }
  }
  if (ids.size === 0) {
    throw new Error('parsed 0 recipe ids from supabase/seed.sql');
  }
  return ids;
}

async function readProdRecipeIds(): Promise<Set<string>> {
  const poolerUrl = (await Bun.file('supabase/.temp/pooler-url').text()).trim();
  if (!poolerUrl.startsWith('postgresql://')) {
    throw new Error('supabase/.temp/pooler-url missing or malformed — run `supabase link` first');
  }
  const password = process.env.SUPABASE_DB_PASSWORD;
  if (!password) {
    throw new Error('SUPABASE_DB_PASSWORD is not set');
  }

  const out = await $`psql ${poolerUrl} -tAc ${'select id from public.recipes'}`
    .env({ ...process.env, PGPASSWORD: password })
    .text();

  const ids = new Set<string>();
  for (const line of out.split('\n')) {
    const m = line.trim().match(UUID_RE);
    if (m) { ids.add(m[0].toLowerCase()); }
  }
  if (ids.size === 0) {
    throw new Error(`psql returned no recipe ids:\n${out}`);
  }
  return ids;
}

function analyse(seed: Set<string>, prod: Set<string>): SeedDriftReport {
  const missingFromSeed = [...prod].filter(id => !seed.has(id)).sort();
  const extraInSeed = [...seed].filter(id => !prod.has(id)).sort();
  return {
    seedCount: seed.size,
    prodCount: prod.size,
    missingFromSeed,
    extraInSeed,
    threshold: DRIFT_THRESHOLD,
    clean: missingFromSeed.length + extraInSeed.length <= DRIFT_THRESHOLD,
  };
}

function printHuman(r: SeedDriftReport): void {
  const drift = r.missingFromSeed.length + r.extraInSeed.length;
  if (r.clean) {
    console.log(
      `OK: seed.sql catalog in sync — seed ${r.seedCount} / prod ${r.prodCount} recipes, `
      + `${drift} id diff (threshold ${r.threshold}).`,
    );
    return;
  }
  console.error(
    `DRIFT: supabase/seed.sql and prod public.recipes differ by ${drift} ids `
    + `(threshold ${r.threshold}). seed ${r.seedCount} / prod ${r.prodCount}.\n`,
  );
  if (r.missingFromSeed.length > 0) {
    console.error(`  ${r.missingFromSeed.length} recipe(s) in prod but NOT in seed.sql:`);
    for (const id of r.missingFromSeed.slice(0, 20)) { console.error(`    - ${id}`); }
    if (r.missingFromSeed.length > 20) { console.error(`    … and ${r.missingFromSeed.length - 20} more`); }
    console.error('');
  }
  if (r.extraInSeed.length > 0) {
    console.error(`  ${r.extraInSeed.length} recipe(s) in seed.sql but NOT in prod:`);
    for (const id of r.extraInSeed.slice(0, 20)) { console.error(`    - ${id}`); }
    if (r.extraInSeed.length > 20) { console.error(`    … and ${r.extraInSeed.length - 20} more`); }
    console.error('');
  }
  console.error('  Fix: regenerate `supabase/seed.sql` — see its header comment.');
}

async function main(): Promise<void> {
  const asJson = process.argv.includes('--json');

  let report: SeedDriftReport;
  try {
    const [seed, prod] = await Promise.all([readSeedRecipeIds(), readProdRecipeIds()]);
    report = analyse(seed, prod);
  }
  catch (err) {
    console.error(`check-seed-drift: ${(err as Error).message}`);
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
