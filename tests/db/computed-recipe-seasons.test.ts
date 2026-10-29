/**
 * FRESCO-1058 — a recipe's season is computed from its ingredients. `compute_recipe_temporada` returns the
 * seasons shared by every seasonal ingredient (calendar order), `todo_el_ano` when none is seasonal and NULL
 * when the ingredients share no season. The backfill in the same migration wrote that value to every recipe
 * with a clear answer; the ones in conflict keep whatever they had and wait for a manual decision.
 *
 * Runs only when `RUN_DB_INTEGRATION=1` AND the local Supabase stack answers —
 * `bun run test:db`. A bare `bun test` skips the whole file (see `tests/db/README.md`).
 */

import { describe, expect, test } from 'bun:test';
import { rest, restAll, rpc, stackReachable } from './harness';

const RUN = process.env.RUN_DB_INTEGRATION === '1';
const reachable = RUN ? await stackReachable() : false;

const compute = async (ingredientes: string[]) => {
  const res = await rpc('compute_recipe_temporada', { p_ingredientes: ingredientes }, { serviceRole: true });
  expect(res.status).toBe(200);
  return res.body as string[] | null;
};

describe.skipIf(!(RUN && reachable))('computed recipe seasons (real DB)', () => {
  test('a recipe with no seasonal ingredient is all year', async () => {
    expect(await compute(['arroz', 'pollo', 'cebolla'])).toEqual(['todo_el_ano']);
  });

  test('tomate is sold all year, so it never constrains a recipe', async () => {
    expect(await compute(['tomate', 'arroz'])).toEqual(['todo_el_ano']);
    expect(await compute(['tomate', 'kale'])).toEqual(['otono', 'invierno']);
  });

  test('one seasonal ingredient gives its own seasons, in calendar order', async () => {
    expect(await compute(['pollo', 'frutos rojos'])).toEqual(['primavera', 'verano']);
  });

  test('several seasonal ingredients give the seasons they share', async () => {
    expect(await compute(['alcachofas', 'espárragos'])).toEqual(['primavera']);
    expect(await compute(['kale', 'berza', 'coles de bruselas'])).toEqual(['otono', 'invierno']);
  });

  test('a vegetable found all year in a supermarket is not seasonal (FRESCO-1063)', async () => {
    expect(await compute(['manzana', 'lechuga', 'pimiento', 'calabacín', 'espinacas'])).toEqual(['todo_el_ano']);
    expect(await compute(['manzana', 'espárragos'])).toEqual(['primavera']);
  });

  test('the match ignores case', async () => {
    expect(await compute(['Espárragos'])).toEqual(['primavera']);
    expect(await compute(['COLES DE BRUSELAS'])).toEqual(['otono', 'invierno']);
  });

  test('ingredients with no common season give NULL, to be reviewed by hand', async () => {
    expect(await compute(['guisantes', 'kale'])).toBeNull();
    expect(await compute(['frutos rojos', 'kale'])).toBeNull();
  });

  test('an empty list is all year', async () => {
    expect(await compute([])).toEqual(['todo_el_ano']);
  });

  test('the lookup table and the function are not readable by a client', async () => {
    const table = await rest('ingredient_seasons', { query: 'select=nombre&limit=1' });
    expect([401, 403]).toContain(table.status);

    const fn = await rpc('compute_recipe_temporada', { p_ingredientes: ['kale'] });
    expect([401, 403, 404]).toContain(fn.status);
  });

  test('every active recipe carries the computed season, except those in conflict', async () => {
    const rows = await restAll<{ nombre: string, slug: string, activo: boolean, temporada: string[] | null, ingredientes_principales: string[], clasificacion: unknown }>('recipes', {
      serviceRole: true,
      select: 'nombre,slug,activo,temporada,ingredientes_principales,clasificacion',
      order: 'id',
    });
    const recipes = rows.filter(r => r.activo);
    expect(recipes.length).toBeGreaterThan(0);

    const wrong: string[] = [];
    const conflicts: string[] = [];
    for (const r of recipes) {
      // FRESCO-1059: the ingredients first, then the dish type (see recipe-dish-season.test.ts).
      const res = await rpc('compute_recipe_season', { p_ingredientes: r.ingredientes_principales, p_slug: r.slug, p_clasificacion: r.clasificacion }, { serviceRole: true });
      expect(res.status).toBe(200);
      const expected = res.body as string[] | null;
      if (expected === null) { conflicts.push(r.nombre); continue; }
      if (JSON.stringify(r.temporada) !== JSON.stringify(expected)) { wrong.push(`${r.nombre}: ${JSON.stringify(r.temporada)} != ${JSON.stringify(expected)}`); }
    }

    expect(wrong).toEqual([]);
    // The conflicts are a short list a person resolves; a jump here means the table or the recipes drifted.
    expect(conflicts.length).toBeLessThanOrEqual(10);
  });
});
