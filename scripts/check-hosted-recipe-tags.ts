#!/usr/bin/env bun
/**
 * check-hosted-recipe-tags.ts — FRESCO-999 (audit 7b, A7-TEST-01)
 *
 * Runs the allergen/diet oracle (`tests/db/recipe-allergen-diet-rules.ts`) over the HOSTED recipe
 * catalogue and fails on ANY finding. The coherence test in `tests/db/` only sees the local
 * `seed.sql` snapshot (and tolerates the findings listed in
 * `recipe-allergen-diet-known-gaps.ts` while the data cards land); this is the check on the data
 * real users receive, with no tolerance list.
 *
 * It reads a JSON dump of the active recipes, so the oracle never touches the database itself:
 *
 *   supabase db query --linked -o json "select slug, nombre, alergenos, dieta, \
 *     ingredientes_principales, pasos_resumen from public.recipes where activo order by id" \
 *     > catalogue.json
 *   bun scripts/check-hosted-recipe-tags.ts catalogue.json
 *
 * The dump is a read-only SELECT. It runs from `.github/workflows/hosted-catalog-allergen-audit.yml`
 * (nightly + on demand), never on the per-PR path, because it needs a token for the production
 * project (ADR-0017).
 *
 * Exit codes: 0 clean, 1 findings, 2 unusable input (an empty or truncated dump must not read
 * as "clean").
 *
 * Usage:
 *   bun scripts/check-hosted-recipe-tags.ts <catalogue.json>   # or `-` for stdin
 */

import type { Finding, RecipeTags } from '../tests/db/recipe-allergen-diet-rules';
import { auditRecipeFindings } from '../tests/db/recipe-allergen-diet-rules';

/** The catalogue holds 500+ active recipes; fewer means the dump failed, not that the data is clean. */
export const MIN_ACTIVE_RECIPES = 400;

/** Accepts the `{ "rows": [...] }` shape of `supabase db query -o json` or a bare array; ignores any text before the JSON. */
export function parseCatalogue(raw: string): RecipeTags[] {
  const start = raw.search(/[[{]/);
  if (start === -1) { throw new Error('no JSON found in the input'); }
  const parsed: unknown = JSON.parse(raw.slice(start));
  const rows = Array.isArray(parsed) ? parsed : (parsed as { rows?: unknown }).rows;
  if (!Array.isArray(rows)) { throw new TypeError('expected a JSON array or an object with a "rows" array'); }
  return rows as RecipeTags[];
}

export function auditCatalogue(rows: RecipeTags[]): { checked: number, findings: Finding[] } {
  if (rows.length < MIN_ACTIVE_RECIPES) {
    throw new Error(`only ${rows.length} recipes in the dump (expected at least ${MIN_ACTIVE_RECIPES}): the dump is incomplete, not clean`);
  }
  return { checked: rows.length, findings: rows.flatMap(auditRecipeFindings) };
}

async function main(): Promise<number> {
  const source = process.argv[2];
  if (!source) {
    console.error('usage: bun scripts/check-hosted-recipe-tags.ts <catalogue.json | ->');
    return 2;
  }
  let result: ReturnType<typeof auditCatalogue>;
  try {
    const raw = source === '-' ? await Bun.stdin.text() : await Bun.file(source).text();
    result = auditCatalogue(parseCatalogue(raw));
  }
  catch (error) {
    console.error(`check-hosted-recipe-tags: ${(error as Error).message}`);
    return 2;
  }
  if (result.findings.length === 0) {
    console.log(`Hosted catalogue clean: ${result.checked} active recipes, 0 findings.`);
    return 0;
  }
  const recipes = new Set(result.findings.map(finding => finding.key.split('|')[0]));
  console.log(`Hosted catalogue: ${result.findings.length} findings in ${recipes.size} of ${result.checked} active recipes.\n`);
  for (const finding of result.findings) { console.log(`- ${finding.key}: ${finding.message}`); }
  return 1;
}

if (import.meta.main) { process.exit(await main()); }
