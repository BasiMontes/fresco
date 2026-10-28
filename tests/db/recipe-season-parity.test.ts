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

import type { SeasonExceptions, SeasonTable } from './recipe-season-rules';
import { describe, expect, test } from 'bun:test';
import { rest, restAll, rpc, stackReachable } from './harness';
import { computeRecipeSeason, computeRecipeTemporada, recipeTemporadaProblem } from './recipe-season-rules';

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

async function loadExceptions(): Promise<SeasonExceptions> {
  const { status, body } = await rest('recipe_season_exceptions', { serviceRole: true, query: 'select=slug,temporadas' });
  expect(status).toBe(200);
  return new Map((body as { slug: string, temporadas: string[] }[]).map(row => [row.slug, row.temporadas]));
}

async function sqlSeason(ingredientes: unknown, slug: unknown, clasificacion: unknown): Promise<string[] | null> {
  const { status, body } = await rpc(
    'compute_recipe_season',
    { p_ingredientes: ingredientes, p_slug: slug, p_clasificacion: clasificacion },
    { serviceRole: true },
  );
  expect(status).toBe(200);
  return body as string[] | null;
}

interface DishProbe {
  name: string
  ingredientes: unknown
  slug: unknown
  clasificacion: unknown
}

const DISH_PROBES: DishProbe[] = [
  { name: 'stew with no seasonal ingredient', ingredientes: ['ternera', 'vino tinto'], slug: 'guiso-x', clasificacion: { categoria: 'guiso' } },
  { name: 'soup with no seasonal ingredient', ingredientes: ['pollo', 'fideos'], slug: 'sopa-x', clasificacion: { categoria: 'sopa', es_ligero: true } },
  { name: 'hearty legumes', ingredientes: ['lentejas'], slug: 'lentejas-x', clasificacion: { categoria: 'legumbres', es_ligero: false } },
  { name: 'legumes with no light flag', ingredientes: ['lentejas'], slug: 'lentejas-y', clasificacion: { categoria: 'legumbres' } },
  { name: 'light legumes', ingredientes: ['tempeh'], slug: 'tempeh-x', clasificacion: { categoria: 'legumbres', es_ligero: true } },
  { name: 'comfort flags do not decide', ingredientes: [], slug: 'bizcocho-x', clasificacion: { categoria: 'reposteria', es_comfort_food: true, es_contundente: true } },
  { name: 'ingredient season beats the dish', ingredientes: ['calabacín'], slug: 'crema-x', clasificacion: { categoria: 'sopa' } },
  { name: 'conflict stays null', ingredientes: ['guisantes', 'apio'], slug: 'guiso-y', clasificacion: { categoria: 'guiso' } },
  { name: 'exception to summer', ingredientes: ['tomate', 'pan'], slug: 'salmorejo-cordobes-b115', clasificacion: { categoria: 'sopa', es_ligero: true } },
  { name: 'exception to all year', ingredientes: ['lentejas'], slug: 'hamburguesa-de-lentejas-y-zanahoria-b48', clasificacion: { categoria: 'legumbres', es_ligero: false } },
  { name: 'exception ignored when ingredients decide', ingredientes: ['espárragos'], slug: 'salmorejo-cordobes-b115', clasificacion: { categoria: 'sopa' } },
  { name: 'classification null', ingredientes: [], slug: 'x', clasificacion: null },
  { name: 'classification not an object', ingredientes: [], slug: 'x', clasificacion: 'guiso' },
  { name: 'slug null', ingredientes: [], slug: null, clasificacion: { categoria: 'sopa' } },
  { name: 'ingredients null', ingredientes: null, slug: 'x', clasificacion: { categoria: 'guiso' } },
];

describe.skipIf(!(RUN && reachable))('compute_recipe_season (SQL) equals the TypeScript twin (real DB, FRESCO-1059)', () => {
  test('every recipe of the catalogue gets the same season', async () => {
    const table = await loadTable();
    const exceptions = await loadExceptions();
    const rows = await restAll<{ slug: string, ingredientes_principales: unknown, clasificacion: unknown }>('recipes', {
      serviceRole: true,
      select: 'slug,ingredientes_principales,clasificacion',
      order: 'id',
    });

    const sql = await inChunks(rows, async row => sqlSeason(row.ingredientes_principales, row.slug, row.clasificacion));
    const different = rows
      .map((row, index) => ({
        slug: row.slug,
        ts: computeRecipeSeason(row.ingredientes_principales, row.slug, row.clasificacion, table, exceptions),
        sql: sql[index],
      }))
      .filter(row => JSON.stringify(row.ts) !== JSON.stringify(row.sql));

    expect(exceptions.size).toBeGreaterThan(0);
    expect(rows.length).toBeGreaterThan(1000);
    expect(different).toEqual([]);
  }, TIMEOUT_MS);

  test('every hand-written probe gets the same season', async () => {
    const table = await loadTable();
    const exceptions = await loadExceptions();
    const sql = await inChunks(DISH_PROBES, async probe => sqlSeason(probe.ingredientes, probe.slug, probe.clasificacion));

    const different = DISH_PROBES
      .map((probe, index) => ({
        name: probe.name,
        ts: computeRecipeSeason(probe.ingredientes, probe.slug, probe.clasificacion, table, exceptions),
        sql: sql[index],
      }))
      .filter(row => JSON.stringify(row.ts) !== JSON.stringify(row.sql));

    expect(different).toEqual([]);
  }, TIMEOUT_MS);

  test('the function and the exceptions table are not an API: anon cannot reach them', async () => {
    const fn = await rpc('compute_recipe_season', { p_ingredientes: [], p_slug: 'x', p_clasificacion: {} });
    const table = await rest('recipe_season_exceptions', { query: 'select=slug' });

    expect(fn.status).toBeGreaterThanOrEqual(400);
    expect(table.status).toBeGreaterThanOrEqual(400);
  });
});
