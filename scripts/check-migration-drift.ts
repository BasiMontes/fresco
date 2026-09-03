#!/usr/bin/env bun
/**
 * check-migration-drift.ts — FRESCO-325
 *
 * Compares the local `supabase/migrations/` files against the migration ledger
 * (`supabase_migrations.schema_migrations`) of the LINKED remote project and
 * fails if the two have drifted apart.
 *
 * Two drift signals, both treated as failures:
 *
 *   local-only   a migration file exists in the repo but is NOT recorded as
 *                applied on the remote  ->  someone forgot `supabase db push`.
 *
 *   remote-only  the ledger has an entry with no matching local file  ->  a
 *                schema change reached the remote out-of-band (MCP
 *                `apply_migration`, `execute_sql`, dashboard SQL editor) and
 *                was never captured as a migration.
 *
 * Background: the prod ledger was reconciled to 0/0 in FRESCO-325 (see
 * ADR-0017 "Consequences"). This check exists so the next drift is caught in
 * days, not discovered months later at deploy time (as happened in FRESCO-310).
 *
 * It is NOT wired into the per-PR pipeline on purpose — `migration list
 * --linked` needs credentials for the production project, and keeping those
 * out of the per-PR path is the whole point of ADR-0017. It runs from
 * `.github/workflows/migration-drift-check.yml`: weekly on a schedule, and
 * (FRESCO-413) on `push: [staging]` as a gate on the commit about to be
 * fast-forwarded to `main`.
 *
 * Usage:
 *   bun scripts/check-migration-drift.ts            # exit 0 clean, 1 on drift
 *   bun scripts/check-migration-drift.ts --json     # machine-readable report
 *
 * Env (CI passes these; locally the linked `supabase/.temp` cache is enough):
 *   SUPABASE_ACCESS_TOKEN   personal access token for `supabase link`
 *   SUPABASE_DB_PASSWORD    database password for the linked project
 */

import { $ } from 'bun';

interface LedgerRow {
  local: string
  remote: string
  time?: string
}

interface DriftReport {
  localOnly: string[]
  remoteOnly: string[]
  synced: number
  clean: boolean
}

async function readLedger(): Promise<LedgerRow[]> {
  // `supabase migration list --linked` prints a human table plus one JSON line
  // when `--output-format json` is passed. Everything else on stdout ("Connecting
  // to remote database...") is noise we skip.
  const out
    = await $`supabase migration list --linked --output-format json`.text();

  const jsonLine = out
    .split('\n')
    .map(l => l.trim())
    .find(l => l.startsWith('{') && l.includes('"migrations"'));

  if (!jsonLine) {
    throw new Error(
      `could not find the migrations JSON in \`supabase migration list\` output:\n${out}`,
    );
  }

  const parsed = JSON.parse(jsonLine) as { migrations?: LedgerRow[] };
  if (!Array.isArray(parsed.migrations)) {
    throw new TypeError('migrations JSON did not contain a "migrations" array');
  }
  return parsed.migrations;
}

function analyse(rows: LedgerRow[]): DriftReport {
  const localOnly = rows.filter(r => r.local && !r.remote).map(r => r.local);
  const remoteOnly = rows
    .filter(r => r.remote && !r.local)
    .map(r => r.remote);
  const synced = rows.filter(r => r.local && r.remote).length;

  return {
    localOnly,
    remoteOnly,
    synced,
    clean: localOnly.length === 0 && remoteOnly.length === 0,
  };
}

function printHuman(report: DriftReport): void {
  if (report.clean) {
    console.log(
      `OK: migration ledger in sync — ${report.synced} migrations applied, 0 drift.`,
    );
    return;
  }

  console.error('DRIFT: the migration ledger does not match `supabase/migrations/`.\n');

  if (report.localOnly.length > 0) {
    console.error(
      `  ${report.localOnly.length} local migration file(s) not applied on the remote:`,
    );
    for (const v of report.localOnly) { console.error(`    - ${v}  (run \`supabase db push\`)`); }
    console.error('');
  }

  if (report.remoteOnly.length > 0) {
    console.error(
      `  ${report.remoteOnly.length} ledger entr(y|ies) with no local file — schema changed out-of-band:`,
    );
    for (const v of report.remoteOnly) { console.error(`    - ${v}`); }
    console.error(
      '    Recover them as files (`supabase db pull`) or, if the effect is already\n'
      + '    captured by a local migration, mark them `supabase migration repair --status reverted`.',
    );
    console.error('');
  }

  console.error(`  ${report.synced} migration(s) are in sync.`);
}

async function main(): Promise<void> {
  const asJson = process.argv.includes('--json');

  let rows: LedgerRow[];
  try {
    rows = await readLedger();
  }
  catch (err) {
    console.error(`check-migration-drift: ${(err as Error).message}`);
    process.exit(2);
  }

  const report = analyse(rows);

  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
  }
  else {
    printHuman(report);
  }

  process.exit(report.clean ? 0 : 1);
}

await main();
