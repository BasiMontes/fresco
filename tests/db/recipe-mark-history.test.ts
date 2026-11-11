/**
 * FRESCO-1184 (revisión integral, hallazgo C1) — the "cocinada" and "descartada" marks of a week outlive it.
 *
 * The marks lived only in `meal_plan_recipes`, so deleting a week, or copying a menu over a week that already has
 * one, erased them in cascade: the dishes the person had just marked could come back the next week. Owner decision
 * (2026-11-11): a table of their own. A plan about to be deleted archives its decisive marks into
 * `recipe_mark_history`, and the three readers (`get_recent_recipe_marks`, `get_user_cooked_recipe_ids`,
 * `get_user_recipe_engagement`) read the live marks and the archived ones.
 *
 * Proven against the real database with real sessions:
 *   1. after the user deletes a week, the next menu still respects its marks (recent marks, cooked ids, engagement);
 *   2. the same when a copy overwrites the week;
 *   3. only the two decisive marks are archived, never `pendiente`;
 *   4. the 2-week window counts from the week the mark was made in, while the all-time readers keep it;
 *   5. one user never reads another's marks, and no client role reaches the table or the trigger function;
 *   6. deleting an account with marks still works and leaves nothing behind.
 *
 * Runs only when `RUN_DB_INTEGRATION=1` AND the local Supabase stack answers: `bun run test:db`. See tests/db/README.md.
 */

import type { DbTestUser } from './harness';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { createDbTestContext, nativeFetch, plannedWeek, resolveUrl, rest, rpc, seedMealPlan, seedSlots, serviceRoleKey, stackReachable } from './harness';

const RUN = process.env.RUN_DB_INTEGRATION === '1';
const reachable = RUN ? await stackReachable() : false;

interface Mark { recipe_id: string, estado: string }
interface Engagement { recipe_id: string, veces_cocinada_usuario: number, veces_descartada_usuario: number }

async function recipeIds(user: DbTestUser, count: number): Promise<string[]> {
  const res = await rest('recipes', { token: user.token, query: `select=id&activo=eq.true&order=id.asc&limit=${count}` });
  const rows = res.body as { id: string }[];
  if (rows.length < count) { throw new Error(`[test] only ${rows.length} catalogue recipes`); }
  return rows.map(row => row.id);
}

async function deletePlan(user: DbTestUser, planId: string): Promise<void> {
  const res = await rest('meal_plans', { method: 'DELETE', token: user.token, query: `id=eq.${planId}`, prefer: 'return=minimal' });
  expect(res.status).toBe(204);
}

async function recentMarks(user: DbTestUser): Promise<Mark[]> {
  const res = await rpc('get_recent_recipe_marks', { p_user_id: user.id, p_weeks: 2 }, { token: user.token });
  expect(res.status).toBe(200);
  return res.body as Mark[];
}

async function cookedIds(user: DbTestUser): Promise<string[]> {
  const res = await rpc('get_user_cooked_recipe_ids', { p_user_id: user.id }, { token: user.token });
  expect(res.status).toBe(200);
  return (res.body as string[] | null) ?? [];
}

async function engagement(user: DbTestUser): Promise<Engagement[]> {
  const res = await rpc('get_user_recipe_engagement', { p_user_id: user.id }, { token: user.token });
  expect(res.status).toBe(200);
  return res.body as Engagement[];
}

async function historyOf(userId: string): Promise<{ recipe_id: string, estado: string, fecha_inicio: string }[]> {
  const res = await rest('recipe_mark_history', { serviceRole: true, query: `user_id=eq.${userId}&select=recipe_id,estado,fecha_inicio&order=estado.asc` });
  expect(res.status).toBe(200);
  return res.body as { recipe_id: string, estado: string, fecha_inicio: string }[];
}

