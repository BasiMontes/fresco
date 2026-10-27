/**
 * FRESCO-1058 — `compute_recipe_temporada` and `recipe_temporada_problem` (SQL) say the same as
 * `computeRecipeTemporada` and `recipeTemporadaProblem` (TypeScript, `recipe-season-rules.ts`). Two copies of
 * a rule drift unless something compares them, so this runs both on:
 *
 *   1. every recipe of the catalogue, active and inactive, with its stored season;
 *   2. hand-written probes for the branches the catalogue may not exercise (conflicts, bad shapes, order).
 *
 * The computed season is compared exactly; the problem is compared as null versus non-null, not by wording.
 * The helpers are not an API: anon and authenticated cannot execute them.
 *
 * Runs only when `RUN_DB_INTEGRATION=1` AND the local Supabase stack answers —
 * `bun run test:db`. A bare `bun test` skips the whole file (see `tests/db/README.md`).
 */

import type { SeasonTable } from './recipe-season-rules';
import { describe, expect, test } from 'bun:test';
import { rest, restAll, rpc, stackReachable } from './harness';
import { computeRecipeTemporada, recipeTemporadaProblem } from './recipe-season-rules';

const RUN = process.env.RUN_DB_INTEGRATION === '1';
const reachable = RUN ? await stackReachable() : false;

/** A thousand RPC calls take longer than bun's 5 s default per test. */
const TIMEOUT_MS = 120_000;

interface RecipeRow {
  ingredientes_principales: unknown
  temporada: unknown
  activo: boolean
}

interface Probe {
  name: string
  temporada: unknown
  ingredientes: unknown
}

async function loadTable(): Promise<SeasonTable> {
  const { status, body } = await rest('ingredient_seasons', { serviceRole: true, query: 'select=nombre,temporadas' });
  expect(status).toBe(200);
  return new Map((body as { nombre: string, temporadas: string[] }[]).map(row => [row.nombre, row.temporadas]));
}

/** Runs `task` over `items` a few at a time, so a thousand probes do not open a thousand sockets. */
async function inChunks<T, R>(items: T[], task: (item: T) => Promise<R>, size = 50): Promise<R[]> {
  const results: R[] = [];
  for (let start = 0; start < items.length; start += size) {
    results.push(...await Promise.all(items.slice(start, start + size).map(task)));
  }
  return results;
}

async function sqlComputed(ingredientes: unknown): Promise<string[] | null> {
  const { status, body } = await rpc('compute_recipe_temporada', { p_ingredientes: ingredientes }, { serviceRole: true });
  expect(status).toBe(200);
  return body as string[] | null;
}

/** True when `recipe_temporada_problem` found nothing wrong. */
async function sqlIsFine(temporada: unknown, ingredientes: unknown): Promise<boolean> {
  const { status, body } = await rpc('recipe_temporada_problem', { p_temporada: temporada, p_ingredientes: ingredientes }, { serviceRole: true });
  expect(status).toBe(200);
  return body === null;
}

