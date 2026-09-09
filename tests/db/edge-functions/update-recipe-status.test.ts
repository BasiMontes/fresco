/**
 * FRESCO-464 PR2 — HTTP negative-contract tests for update-recipe-status.
 *
 * Real HTTP against the local Supabase Edge Functions runtime (`supabase
 * start`), not mocked, not e2e. Covers the auth gate, the 60/h rate limit,
 * body validation (including the client-settable `estado` whitelist), the
 * terminal-state guard, cross-user access, and the A4-H1 substitution safety
 * checks (allergen re-filter + same-week duplicate).
 *
 * DIVERGENCE from an earlier draft of this ticket's AC: a slot belonging to
 * a different user returns 404 ("Slot no encontrado"), not 403. index.ts's
 * step 3 loads the slot through the CALLER's own RLS-scoped client
 * (`mpr_select_own` policy — ownership via join back to meal_plans.user_id),
 * so a non-owner's query already returns zero rows before the function's own
 * explicit 403 ownership check at step 4 is ever reached. Verified live
 * against the local stack before writing this assertion.
 *
 * Runs only when `RUN_DB_INTEGRATION=1` AND the local stack answers —
 * `bun run test:db`. See tests/db/README.md.
 */

import type { DbTestUser } from '../harness';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { callFunction, catalogRecipeIds, createDbTestContext, rest, rpc, seedMealPlan, seedSlots, stackReachable } from '../harness';

const RUN = process.env.RUN_DB_INTEGRATION === '1';
const reachable = RUN ? await stackReachable() : false;

const ENDPOINT = 'update-recipe-status';

/** A recipe id declaring the `gluten` allergen — pinned to the canonical vocabulary (see `recipes_alergenos_vocab`). */
async function findRecipeWithAllergen(user: DbTestUser, allergen: string): Promise<string> {
  const qs = new URLSearchParams({ select: 'id', alergenos: `cs.["${allergen}"]`, limit: '1' }).toString();
  const res = await rest('recipes', { token: user.token, query: qs });
  const rows = res.body as { id: string }[];
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error(`[update-recipe-status.test] no catalog recipe declares allergen "${allergen}"`);
  }
  return rows[0].id;
}

describe.skipIf(!(RUN && reachable))('update-recipe-status — HTTP negative contract (real functions runtime)', () => {
  const ctx = createDbTestContext();
  let A: DbTestUser;
  let B: DbTestUser;

  beforeAll(async () => {
    [A, B] = await Promise.all([ctx.createUser(), ctx.createUser()]);
  });

  afterAll(async () => ctx.cleanupAll());

  test('401 when called with no token', async () => {
    const res = await callFunction(ENDPOINT, {});
    expect(res.status).toBe(401);
  });

  test('401 when called with a garbage token', async () => {
    const res = await callFunction(ENDPOINT, { token: 'not-a-real-jwt' });
    expect(res.status).toBe(401);
  });

  test('429 once the 60/h rate limit is pre-saturated', async () => {
    const user = await ctx.createUser();
    await Promise.all(
      Array.from({ length: 60 }, async () => rpc('check_and_increment_rate_limit', {
        p_user_id: user.id,
        p_endpoint: ENDPOINT,
        p_limit: 60,
        p_window_seconds: 3600,
      }, { token: user.token })),
    );

    const res = await callFunction(ENDPOINT, { token: user.token, body: {} });
    expect(res.status).toBe(429);
  });

  test('400 when the body is missing meal_plan_recipe_id / estado', async () => {
    const res = await callFunction(ENDPOINT, { token: A.token, body: {} });
    expect(res.status).toBe(400);
  });

  test('400 when estado is outside the client-settable whitelist', async () => {
    const [recipeId] = await catalogRecipeIds(A, 1);
    const plan = await seedMealPlan(A, { semanaIso: '2099-W50', fechaInicio: '2099-12-14' });
    const [slotId] = await seedSlots(A, plan.id, [{ recipeId, tipoPlato: 'desayuno' }]);

    // 'pendiente' is a real estado_receta_menu value, but system-assigned —
    // not one this endpoint accepts from a client. Real behavior is 400, not
    // the 422 an earlier ticket draft assumed.
    const res = await callFunction(ENDPOINT, { token: A.token, body: { meal_plan_recipe_id: slotId, estado: 'pendiente' } });
    expect(res.status).toBe(400);
  });

  test('404 when the slot belongs to a different user', async () => {
    const [recipeId] = await catalogRecipeIds(A, 1);
    const plan = await seedMealPlan(A, { semanaIso: '2099-W51', fechaInicio: '2099-12-21' });
    const [slotId] = await seedSlots(A, plan.id, [{ recipeId, tipoPlato: 'desayuno' }]);

    const res = await callFunction(ENDPOINT, { token: B.token, body: { meal_plan_recipe_id: slotId, estado: 'cocinada' } });
    expect(res.status).toBe(404);

    // No side effect: re-read as the real owner, still pendiente.
    const after = await rest('meal_plan_recipes', { token: A.token, query: `id=eq.${slotId}&select=estado` });
    expect((after.body as { estado: string }[])[0]?.estado).toBe('pendiente');
  });

  test('409 re-patching an already-terminal slot', async () => {
    const [recipeId] = await catalogRecipeIds(A, 1);
    const plan = await seedMealPlan(A, { semanaIso: '2099-W52', fechaInicio: '2099-12-28' });
    const [slotId] = await seedSlots(A, plan.id, [{ recipeId, tipoPlato: 'comida', estado: 'cocinada' }]);

    const res = await callFunction(ENDPOINT, { token: A.token, body: { meal_plan_recipe_id: slotId, estado: 'descartada' } });
    expect(res.status).toBe(409);
  });

  test('422 substitution with a recipe carrying a declared allergen', async () => {
    const user = await ctx.createUser();
    await rest('user_profiles', {
      method: 'PATCH',
      token: user.token,
      query: `id=eq.${user.id}`,
      prefer: 'return=minimal',
      body: { alergenos: ['gluten'] },
    });

    const safeRes = await rpc('get_filtered_recipes', { p_user_id: user.id }, { token: user.token });
    const safeRecipeId = (safeRes.body as { id: string }[])[0].id;
    const glutenRecipeId = await findRecipeWithAllergen(user, 'gluten');

    const plan = await seedMealPlan(user, { semanaIso: '2099-W03', fechaInicio: '2099-01-19' });
    const [slotId] = await seedSlots(user, plan.id, [{ recipeId: safeRecipeId, tipoPlato: 'comida' }]);

    const res = await callFunction(ENDPOINT, {
      token: user.token,
      body: { meal_plan_recipe_id: slotId, estado: 'sustituida', nueva_recipe_id: glutenRecipeId },
    });
    expect(res.status).toBe(422);
  });

  test('409 substitution with a recipe already placed elsewhere in the same week', async () => {
    const user = await ctx.createUser();
    const [recipeOne, recipeTwo] = await catalogRecipeIds(user, 2);
    const plan = await seedMealPlan(user, { semanaIso: '2099-W04', fechaInicio: '2099-01-26' });
    const [slotOne] = await seedSlots(user, plan.id, [{ recipeId: recipeOne, tipoPlato: 'comida' }]);
    await seedSlots(user, plan.id, [{ recipeId: recipeTwo, tipoPlato: 'cena' }]);

    const res = await callFunction(ENDPOINT, {
      token: user.token,
      body: { meal_plan_recipe_id: slotOne, estado: 'sustituida', nueva_recipe_id: recipeTwo },
    });
    expect(res.status).toBe(409);
  });
});
