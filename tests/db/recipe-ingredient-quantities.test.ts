/**
 * FRESCO-863 / ADR-0042 — `recipes.ingredientes_cantidades` shape is enforced by
 * the database, not only by the zod boundary: a quantity row that is malformed,
 * uses a unit outside the closed list, or names an ingredient that
 * `ingredientes_principales` does not carry must be rejected at write time.
 *
 * Runs only when `RUN_DB_INTEGRATION=1` AND the local Supabase stack answers —
 * `bun run test:db`. A bare `bun test` skips the whole file.
 */

import { afterAll, describe, expect, test } from 'bun:test';
import { rest, stackReachable } from './harness';

const RUN = process.env.RUN_DB_INTEGRATION === '1';
const reachable = RUN ? await stackReachable() : false;

describe.skipIf(!(RUN && reachable))('recipes.ingredientes_cantidades check (real DB)', () => {
  const created: string[] = [];

  async function insertRecipe(cantidades: unknown) {
    const slug = `fresco-863-${crypto.randomUUID()}`;
    const res = await rest('recipes', {
      method: 'POST',
      serviceRole: true,
      prefer: 'return=representation',
      body: {
        nombre: slug,
        slug,
        ingredientes_principales: ['arroz', 'setas'],
        ingredientes_cantidades: cantidades,
      },
    });
    const id = (res.body as { id?: string }[] | null)?.[0]?.id;
    if (id) {
      created.push(id);
    }
    return res;
  }

  afterAll(async () => {
    for (const id of created) {
      // service_role has no DELETE on recipes (only select/insert/update), so the
      // throwaway row is soft-deleted the way the catalog does it (`activo`).
      await rest('recipes', { method: 'PATCH', serviceRole: true, query: `id=eq.${id}`, body: { activo: false } });
    }
  });

  test('accepts a null column and a well-formed list', async () => {
    expect((await insertRecipe(null)).status).toBe(201);
    expect((await insertRecipe([
      { nombre: 'arroz', cantidad: 300, unidad: 'g' },
      { nombre: 'setas', cantidad: 0, unidad: 'al gusto' },
    ])).status).toBe(201);
  });

  test('rejects a unit outside the closed list', async () => {
    expect((await insertRecipe([{ nombre: 'arroz', cantidad: 3, unidad: 'tazas' }])).status).toBe(400);
  });

  test('rejects a non-positive quantity unless the unit is "al gusto"', async () => {
    expect((await insertRecipe([{ nombre: 'arroz', cantidad: 0, unidad: 'g' }])).status).toBe(400);
  });

  test('rejects an ingredient name that ingredientes_principales does not carry', async () => {
    expect((await insertRecipe([{ nombre: 'gambas', cantidad: 200, unidad: 'g' }])).status).toBe(400);
  });

  test('rejects a value that is not an array of objects', async () => {
    expect((await insertRecipe({ arroz: 300 })).status).toBe(400);
    expect((await insertRecipe(['arroz'])).status).toBe(400);
  });
});
