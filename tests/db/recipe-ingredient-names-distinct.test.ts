/**
 * FRESCO-876 — `recipes_ingredientes_principales_distinct`: a recipe cannot list
 * the same ingredient twice, whatever wrote the row. Also pins that no catalog
 * recipe already does (the "0 duplicates" of the ticket, checked by the database
 * the suite runs against, not by a one-off query).
 *
 * Runs only when `RUN_DB_INTEGRATION=1` AND the local Supabase stack answers —
 * `bun run test:db`. A bare `bun test` skips the whole file.
 */

import { afterAll, describe, expect, test } from 'bun:test';
import { rest, restAll, stackReachable } from './harness';

const RUN = process.env.RUN_DB_INTEGRATION === '1';
const reachable = RUN ? await stackReachable() : false;

describe.skipIf(!(RUN && reachable))('recipes.ingredientes_principales distinct check (real DB)', () => {
  const created: string[] = [];

  async function insertRecipe(ingredientes: unknown) {
    const slug = `fresco-876-${crypto.randomUUID()}`;
    const res = await rest('recipes', {
      method: 'POST',
      serviceRole: true,
      prefer: 'return=representation',
      body: { nombre: slug, slug, ingredientes_principales: ingredientes },
    });
    const id = (res.body as { id?: string }[] | null)?.[0]?.id;
    if (id) {
      created.push(id);
    }
    return res;
  }

  afterAll(async () => {
    for (const id of created) {
      // service_role has no DELETE on recipes: soft-delete the throwaway rows.
      await rest('recipes', { method: 'PATCH', serviceRole: true, query: `id=eq.${id}`, body: { activo: false } });
    }
  });

  test('accepts a list of different ingredients', async () => {
    expect((await insertRecipe(['tempeh', 'limón', 'ajo'])).status).toBe(201);
  });

  test('rejects the same ingredient twice', async () => {
    const res = await insertRecipe(['tempeh', 'limón', 'ajo', 'limón']);

    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toContain('recipes_ingredientes_principales_distinct');
  });

  test('rejects the same ingredient when only the case or the surrounding spaces differ', async () => {
    expect((await insertRecipe(['Limón', 'limón '])).status).toBe(400);
  });

  test('rejects an update that introduces a duplicate into an existing recipe, and leaves it untouched', async () => {
    const created = await insertRecipe(['arroz', 'setas']);
    const id = (created.body as { id: string }[])[0].id;

    const res = await rest('recipes', {
      method: 'PATCH',
      serviceRole: true,
      query: `id=eq.${id}`,
      body: { ingredientes_principales: ['arroz', 'setas', 'arroz'] },
    });

    expect(res.status).toBe(400);
    const reread = await rest('recipes', { serviceRole: true, query: `id=eq.${id}&select=ingredientes_principales` });
    expect((reread.body as { ingredientes_principales: string[] }[])[0].ingredientes_principales).toEqual(['arroz', 'setas']);
  });

  test('no catalog recipe lists an ingredient twice', async () => {
    const rows = await restAll<{ nombre: string, ingredientes_principales: string[] | null }>('recipes', {
      serviceRole: true,
      select: 'nombre,ingredientes_principales',
      order: 'id',
    });
    expect(rows.length).toBeGreaterThan(1000);

    const duplicated = rows
      .filter((row) => {
        const names = (row.ingredientes_principales ?? []).map(name => name.trim().toLowerCase());
        return new Set(names).size !== names.length;
      })
      .map(row => row.nombre);

    expect(duplicated).toEqual([]);
  });
});
