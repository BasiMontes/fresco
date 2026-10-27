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
    expect(await compute(['tomate', 'apio'])).toEqual(['otono', 'invierno']);
  });

  test('one seasonal ingredient gives its own seasons, in calendar order', async () => {
    expect(await compute(['pollo', 'calabacín'])).toEqual(['primavera', 'verano']);
  });

  test('several seasonal ingredients give the seasons they share', async () => {
    expect(await compute(['pimiento', 'berenjena'])).toEqual(['verano', 'otono']);
    expect(await compute(['espinacas', 'apio', 'brócoli'])).toEqual(['otono', 'invierno']);
  });

  test('the match ignores case', async () => {
    expect(await compute(['Espárragos'])).toEqual(['primavera']);
    expect(await compute(['COLES DE BRUSELAS'])).toEqual(['otono', 'invierno']);
  });

  test('ingredients with no common season give NULL, to be reviewed by hand', async () => {
    expect(await compute(['guisantes', 'apio'])).toBeNull();
    expect(await compute(['calabacín', 'puerro'])).toBeNull();
  });

  test('an empty list is all year', async () => {
    expect(await compute([])).toEqual(['todo_el_ano']);
  });

  test('the lookup table and the function are not readable by a client', async () => {
    const table = await rest('ingredient_seasons', { query: 'select=nombre&limit=1' });
    expect([401, 403]).toContain(table.status);

    const fn = await rpc('compute_recipe_temporada', { p_ingredientes: ['apio'] });
    expect([401, 403, 404]).toContain(fn.status);
  });

  test('every active recipe carries the computed season, except those in conflict', async () => {
    const rows = await restAll<{ nombre: string, activo: boolean, temporada: string[] | null, ingredientes_principales: string[] }>('recipes', {
      serviceRole: true,
      select: 'nombre,activo,temporada,ingredientes_principales',
      order: 'id',
    });
    const recipes = rows.filter(r => r.activo);
    expect(recipes.length).toBeGreaterThan(0);

    const wrong: string[] = [];
    const conflicts: string[] = [];
    for (const r of recipes) {
      const expected = await compute(r.ingredientes_principales);
      if (expected === null) { conflicts.push(r.nombre); continue; }
      if (JSON.stringify(r.temporada) !== JSON.stringify(expected)) { wrong.push(`${r.nombre}: ${JSON.stringify(r.temporada)} != ${JSON.stringify(expected)}`); }
    }

    expect(wrong).toEqual([]);
    // The conflicts are a short list a person resolves; a jump here means the table or the recipes drifted.
    expect(conflicts.length).toBeLessThanOrEqual(10);
  });
});
