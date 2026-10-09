/**
 * FRESCO-861 — two checks on `recipes`: `recipes_nombre_sin_con_repetido` (a name
 * cannot repeat the word "con") and `recipes_categoria_en_contrato`
 * (`clasificacion.categoria` must be a category of `CategoriaReceta`). Also pins
 * that no catalogue recipe breaks either rule: the "0 titles with a repeated con,
 * 0 categories outside the contract" of the ticket, checked by the database the
 * suite runs against.
 *
 * Runs only when `RUN_DB_INTEGRATION=1` AND the local Supabase stack answers —
 * `bun run test:db`. A bare `bun test` skips the whole file.
 */

import { afterAll, describe, expect, test } from 'bun:test';
import { RECIPE_CATEGORIES } from '../../lib/recipes/category-gradient';
import { rest, restAll, stackReachable } from './harness';

const RUN = process.env.RUN_DB_INTEGRATION === '1';
const reachable = RUN ? await stackReachable() : false;

describe.skipIf(!(RUN && reachable))('recipes title and category checks (real DB)', () => {
  const created: string[] = [];

  async function insertRecipe({ nombre, categoria }: { nombre?: string, categoria?: string }) {
    const slug = `fresco-861-${crypto.randomUUID()}`;
    const res = await rest('recipes', {
      method: 'POST',
      serviceRole: true,
      prefer: 'return=representation',
      body: {
        nombre: nombre ?? slug,
        slug,
        clasificacion: { categoria: categoria ?? 'sopa', tipo_plato: 'comida' },
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
      // service_role has no DELETE on recipes: soft-delete the throwaway rows.
      await rest('recipes', { method: 'PATCH', serviceRole: true, query: `id=eq.${id}`, body: { activo: false } });
    }
  });

  test('accepts a name with a single "con", and a name with a repeated word that is not "con"', async () => {
    expect((await insertRecipe({ nombre: `Tempeh con ajo y limón ${crypto.randomUUID()}` })).status).toBe(201);
    expect((await insertRecipe({ nombre: `Contundente consomé ${crypto.randomUUID()}` })).status).toBe(201);
  });

  test('rejects a name that repeats "con", whatever the case', async () => {
    const res = await insertRecipe({ nombre: 'Tempeh a la plancha con ajo con limón' });

    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toContain('recipes_nombre_sin_con_repetido');
    expect((await insertRecipe({ nombre: 'Muesli CON leche Con miel' })).status).toBe(400);
  });

  test('rejects an update that renames a recipe to a repeated "con", and leaves it untouched', async () => {
    const created = await insertRecipe({ nombre: `Bol de skyr ${crypto.randomUUID()}` });
    const row = (created.body as { id: string, nombre: string }[])[0];

    const res = await rest('recipes', {
      method: 'PATCH',
      serviceRole: true,
      query: `id=eq.${row.id}`,
      body: { nombre: 'Bol con fresas con miel' },
    });

    expect(res.status).toBe(400);
    const reread = await rest('recipes', { serviceRole: true, query: `id=eq.${row.id}&select=nombre` });
    expect((reread.body as { nombre: string }[])[0].nombre).toBe(row.nombre);
  });

  test('accepts every category of the contract', async () => {
    for (const categoria of RECIPE_CATEGORIES) {
      expect((await insertRecipe({ categoria })).status, categoria).toBe(201);
    }
  });

  test('rejects a category outside the contract, including the old spellings', async () => {
    for (const categoria of ['bowl', 'vegetal', 'postre', '']) {
      const res = await insertRecipe({ categoria });

      expect(res.status, categoria).toBe(400);
      expect(JSON.stringify(res.body)).toContain('recipes_categoria_en_contrato');
    }
  });

  test('no catalogue recipe repeats "con" in its name or uses a category outside the contract', async () => {
    const rows = await restAll<{ nombre: string, clasificacion: { categoria?: string } | null }>('recipes', {
      serviceRole: true,
      select: 'nombre,clasificacion',
      order: 'id',
    });
    expect(rows.length).toBeGreaterThan(1000);

    const repeatedCon = rows.filter(row => (row.nombre.match(/\bcon\b/gi) ?? []).length >= 2).map(row => row.nombre);
    const outsideContract = rows
      .map(row => row.clasificacion?.categoria)
      .filter((categoria): categoria is string => categoria !== undefined && !(RECIPE_CATEGORIES as string[]).includes(categoria));

    expect(repeatedCon).toEqual([]);
    expect(outsideContract).toEqual([]);
  });
});
