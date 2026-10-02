/**
 * FRESCO-777 (audit-6 A6-S4 + A6-S5) — the INSERT paths into the meal-plan
 * tables, proven against the real database.
 *
 * Audit-5 protected UPDATE on `meal_plan_recipes` and left INSERT open "as a
 * follow-up". A signed-in caller could still insert slots with
 * `estado = 'cocinada'`, any `recipe_id` (allergen carriers included) or a
 * forged `sustitucion_ingrediente` (which `generate-shopping-list` consumes
 * verbatim), and create whole plans without going through `generate-meal-plan`
 * (rate limit, entitlement, allergen filter). `shopping_lists` also never
 * checked that `meal_plan_id` belongs to the caller.
 *
 * Pinned here:
 *   1. `authenticated` cannot INSERT into `meal_plans` / `meal_plan_recipes`.
 *      The only writer is the `generate-meal-plan` Edge Function (service role,
 *      after its own checks).
 *   2. `shopping_lists` only accepts a `meal_plan_id` the caller owns, on INSERT
 *      and on UPDATE, while the legitimate own-plan INSERT keeps working.
 *
 * Runs only when `RUN_DB_INTEGRATION=1` AND the local Supabase stack answers —
 * `bun run test:db`. See `tests/db/README.md`.
 */

import type { DbTestUser } from './harness';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { catalogRecipeIds, createDbTestContext, rest, seedMealPlan, seedShoppingList, seedSlots, stackReachable } from './harness';

const RUN = process.env.RUN_DB_INTEGRATION === '1';
const reachable = RUN ? await stackReachable() : false;

const PERMISSION_DENIED = '42501';

function isDenied(res: { status: number, body: unknown }): boolean {
  return res.status === 403 && (res.body as { code?: string }).code === PERMISSION_DENIED;
}

describe.skipIf(!(RUN && reachable))('meal-plan INSERT paths (real DB)', () => {
  const ctx = createDbTestContext();
  let attacker: DbTestUser;
  let victim: DbTestUser;
  let attackerPlanId: string;
  let victimPlanId: string;
  let recipeId: string;

  beforeAll(async () => {
    [attacker, victim] = await Promise.all([ctx.createUser(), ctx.createUser()]);
    [recipeId] = await catalogRecipeIds(attacker, 1);
    attackerPlanId = (await seedMealPlan(attacker, { semanaIso: '2099-W30', fechaInicio: '2099-07-27' })).id;
    victimPlanId = (await seedMealPlan(victim, { semanaIso: '2099-W31', fechaInicio: '2099-08-03' })).id;
    await seedSlots(victim, victimPlanId, [{ recipeId, tipoPlato: 'comida' }]);
  });

  afterAll(async () => ctx.cleanupAll());

  test('a signed-in user cannot INSERT a meal plan directly', async () => {
    const res = await rest('meal_plans', {
      method: 'POST',
      token: attacker.token,
      prefer: 'return=minimal',
      body: { user_id: attacker.id, semana_iso: '2099-W40', fecha_inicio: '2099-10-05', advertencias: [] },
    });
    expect(isDenied(res)).toBe(true);
  });

  test('a signed-in user cannot INSERT slots into their own plan, even pendiente ones', async () => {
    const res = await rest('meal_plan_recipes', {
      method: 'POST',
      token: attacker.token,
      prefer: 'return=minimal',
      body: { meal_plan_id: attackerPlanId, recipe_id: recipeId, dia: 'lunes', tipo_plato: 'comida', estado: 'pendiente' },
    });
    expect(isDenied(res)).toBe(true);
  });

  test('a forged slot (estado cocinada, rating, forged substitution) is rejected', async () => {
    const res = await rest('meal_plan_recipes', {
      method: 'POST',
      token: attacker.token,
      prefer: 'return=minimal',
      body: {
        meal_plan_id: attackerPlanId,
        recipe_id: recipeId,
        dia: 'martes',
        tipo_plato: 'cena',
        estado: 'cocinada',
        rating: 5,
        sustitucion_ingrediente: { original: 'x', sustituto: 'y' },
      },
    });
    expect(isDenied(res)).toBe(true);
  });

  test('shopping_lists rejects a meal_plan_id the caller does not own (INSERT)', async () => {
    const res = await rest('shopping_lists', {
      method: 'POST',
      token: attacker.token,
      prefer: 'return=minimal',
      body: { meal_plan_id: victimPlanId, user_id: attacker.id, items: [] },
    });
    expect(isDenied(res)).toBe(true);

    // The victim can still generate their own list: the unique slot was not squatted.
    await expect(seedShoppingList(victim, victimPlanId)).resolves.toBeString();
  });

  test('shopping_lists rejects re-pointing an own list at a plan the caller does not own (UPDATE)', async () => {
    const own = await rest('shopping_lists', {
      method: 'POST',
      token: attacker.token,
      prefer: 'return=representation',
      body: { meal_plan_id: attackerPlanId, user_id: attacker.id, items: [] },
    });
    expect(own.status).toBe(201);
    const listId = (own.body as { id: string }[])[0].id;

    const res = await rest('shopping_lists', {
      method: 'PATCH',
      token: attacker.token,
      query: `id=eq.${listId}`,
      prefer: 'return=minimal',
      body: { meal_plan_id: victimPlanId },
    });
    expect(isDenied(res)).toBe(true);

    const after = await rest('shopping_lists', { token: attacker.token, query: `id=eq.${listId}&select=meal_plan_id` });
    expect((after.body as { meal_plan_id: string }[])[0].meal_plan_id).toBe(attackerPlanId);
  });
});
