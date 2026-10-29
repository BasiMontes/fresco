/**
 * FRESCO-1058 — an ACTIVE recipe cannot be saved with a season that does not fit its ingredients. The trigger
 * `recipes_temporada_coherence` calls `recipe_temporada_problem` (shape and order of the value, and equality
 * with `compute_recipe_temporada`) and rejects with SQLSTATE 23514 naming the recipe.
 *
 * The rule has three sides: a wrong value is rejected, the right value is accepted, and a conflict (the
 * ingredients share no season, so a person chose) accepts any valid value. Then the three ways a recipe
 * becomes active (insert active, edit an active one, reactivate an inactive one), the draft that is allowed
 * and the write that must not fire the trigger.
 *
 * Runs only when `RUN_DB_INTEGRATION=1` AND the local Supabase stack answers —
 * `bun run test:db`. A bare `bun test` skips the whole file (see `tests/db/README.md`).
 */

import { afterAll, describe, expect, test } from 'bun:test';
import { rest, stackReachable } from './harness';

const RUN = process.env.RUN_DB_INTEGRATION === '1';
const reachable = RUN ? await stackReachable() : false;

const CHECK_VIOLATION = '23514';

/** `kale` is autumn and winter, `frutos rojos` spring and summer: no season in common. */
const CONFLICT = ['kale', 'frutos rojos'];

describe.skipIf(!(RUN && reachable))('recipes_temporada_coherence trigger (real DB)', () => {
  const created: string[] = [];

  async function insert(label: string, ingredientes: string[], temporada: unknown, activo: boolean) {
    const name = `fresco-1058-${label}-${crypto.randomUUID()}`;
    const res = await rest('recipes', {
      method: 'POST',
      serviceRole: true,
      prefer: 'return=representation',
      body: { nombre: name, slug: name, ingredientes_principales: ingredientes, pasos_resumen: [], alergenos: ['apio'], dieta: {}, temporada, activo },
    });
    const id = (res.body as { id?: string }[] | null)?.[0]?.id;
    if (id) { created.push(id); }
    return { res, name, id };
  }

  const patch = async (id: string, changes: Record<string, unknown>) => rest('recipes', { method: 'PATCH', serviceRole: true, query: `id=eq.${id}`, body: changes });

  afterAll(async () => {
    // service_role has no DELETE on recipes: the throwaway rows are retired the way the catalogue does it.
    for (const id of created) { await patch(id, { activo: false }); }
  });

  test('an active recipe whose season does not match its ingredients is rejected, naming both', async () => {
    const { res, name } = await insert('mismatch', ['frutos rojos'], ['otono'], true);

    const error = res.body as { code?: string, message?: string };
    expect(res.status).toBe(400);
    expect(error.code).toBe(CHECK_VIOLATION);
    expect(error.message).toContain(name);
    expect(error.message).toContain('["otono"]');
    expect(error.message).toContain('["primavera", "verano"]');
  });

  test('the season the function computes is accepted', async () => {
    expect((await insert('match', ['frutos rojos'], ['primavera', 'verano'], true)).res.status).toBe(201);
    expect((await insert('all-year', ['arroz', 'pollo'], ['todo_el_ano'], true)).res.status).toBe(201);
  });

  test('a recipe with no season at all is rejected', async () => {
    for (const temporada of [null, [], 'verano', { verano: true }]) {
      const { res } = await insert('shape', ['arroz'], temporada, true);
      expect((res.body as { code?: string }).code).toBe(CHECK_VIOLATION);
    }
  });

  test('a value outside the vocabulary, a repeat, the wrong order or todo_el_ano mixed with a season is rejected', async () => {
    for (const temporada of [['otoño'], ['verano', 'verano'], ['invierno', 'otono'], ['todo_el_ano', 'verano']]) {
      const { res } = await insert('vocabulary', CONFLICT, temporada, true);
      expect(res.status).toBe(400);
      expect((res.body as { code?: string }).code).toBe(CHECK_VIOLATION);
    }
  });

  test('ingredients with no common season accept any valid value: a person chose', async () => {
    expect((await insert('conflict-a', CONFLICT, ['otono', 'invierno'], true)).res.status).toBe(201);
    expect((await insert('conflict-b', CONFLICT, ['primavera'], true)).res.status).toBe(201);
  });

  test('an inactive recipe is a draft: it saves with a season that does not fit', async () => {
    expect((await insert('draft', ['frutos rojos'], ['otono'], false)).res.status).toBe(201);
  });

  test('a draft may have no season, but whatever season it carries is well formed', async () => {
    expect((await insert('draft-null', ['arroz'], null, false)).res.status).toBe(201);

    for (const temporada of [[], 'verano', ['otoño'], ['verano', 'verano'], ['invierno', 'otono'], ['todo_el_ano', 'verano']]) {
      const { res } = await insert('draft-shape', ['arroz'], temporada, false);
      expect(res.status).toBe(400);
      expect((res.body as { code?: string }).code).toBe(CHECK_VIOLATION);
    }
  });

  test('a draft cannot be edited into a malformed season', async () => {
    const { id } = await insert('draft-edit', ['arroz'], ['todo_el_ano'], false);

    const res = await patch(id as string, { temporada: ['otoño'] });

    expect(res.status).toBe(400);
    expect((res.body as { code?: string }).code).toBe(CHECK_VIOLATION);
  });

  test('reactivating a draft whose season still does not fit is rejected', async () => {
    const { id } = await insert('reactivate', ['frutos rojos'], ['otono'], false);

    const res = await patch(id as string, { activo: true });

    expect(res.status).toBe(400);
    expect((res.body as { code?: string }).code).toBe(CHECK_VIOLATION);
  });

  test('editing the ingredients of an active recipe so its season no longer fits is rejected', async () => {
    const { id } = await insert('edit-ingredients', ['arroz'], ['todo_el_ano'], true);

    const res = await patch(id as string, { ingredientes_principales: ['frutos rojos'] });

    expect(res.status).toBe(400);
    expect((res.body as { code?: string }).code).toBe(CHECK_VIOLATION);
  });

  test('fixing the season and the ingredients in the same statement is accepted', async () => {
    const { id } = await insert('fix-both', ['arroz'], ['todo_el_ano'], true);

    const res = await patch(id as string, { ingredientes_principales: ['frutos rojos'], temporada: ['primavera', 'verano'] });

    expect(res.status).toBe(204);
  });

  test('a write that touches none of the columns the rule reads does not fire it', async () => {
    const { id } = await insert('counters', ['arroz'], ['todo_el_ano'], true);

    expect((await patch(id as string, { veces_cocinada: 3 })).status).toBe(204);
  });
});
