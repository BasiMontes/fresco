/**
 * FRESCO-776 (audit-6 A6-S1 + A6-T1) — `meal_plan_recipes` integrity, proven
 * against the real database.
 *
 * Audit-5 closed its BLOCKER (a table-wide `GRANT UPDATE` plus row-only RLS let
 * any signed-in caller write `estado` / `rating` / `recipe_id` /
 * `sustitucion_ingrediente` straight through PostgREST) with a trigger and a
 * "trusted write" GUC — and shipped no test of the attack. Worse, the RPC that
 * fix introduced (`apply_recipe_status_update`) set that GUC itself and was
 * callable by any signed-in user, so it reopened the hole.
 *
 * Two things are pinned here:
 *   1. The owner of a slot cannot change the four protected columns through a
 *      direct PATCH (the trigger answers `P0001`).
 *   2. There is no client-callable function that lifts that protection:
 *      `apply_recipe_status_update` is gone, and calling it changes nothing.
 *
 * Runs only when `RUN_DB_INTEGRATION=1` AND the local Supabase stack answers —
 * `bun run test:db`. See `tests/db/README.md`.
 */

import type { DbTestUser } from './harness';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { catalogRecipeIds, createDbTestContext, rest, rpc, seedMealPlan, seedSlots, stackReachable } from './harness';

const RUN = process.env.RUN_DB_INTEGRATION === '1';
const reachable = RUN ? await stackReachable() : false;

interface SlotRow { estado: string, rating: number | null, recipe_id: string, sustitucion_ingrediente: unknown }

async function readSlot(user: DbTestUser, slotId: string): Promise<SlotRow> {
  const res = await rest('meal_plan_recipes', {
    token: user.token,
    query: `id=eq.${slotId}&select=estado,rating,recipe_id,sustitucion_ingrediente`,
  });
  return (res.body as SlotRow[])[0];
}

describe.skipIf(!(RUN && reachable))('meal_plan_recipes integrity (real DB)', () => {
  const ctx = createDbTestContext();
  let owner: DbTestUser;
  let slotId: string;
  let recipeId: string;
  let otherRecipeId: string;

  beforeAll(async () => {
    owner = await ctx.createUser();
    [recipeId, otherRecipeId] = await catalogRecipeIds(owner, 2);
    const plan = await seedMealPlan(owner, { semanaIso: '2099-W20', fechaInicio: '2099-05-18' });
    [slotId] = await seedSlots(owner, plan.id, [{ recipeId, tipoPlato: 'comida' }]);
  });

  afterAll(async () => ctx.cleanupAll());

  const directWrites: [string, () => Record<string, unknown>][] = [
    ['estado', () => ({ estado: 'cocinada' })],
    ['rating', () => ({ rating: 5 })],
    ['recipe_id', () => ({ recipe_id: otherRecipeId })],
    ['sustitucion_ingrediente', () => ({ sustitucion_ingrediente: { original: 'x', sustituto: 'y' } })],
  ];

  test.each(directWrites)('the owner cannot PATCH %s directly (P0001)', async (_column, makeBody) => {
    const before = await readSlot(owner, slotId);

    const res = await rest('meal_plan_recipes', {
      method: 'PATCH',
      token: owner.token,
      query: `id=eq.${slotId}`,
      prefer: 'return=minimal',
      body: makeBody(),
    });

    expect(res.status).toBe(400);
    expect((res.body as { code?: string }).code).toBe('P0001');
    expect(await readSlot(owner, slotId)).toEqual(before);
  });

  test('no client-callable RPC can change a protected column (apply_recipe_status_update)', async () => {
    const before = await readSlot(owner, slotId);

    const res = await rpc('apply_recipe_status_update', {
      p_slot_id: slotId,
      p_estado: 'cocinada',
      p_rating: 1,
      p_recipe_id: otherRecipeId,
    }, { token: owner.token });

    // The function must not exist for a client: PostgREST answers 404, never 2xx.
    expect(res.status).toBe(404);
    expect(await readSlot(owner, slotId)).toEqual(before);
  });
});
