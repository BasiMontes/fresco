/**
 * FRESCO-948 — `jsonb_remove_item`, the undo of "Añadir" in "Sugerencias para ti".
 *
 * `SECURITY INVOKER`, no identity parameter (ADR-0032): RLS already confines the
 * caller to their own list, so the spoof test is the point of this file — user B
 * names user A's list and must change nothing. The function also only removes an
 * item marked `origen: 'sugerencia'`; a meal-plan item is never removed through it.
 *
 * Runs only when `RUN_DB_INTEGRATION=1` AND the local Supabase stack answers —
 * `bun run test:db`. A bare `bun test` skips the whole file (see
 * `tests/db/README.md`).
 */

import type { DbTestUser } from './harness';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { createDbTestContext, rest, rpc, seedMealPlan, seedShoppingList, stackReachable } from './harness';

const RUN = process.env.RUN_DB_INTEGRATION === '1';
const reachable = RUN ? await stackReachable() : false;

interface StoredPasillo { nombre: string, items: { nombre: string, origen?: string }[] }

const ROW = { cantidad: 1, unidad: 'ud', comprado: false };

async function readItems(user: DbTestUser, listId: string): Promise<StoredPasillo[]> {
  const res = await rest('shopping_lists', { token: user.token, query: `id=eq.${listId}&select=items` });
  return (res.body as { items: StoredPasillo[] }[])[0].items;
}

describe.skipIf(!(RUN && reachable))('jsonb_remove_item (real DB)', () => {
  const ctx = createDbTestContext();
  let owner: DbTestUser;
  let other: DbTestUser;
  let weekCounter = 0;

  beforeAll(async () => {
    [owner, other] = await Promise.all([ctx.createUser(), ctx.createUser()]);
  });

  afterAll(async () => ctx.cleanupAll());

  async function seedList(items: unknown[]): Promise<string> {
    weekCounter += 1;
    const week = String(10 + weekCounter).padStart(2, '0');
    const plan = await seedMealPlan(owner, { semanaIso: `2098-W${week}`, fechaInicio: `2098-03-${String(weekCounter + 1).padStart(2, '0')}` });
    return seedShoppingList(owner, plan.id, items);
  }

  test('removes the suggestion item and keeps every other item', async () => {
    const listId = await seedList([
      { nombre: 'Especias', orden: 1, items: [{ nombre: 'Pimienta', ...ROW }, { nombre: 'Jengibre', ...ROW, origen: 'sugerencia' }] },
      { nombre: 'Verduras', orden: 2, items: [{ nombre: 'Tomate', ...ROW }] },
    ]);

    const res = await rpc('jsonb_remove_item', { p_list_id: listId, p_pasillo_nombre: 'Especias', p_item_nombre: 'Jengibre' }, { token: owner.token });

    expect(res.status).toBe(204);
    const after = await readItems(owner, listId);
    expect(after.map(p => p.nombre)).toEqual(['Especias', 'Verduras']);
    expect(after[0].items.map(i => i.nombre)).toEqual(['Pimienta']);
    expect(after[1].items.map(i => i.nombre)).toEqual(['Tomate']);
  });

  test('drops the pasillo when the removed item was its only one', async () => {
    const listId = await seedList([
      { nombre: 'Verduras', orden: 1, items: [{ nombre: 'Tomate', ...ROW }] },
      { nombre: 'Especias', orden: 2, items: [{ nombre: 'Jengibre', ...ROW, origen: 'sugerencia' }] },
    ]);

    const res = await rpc('jsonb_remove_item', { p_list_id: listId, p_pasillo_nombre: 'Especias', p_item_nombre: 'Jengibre' }, { token: owner.token });

    expect(res.status).toBe(204);
    expect((await readItems(owner, listId)).map(p => p.nombre)).toEqual(['Verduras']);
  });

  test('never removes a meal-plan item, even when it is named', async () => {
    const listId = await seedList([
      { nombre: 'Especias', orden: 1, items: [{ nombre: 'Jengibre', ...ROW }] },
    ]);

    const res = await rpc('jsonb_remove_item', { p_list_id: listId, p_pasillo_nombre: 'Especias', p_item_nombre: 'Jengibre' }, { token: owner.token });

    expect(res.status).toBe(204);
    const after = await readItems(owner, listId);
    expect(after[0].items.map(i => i.nombre)).toEqual(['Jengibre']);
  });

  test('only touches the named pasillo when two aisles hold the same item name', async () => {
    const listId = await seedList([
      { nombre: 'Especias', orden: 1, items: [{ nombre: 'Jengibre', ...ROW, origen: 'sugerencia' }] },
      { nombre: 'Frutas y verduras', orden: 2, items: [{ nombre: 'Jengibre', ...ROW, origen: 'sugerencia' }, { nombre: 'Tomate', ...ROW }] },
    ]);

    await rpc('jsonb_remove_item', { p_list_id: listId, p_pasillo_nombre: 'Especias', p_item_nombre: 'Jengibre' }, { token: owner.token });

    const after = await readItems(owner, listId);
    expect(after.map(p => p.nombre)).toEqual(['Frutas y verduras']);
    expect(after[0].items.map(i => i.nombre)).toEqual(['Jengibre', 'Tomate']);
  });

  test('another user cannot remove from this list, and the list is unchanged', async () => {
    const listId = await seedList([
      { nombre: 'Especias', orden: 1, items: [{ nombre: 'Jengibre', ...ROW, origen: 'sugerencia' }] },
    ]);

    const spoof = await rpc('jsonb_remove_item', { p_list_id: listId, p_pasillo_nombre: 'Especias', p_item_nombre: 'Jengibre' }, { token: other.token });

    expect(spoof.status).toBe(400);
    const body = spoof.body as { code?: string, message?: string };
    expect(body.code).toBe('P0001');
    expect(body.message ?? '').toContain('not found or not owned by caller');
    const after = await readItems(owner, listId);
    expect(after[0].items.map(i => i.nombre)).toEqual(['Jengibre']);
  });

  test('an anonymous caller (no session) cannot execute it', async () => {
    const listId = await seedList([
      { nombre: 'Especias', orden: 1, items: [{ nombre: 'Jengibre', ...ROW, origen: 'sugerencia' }] },
    ]);

    const res = await rpc('jsonb_remove_item', { p_list_id: listId, p_pasillo_nombre: 'Especias', p_item_nombre: 'Jengibre' });

    expect([401, 403]).toContain(res.status);
    expect((await readItems(owner, listId))[0].items.map(i => i.nombre)).toEqual(['Jengibre']);
  });
});
