/**
 * FRESCO-464 — spoof tests for every `SECURITY DEFINER` function in `public`
 * that takes a caller-supplied identity / scope parameter.
 *
 * Doctrine: `.agents/skills/sprint-development/references/rpc-authorization.md`.
 * A `SECURITY DEFINER` function bypasses RLS, so a `WHERE` clause is a
 * selection filter*, not an authorization check. Each test drives the REAL
 * PostgREST endpoint with user B's own JWT, passes user A's id / row id as the
 * parameter, and asserts the spoof is denied — either a raised exception or a
 * provably empty / zero-row effect. For the read functions it also asserts the
 * legitimate call is scoped to B (membership asserts do not scope a result set).
 *
 * Runs only when `RUN_DB_INTEGRATION=1` AND the local Supabase stack answers —
 * `bun run test:db`. A bare `bun test` / `bun run test:coverage` skips the whole
 * file (see `tests/db/README.md`).
 */

import type { DbTestUser } from './harness';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import {
  catalogRecipeIds,
  createDbTestContext,

  rest,
  rpc,
  seedMealPlan,
  seedShoppingList,
  seedSlots,
  stackReachable,
} from './harness';

const RUN = process.env.RUN_DB_INTEGRATION === '1';
const reachable = RUN ? await stackReachable() : false;

function expectRaise(result: { status: number, body: unknown }, messageIncludes: string): void {
  expect(result.status).toBe(400);
  const body = result.body as { code?: string, message?: string };
  expect(body.code).toBe('P0001');
  expect(body.message ?? '').toContain(messageIncludes);
}

function expectPermissionDenied(result: { status: number, body: unknown }): void {
  expect(result.status).toBe(403);
  expect((result.body as { code?: string }).code).toBe('42501');
}