const PROBES: Probe[] = [
  { name: 'single seasonal ingredient', temporada: ['primavera'], ingredientes: ['espárragos'] },
  { name: 'accents and upper case', temporada: ['otono', 'invierno'], ingredientes: ['COLES DE BRUSELAS', 'Apio'] },
  { name: 'wrong season for the ingredient', temporada: ['verano'], ingredientes: ['espárragos'] },
  { name: 'all year on a seasonal recipe', temporada: ['todo_el_ano'], ingredientes: ['espárragos'] },
  { name: 'season on a recipe with no seasonal ingredient', temporada: ['verano'], ingredientes: ['tomate', 'aceite'] },
  { name: 'tomate is all year', temporada: ['todo_el_ano'], ingredientes: ['tomate'] },
  { name: 'empty ingredient list', temporada: ['todo_el_ano'], ingredientes: [] },
  { name: 'ingredients not an array', temporada: ['todo_el_ano'], ingredientes: { a: 'espárragos' } },
  { name: 'ingredients null', temporada: ['todo_el_ano'], ingredientes: null },
  { name: 'ingredients with non-text elements', temporada: ['primavera'], ingredientes: [null, 5, 'guisantes'] },
  { name: 'conflict with a valid value', temporada: ['primavera'], ingredientes: ['guisantes', 'apio'] },
  { name: 'conflict with all year', temporada: ['todo_el_ano'], ingredientes: ['guisantes', 'apio'] },
  { name: 'conflict with an invalid value', temporada: ['invierno', 'otono'], ingredientes: ['guisantes', 'apio'] },
  { name: 'all year mixed with a season', temporada: ['todo_el_ano', 'verano'], ingredientes: ['tomate'] },
  { name: 'wrong order', temporada: ['invierno', 'otono'], ingredientes: ['apio'] },
  { name: 'repeats', temporada: ['verano', 'verano'], ingredientes: ['pimiento', 'calabacín'] },
  { name: 'otoño with ñ', temporada: ['otoño'], ingredientes: ['tomate'] },
  { name: 'upper case season', temporada: ['Primavera'], ingredientes: ['espárragos'] },
  { name: 'empty season', temporada: [], ingredientes: ['tomate'] },
  { name: 'season not an array', temporada: 'primavera', ingredientes: ['espárragos'] },
  { name: 'season null', temporada: null, ingredientes: ['tomate'] },
  { name: 'season with non-text values', temporada: ['primavera', 2], ingredientes: ['espárragos'] },
  { name: 'calendar order across the year boundary', temporada: ['primavera', 'invierno'], ingredientes: ['alcachofas'] },
];

describe.skipIf(!(RUN && reachable))('compute_recipe_temporada / recipe_temporada_problem (SQL) equal the TypeScript oracle (real DB)', () => {
  test('every recipe of the catalogue gets the same computed season and the same verdict', async () => {
    const table = await loadTable();
    const rows = await restAll<RecipeRow>('recipes', {
      serviceRole: true,
      select: 'ingredientes_principales,temporada,activo',
      order: 'id',
    });

    const answers = await inChunks(rows, async row => ({
      computed: await sqlComputed(row.ingredientes_principales),
      fine: await sqlIsFine(row.temporada, row.ingredientes_principales),
    }));

    const different = rows
      .map((row, index) => ({
        ingredientes: row.ingredientes_principales,
        temporada: row.temporada,
        ts: { computed: computeRecipeTemporada(row.ingredientes_principales, table), fine: recipeTemporadaProblem(row.temporada, row.ingredientes_principales, table) === null },
        sql: answers[index],
      }))
      .filter(row => JSON.stringify(row.ts) !== JSON.stringify(row.sql));

    expect(table.size).toBeGreaterThan(30);
    expect(rows.length).toBeGreaterThan(1000);
    expect(different).toEqual([]);
  }, TIMEOUT_MS);

  test('every hand-written probe gets the same computed season and the same verdict', async () => {
    const table = await loadTable();
    const answers = await inChunks(PROBES, async probe => ({
      computed: await sqlComputed(probe.ingredientes),
      fine: await sqlIsFine(probe.temporada, probe.ingredientes),
    }));

    const different = PROBES
      .map((probe, index) => ({
        name: probe.name,
        ts: { computed: computeRecipeTemporada(probe.ingredientes, table), fine: recipeTemporadaProblem(probe.temporada, probe.ingredientes, table) === null },
        sql: answers[index],
      }))
      .filter(row => JSON.stringify(row.ts) !== JSON.stringify(row.sql));

    expect(different).toEqual([]);
  }, TIMEOUT_MS);

  test('the rule helpers are not an API: anon cannot execute them', async () => {
    const { status } = await rpc('compute_recipe_temporada', { p_ingredientes: ['espárragos'] });

    expect(status).toBeGreaterThanOrEqual(400);
  });
});