describe.skipIf(!(RUN && reachable))('recipe marks outlive their week (real DB)', () => {
  const ctx = createDbTestContext();
  let a: DbTestUser;
  let b: DbTestUser;
  let cooked: string;
  let discarded: string;
  let pending: string;

  beforeAll(async () => {
    [a, b] = await Promise.all([ctx.createUser(), ctx.createUser()]);
    [cooked, discarded, pending] = await recipeIds(a, 3);
  });

  afterAll(async () => ctx.cleanupAll());

  /** A plan in the current week with one cooked, one discarded and one still pending slot. */
  async function markedWeek(user: DbTestUser, week = plannedWeek(0)): Promise<string> {
    const plan = await seedMealPlan(user, week);
    await seedSlots(user, plan.id, [
      { recipeId: cooked, tipoPlato: 'desayuno', estado: 'cocinada' },
      { recipeId: discarded, tipoPlato: 'comida', estado: 'descartada' },
      { recipeId: pending, tipoPlato: 'cena', estado: 'pendiente' },
    ]);
    return plan.id;
  }

  test('before the week is deleted the marks are read from the live slots, as ever', async () => {
    const planId = await markedWeek(a);

    const marks = await recentMarks(a);

    expect(marks).toContainEqual({ recipe_id: cooked, estado: 'cocinada' });
    expect(marks).toContainEqual({ recipe_id: discarded, estado: 'descartada' });
    await deletePlan(a, planId);
  });

  test('after the user deletes the week, the next menu still respects its marks', async () => {
    const planId = await markedWeek(a);
    await deletePlan(a, planId);

    const marks = await recentMarks(a);
    expect(marks).toContainEqual({ recipe_id: cooked, estado: 'cocinada' });
    expect(marks).toContainEqual({ recipe_id: discarded, estado: 'descartada' });
    expect(await cookedIds(a)).toContain(cooked);
    const counts = await engagement(a);
    expect(counts.find(row => row.recipe_id === cooked)?.veces_cocinada_usuario).toBeGreaterThanOrEqual(1);
    expect(counts.find(row => row.recipe_id === discarded)?.veces_descartada_usuario).toBeGreaterThanOrEqual(1);
  });

  test('only the two decisive marks are archived, never a pending slot', async () => {
    const user = await ctx.createUser();
    const planId = await markedWeek(user);
    await deletePlan(user, planId);

    const archived = await historyOf(user.id);

    expect(archived).toHaveLength(2);
    expect(archived.map(row => row.recipe_id)).not.toContain(pending);
    expect(new Set(archived.map(row => row.estado))).toEqual(new Set(['cocinada', 'descartada']));
  });

  test('a mark made in a week that is no longer recent counts for the all-time readers but not for the 2-week window', async () => {
    const user = await ctx.createUser();
    const [old] = await recipeIds(user, 1);
    const plan = await seedMealPlan(user, { semanaIso: '2024-W10', fechaInicio: '2024-03-04' });
    await seedSlots(user, plan.id, [{ recipeId: old, tipoPlato: 'comida', estado: 'cocinada' }]);
    await deletePlan(user, plan.id);

    expect(await recentMarks(user)).toEqual([]);
    expect(await cookedIds(user)).toEqual([old]);
    expect((await engagement(user)).find(row => row.recipe_id === old)?.veces_cocinada_usuario).toBe(1);
  });

  test('a copy over a week that already has a menu archives the marks of the plan it replaces', async () => {
    const user = await ctx.createUser();
    const [markedRecipe, sourceRecipe] = await recipeIds(user, 2);
    const target = plannedWeek(0);
    const targetPlan = await seedMealPlan(user, target);
    await seedSlots(user, targetPlan.id, [{ recipeId: markedRecipe, tipoPlato: 'comida', estado: 'descartada' }]);
    const source = plannedWeek(1);
    const sourcePlan = await seedMealPlan(user, source);
    await seedSlots(user, sourcePlan.id, [{ recipeId: sourceRecipe, tipoPlato: 'comida' }]);

    const copied = await rpc('copy_meal_plan_to_week', {
      p_source_meal_plan_id: sourcePlan.id,
      p_semana_iso: target.semanaIso,
      p_fecha_inicio: target.fechaInicio,
    }, { token: user.token });
    expect(copied.status).toBe(200);

    expect(await recentMarks(user)).toContainEqual({ recipe_id: markedRecipe, estado: 'descartada' });
    expect((await historyOf(user.id)).map(row => row.recipe_id)).toEqual([markedRecipe]);
  });

  test('one user never reads another user\'s marks', async () => {
    const planId = await markedWeek(a);
    await deletePlan(a, planId);

    const spoof = await rpc('get_recent_recipe_marks', { p_user_id: a.id, p_weeks: 2 }, { token: b.token });
    expect(spoof.body).toEqual([]);
    const spoofCooked = await rpc('get_user_cooked_recipe_ids', { p_user_id: a.id }, { token: b.token });
    expect(spoofCooked.body).toBeNull();
    const spoofEngagement = await rpc('get_user_recipe_engagement', { p_user_id: a.id }, { token: b.token });
    expect(spoofEngagement.body).toEqual([]);
  });

  test('no client role reaches the history table or the trigger function', async () => {
    const read = await rest('recipe_mark_history', { token: a.token, query: 'select=id' });
    expect(read.status).toBe(403);

    const write = await rest('recipe_mark_history', {
      method: 'POST',
      token: a.token,
      prefer: 'return=minimal',
      body: { user_id: a.id, recipe_id: cooked, estado: 'cocinada', fecha_inicio: '2024-03-04' },
    });
    expect(write.status).toBe(403);

    const call = await rpc('archive_recipe_marks_before_plan_delete', {}, { token: a.token });
    expect([401, 403, 404]).toContain(call.status);
    const callService = await rpc('archive_recipe_marks_before_plan_delete', {}, { serviceRole: true });
    expect([401, 403, 404]).toContain(callService.status);
  });

  test('deleting an account that has marks works and leaves no history behind', async () => {
    const user = await ctx.createUser();
    const [markedRecipe] = await recipeIds(user, 1);
    // A plan with a mark that is deleted (so one row is archived) and a live one that goes with the account.
    const archivedPlan = await seedMealPlan(user, { semanaIso: '2024-W11', fechaInicio: '2024-03-11' });
    await seedSlots(user, archivedPlan.id, [{ recipeId: markedRecipe, tipoPlato: 'cena', estado: 'descartada' }]);
    await deletePlan(user, archivedPlan.id);
    const livePlan = await seedMealPlan(user, plannedWeek(0));
    await seedSlots(user, livePlan.id, [{ recipeId: markedRecipe, tipoPlato: 'comida', estado: 'cocinada' }]);
    expect((await historyOf(user.id)).length).toBe(1);

    const key = await serviceRoleKey();
    const res = await nativeFetch(`${resolveUrl()}/auth/v1/admin/users/${user.id}`, {
      method: 'DELETE',
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    expect(res.status).toBe(200);

    expect(await historyOf(user.id)).toEqual([]);
    const plans = await rest('meal_plans', { serviceRole: true, query: `user_id=eq.${user.id}&select=id` });
    expect(plans.body).toEqual([]);
  });
});
