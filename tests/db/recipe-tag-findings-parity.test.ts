/**
 * FRESCO-1020 — `public.recipe_tag_findings` (SQL) says the same as `auditRecipeFindings` (TypeScript,
 * `recipe-allergen-diet-rules.ts`) for the same recipe. Two copies of a rule table drift unless
 * something compares them, so this runs both on:
 *
 *   1. one probe per word of every keyword list, as an ingredient, as a step and with every tag set
 *      (`recipe-tag-parity-cases.ts`): the real catalogue is almost clean, so a word mistyped in SQL
 *      would never be exercised by it;
 *   2. every recipe of the catalogue, active and inactive.
 *
 * The comparison is on the SET of rule keys (`falta:gluten`, `dieta:keto`), not on the wording of the
 * detail. The helpers are not an API: anon and authenticated cannot execute them.
 *
 * Runs only when `RUN_DB_INTEGRATION=1` AND the local Supabase stack answers —
 * `bun run test:db`. A bare `bun test` skips the whole file (see `tests/db/README.md`).
 */

import type { ParityCase } from './recipe-tag-parity-cases';
import { describe, expect, test } from 'bun:test';
import { restAll, rpc, stackReachable } from './harness';
import { buildCases, oracleRules } from './recipe-tag-parity-cases';

const RUN = process.env.RUN_DB_INTEGRATION === '1';
const reachable = RUN ? await stackReachable() : false;

/** A thousand RPC calls take longer than bun's 5 s default per test. */
const TIMEOUT_MS = 90_000;

interface RecipeRow {
  slug: string
  nombre: string
  alergenos: string[] | null
  dieta: Record<string, boolean> | null
  ingredientes_principales: string[] | null
  pasos_resumen: string[] | null
}

/** The SQL function's rule keys for a recipe, sorted and without duplicates. */
async function sqlRules(recipe: { alergenos: string[] | null, dieta: Record<string, boolean> | null, ingredientes: string[] | null, pasos: string[] | null }): Promise<string[]> {
  const { status, body } = await rpc('recipe_tag_findings', {
    p_alergenos: recipe.alergenos ?? [],
    p_dieta: recipe.dieta ?? {},
    p_ingredientes: recipe.ingredientes ?? [],
    p_pasos: recipe.pasos ?? [],
  }, { serviceRole: true });
  expect(status).toBe(200);
  return [...new Set((body as { rule: string }[]).map(row => row.rule))].sort();
}

/** Runs `task` over `items` a few at a time, so a thousand probes do not open a thousand sockets. */
async function inChunks<T, R>(items: T[], task: (item: T) => Promise<R>, size = 25): Promise<R[]> {
  const results: R[] = [];
  for (let start = 0; start < items.length; start += size) {
    results.push(...await Promise.all(items.slice(start, start + size).map(task)));
  }
  return results;
}

describe.skipIf(!(RUN && reachable))('recipe_tag_findings (SQL) equals the TypeScript oracle (real DB)', () => {
  test('every probe built from the oracle word lists gets the same rule keys', async () => {
    const probes: ParityCase[] = buildCases();
    const answers = await inChunks(probes, async probe => sqlRules({ alergenos: probe.alergenos, dieta: probe.dieta, ingredientes: probe.ingredientes, pasos: probe.pasos }));

    const different = probes
      .map((probe, index) => ({ name: probe.name, ts: oracleRules(probe), sql: answers[index] }))
      .filter(row => JSON.stringify(row.ts) !== JSON.stringify(row.sql));

    expect(probes.length).toBeGreaterThan(900);
    expect(different).toEqual([]);
  }, TIMEOUT_MS);

  test('every recipe of the catalogue gets the same rule keys, active or not', async () => {
    const rows = await restAll<RecipeRow>('recipes', {
      serviceRole: true,
      select: 'slug,nombre,alergenos,dieta,ingredientes_principales,pasos_resumen',
      order: 'id',
    });
    const answers = await inChunks(rows, async row => sqlRules({ alergenos: row.alergenos, dieta: row.dieta, ingredientes: row.ingredientes_principales, pasos: row.pasos_resumen }));

    const different = rows
      .map((row, index) => ({
        slug: row.slug,
        ts: oracleRules({ name: row.slug, alergenos: row.alergenos ?? [], dieta: row.dieta ?? {}, ingredientes: row.ingredientes_principales ?? [], pasos: row.pasos_resumen ?? [] }),
        sql: answers[index],
      }))
      .filter(row => JSON.stringify(row.ts) !== JSON.stringify(row.sql));

    expect(rows.length).toBeGreaterThan(1000);
    expect(different).toEqual([]);
  }, TIMEOUT_MS);

  test('the rule helpers are not an API: anon cannot execute them', async () => {
    const { status } = await rpc('recipe_tag_findings', { p_alergenos: [], p_dieta: {}, p_ingredientes: ['leche'], p_pasos: [] });

    expect(status).toBeGreaterThanOrEqual(400);
  });
});