describe.skipIf(!(RUN && reachable))('SECURITY DEFINER spoof tests (real DB)', () => {
  const ctx = createDbTestContext();
  let A: DbTestUser;
  let B: DbTestUser;
  let recipes: string[];

  beforeAll(async () => {
    [A, B] = await Promise.all([ctx.createUser(), ctx.createUser()]);
    recipes = await catalogRecipeIds(A, 6);
  });

  afterAll(async () => ctx.cleanupAll());

  // --- identity-parameter functions that RAISE on a spoofed actor ----------

  test('check_and_increment_rate_limit — B cannot spend A\'s quota', async () => {
    const spoof = await rpc('check_and_increment_rate_limit', {
      p_user_id: A.id,
      p_endpoint: 'spoof-probe',
      p_limit: 5,
      p_window_seconds: 3600,
    }, { token: B.token });
    expectRaise(spoof, 'caller does not own user_id');

    const legit = await rpc('check_and_increment_rate_limit', {
      p_user_id: B.id,
      p_endpoint: 'legit-probe',
      p_limit: 5,
      p_window_seconds: 3600,
    }, { token: B.token });
    expect(legit.status).toBe(200);
    expect(legit.body).toBe(true);
  });

  test('copy_meal_plan_to_week — B cannot copy A\'s plan', async () => {
    const plan = await seedMealPlan(A, { semanaIso: '2099-W01', fechaInicio: '2099-01-05' });

    const spoof = await rpc('copy_meal_plan_to_week', {
      p_source_meal_plan_id: plan.id,
      p_semana_iso: '2099-W02',
      p_fecha_inicio: '2099-01-12',
    }, { token: B.token });
    expectRaise(spoof, 'caller does not own source plan');

    // No plan was created for B by the spoofed call.
    const bPlans = await rest('meal_plans', { token: B.token, query: 'select=id' });
    expect(bPlans.body).toEqual([]);

    const legit = await rpc('copy_meal_plan_to_week', {
      p_source_meal_plan_id: plan.id,
      p_semana_iso: '2099-W03',
      p_fecha_inicio: '2099-01-19',
    }, { token: A.token });
    expect(legit.status).toBe(200);
    expect(typeof legit.body).toBe('string');
  });

  test('get_catalog — B cannot read A\'s personalised catalog', async () => {
    const spoof = await rpc('get_catalog', { p_user_id: A.id }, { token: B.token });
    expectRaise(spoof, 'caller does not own profile');

    const legit = await rpc('get_catalog', { p_user_id: B.id }, { token: B.token });
    expect(legit.status).toBe(200);
    expect(Array.isArray((legit.body as { recipes?: unknown[] }).recipes)).toBe(true);
  });

  test('get_filtered_recipes — B cannot read A\'s food-safety-filtered set', async () => {
    const spoof = await rpc('get_filtered_recipes', { p_user_id: A.id, p_recipe_id: null }, { token: B.token });
    expectRaise(spoof, 'caller does not own profile');

    const legit = await rpc('get_filtered_recipes', { p_user_id: B.id, p_recipe_id: null }, { token: B.token });
    expect(legit.status).toBe(200);
    expect(Array.isArray(legit.body)).toBe(true);
    expect((legit.body as unknown[]).length).toBeGreaterThan(0);
  });

  // --- identity-parameter read functions that return EMPTY on a spoof ------
  // (guard is `mp.user_id = p_user_id AND mp.user_id = auth.uid()` — a spoofed
  //  p_user_id can never satisfy both, so the row set is empty. The legit call
  //  must still return B's own rows — that is the result-scoping assertion.)

  // A and B are seeded with DISJOINT recipe sets so "scoped to B" is a real
  // assertion: A's marks must never appear in B's result.
  const A_RECIPES = () => recipes.slice(0, 3);
  const B_RECIPES = () => recipes.slice(3, 6);

  async function seedCookedHistory(user: DbTestUser, used: string[], week: string, start: string): Promise<void> {
    const plan = await seedMealPlan(user, { semanaIso: week, fechaInicio: start });
    await seedSlots(user, plan.id, [
      { recipeId: used[0], tipoPlato: 'desayuno', estado: 'cocinada' },
      { recipeId: used[1], tipoPlato: 'comida', estado: 'cocinada' },
      { recipeId: used[2], tipoPlato: 'cena', estado: 'descartada' },
    ]);
  }

  test('get_recent_recipe_marks — spoof returns nothing; legit is scoped to B', async () => {
    await seedCookedHistory(A, A_RECIPES(), '2099-W10', '2099-03-09');
    await seedCookedHistory(B, B_RECIPES(), '2099-W11', '2099-03-16');

    const spoof = await rpc('get_recent_recipe_marks', { p_user_id: A.id, p_weeks: 520 }, { token: B.token });
    expect(spoof.status).toBe(200);
    expect(spoof.body).toEqual([]);

    const legit = await rpc('get_recent_recipe_marks', { p_user_id: B.id, p_weeks: 520 }, { token: B.token });
    expect(legit.status).toBe(200);
    const marks = legit.body as { recipe_id: string }[];
    expect(marks.length).toBeGreaterThan(0);
    for (const m of marks) {
      expect(B_RECIPES()).toContain(m.recipe_id);
      expect(A_RECIPES()).not.toContain(m.recipe_id);
    }
  });

  test('get_user_cooked_recipe_ids — spoof returns nothing; legit is scoped to B', async () => {
    const spoof = await rpc('get_user_cooked_recipe_ids', { p_user_id: A.id }, { token: B.token });
    expect(spoof.status).toBe(200);
    expect(spoof.body === null || (Array.isArray(spoof.body) && spoof.body.length === 0)).toBe(true);

    const legit = await rpc('get_user_cooked_recipe_ids', { p_user_id: B.id }, { token: B.token });
    expect(legit.status).toBe(200);
    const ids = legit.body as string[];
    expect(ids.length).toBeGreaterThan(0);
    // Only B's 'cocinada' recipes — never A's, never B's 'descartada' one.
    expect([...ids].sort()).toEqual([B_RECIPES()[0], B_RECIPES()[1]].sort());
  });

  test('get_user_recipe_engagement — spoof returns nothing; legit is scoped to B', async () => {
    const spoof = await rpc('get_user_recipe_engagement', { p_user_id: A.id }, { token: B.token });
    expect(spoof.status).toBe(200);
    expect(spoof.body).toEqual([]);

    const legit = await rpc('get_user_recipe_engagement', { p_user_id: B.id }, { token: B.token });
    expect(legit.status).toBe(200);
    const rows = legit.body as { recipe_id: string }[];
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(B_RECIPES()).toContain(r.recipe_id);
      expect(A_RECIPES()).not.toContain(r.recipe_id);
    }
  });

  // --- shopping-list scope-parameter functions ----------------------------

  test('jsonb_add_item — B cannot mutate A\'s list', async () => {
    const plan = await seedMealPlan(A, { semanaIso: '2099-W20', fechaInicio: '2099-05-18' });
    const listId = await seedShoppingList(A, plan.id);

    const spoof = await rpc('jsonb_add_item', {
      p_list_id: listId,
      p_pasillo_nombre: 'Inyectado',
      p_item: { nombre: 'hack', comprado: false },
    }, { token: B.token });
    expectRaise(spoof, 'not found or not owned by caller');

    const after = await rest('shopping_lists', { token: A.token, query: `id=eq.${listId}&select=items` });
    const items = (after.body as { items: { nombre: string }[] }[])[0].items;
    expect(items.map(p => p.nombre)).toEqual(['Verduras']);

    const legit = await rpc('jsonb_add_item', {
      p_list_id: listId,
      p_pasillo_nombre: 'Frutas',
      p_item: { nombre: 'Manzana', comprado: false },
    }, { token: A.token });
    expect(legit.status).toBe(204);
  });

  test('jsonb_clear_comprados — B cannot mutate A\'s list', async () => {
    const plan = await seedMealPlan(A, { semanaIso: '2099-W21', fechaInicio: '2099-05-25' });
    const listId = await seedShoppingList(A, plan.id, [
      { nombre: 'Verduras', orden: 1, items: [{ nombre: 'Tomate', comprado: true }, { nombre: 'Cebolla', comprado: false }] },
    ]);

    const spoof = await rpc('jsonb_clear_comprados', { p_list_id: listId }, { token: B.token });
    expectRaise(spoof, 'not found or not owned by caller');

    const after = await rest('shopping_lists', { token: A.token, query: `id=eq.${listId}&select=items` });
    const items = (after.body as { items: { items: unknown[] }[] }[])[0].items[0].items;
    expect(items.length).toBe(2);
  });

  test('jsonb_set_comprado — B\'s spoof touches zero rows of A\'s list', async () => {
    const plan = await seedMealPlan(A, { semanaIso: '2099-W22', fechaInicio: '2099-06-01' });
    const listId = await seedShoppingList(A, plan.id, [
      { nombre: 'Verduras', orden: 1, items: [{ nombre: 'Tomate', comprado: false }] },
    ]);

    // This RPC has no explicit raise — the guard is `WHERE ... user_id =
    // auth.uid()`. A spoof returns 204 but must update no row.
    const spoof = await rpc('jsonb_set_comprado', {
      p_list_id: listId,
      p_pasillo_idx: 0,
      p_item_idx: 0,
      p_comprado: true,
    }, { token: B.token });
    expect(spoof.status).toBe(204);

    const after = await rest('shopping_lists', { token: A.token, query: `id=eq.${listId}&select=items` });
    const comprado = (after.body as { items: { items: { comprado: boolean }[] }[] }[])[0].items[0].items[0].comprado;
    expect(comprado).toBe(false);

    const legit = await rpc('jsonb_set_comprado', {
      p_list_id: listId,
      p_pasillo_idx: 0,
      p_item_idx: 0,
      p_comprado: true,
    }, { token: A.token });
    expect(legit.status).toBe(204);
  });

  test('swap_meal_plan_slots — B cannot swap slots in A\'s plan', async () => {
    const plan = await seedMealPlan(A, { semanaIso: '2099-W30', fechaInicio: '2099-07-27' });
    const [slotA, slotB] = await seedSlots(A, plan.id, [
      { recipeId: recipes[0], tipoPlato: 'comida' },
      { recipeId: recipes[1], tipoPlato: 'comida' },
    ]);

    const spoof = await rpc('swap_meal_plan_slots', {
      p_slot_a_id: slotA,
      p_slot_b_id: slotB,
    }, { token: B.token });
    expectRaise(spoof, 'caller does not own meal plan');

    const after = await rest('meal_plan_recipes', {
      token: A.token,
      query: `id=in.(${slotA},${slotB})&select=id,recipe_id&order=id`,
    });
    const byId = Object.fromEntries((after.body as { id: string, recipe_id: string }[]).map(r => [r.id, r.recipe_id]));
    expect(byId[slotA]).toBe(recipes[0]);
    expect(byId[slotB]).toBe(recipes[1]);

    const legit = await rpc('swap_meal_plan_slots', {
      p_slot_a_id: slotA,
      p_slot_b_id: slotB,
    }, { token: A.token });
    expect(legit.status).toBe(204);
  });

  // --- service_role-only functions: `authenticated` has no EXECUTE grant --

  test('reassign_guest_data — B (authenticated) is refused outright', async () => {
    const result = await rpc('reassign_guest_data', {
      p_from_user_id: A.id,
      p_to_user_id: B.id,
    }, { token: B.token });
    expectPermissionDenied(result);
  });

  test('get_push_subscriptions_without_current_plan — B (authenticated) is refused outright', async () => {
    const result = await rpc('get_push_subscriptions_without_current_plan', {
      p_semana_iso: '2099-W01',
    }, { token: B.token });
    expectPermissionDenied(result);
  });
});
