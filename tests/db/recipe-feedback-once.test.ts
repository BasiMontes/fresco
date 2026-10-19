/**
 * FRESCO-1012 (audit 7b A7-AUTHZ-02, A7-LOGIC-10) — the global recipe ranking cannot be moved from one account.
 *   1. A user who discards the same recipe in 3 plans adds 1 to `veces_descartada`, not 3; the same for cooking.
 *   2. A second user adds their own 1: the aggregate is per (user, recipe).
 *   3. Cooking and discarding the same recipe each count once (they are different feedback).
 *   4. A rating on a slot no longer feeds `rating_promedio` / `veces_calificada` (ADR-0063).
 *   5. `copy_meal_plan_to_week` only targets the current or the next ISO week, with that week's Monday.
 *   6. Nobody but the service role reads the feedback table.
 *
 * Runs only with `RUN_DB_INTEGRATION=1` and a reachable local stack: `bun run test:db`.
 */

import type { DbTestUser } from './harness';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { catalogRecipeIds, createDbTestContext, farWeek, plannedWeek, rest, rpc, seedMealPlan, seedSlots, stackReachable } from './harness';

const RUN = process.env.RUN_DB_INTEGRATION === '1';
const reachable = RUN ? await stackReachable() : false;

const PERMISSION_DENIED = '42501';

describe.skipIf(!(RUN && reachable))('learning counts once per user and recipe (real DB)', () => {
  const ctx = createDbTestContext();
  let a: DbTestUser;
  let b: DbTestUser;
  let recipes: string[];
  let week = 10;

  beforeAll(async () => {
    a = await ctx.createUser();
    b = await ctx.createUser();
    recipes = await catalogRecipeIds(a, 6);
  });

  afterAll(async () => {
    await ctx.cleanupAll();
  });

  async function stats(recipeId: string) {
    const res = await rest('recipes', { serviceRole: true, query: `id=eq.${recipeId}&select=veces_cocinada,veces_descartada,veces_calificada,rating_promedio` });
    return (res.body as Array<{ veces_cocinada: number, veces_descartada: number, veces_calificada: number, rating_promedio: number | null }>)[0];
  }

  /** A fresh plan in a far week holding `recipeId` in one slot; returns the slot id. */
  async function planWith(user: DbTestUser, recipeId: string): Promise<string> {
    const plan = await seedMealPlan(user, farWeek(week++));
    const [slot] = await seedSlots(user, plan.id, [{ recipeId, tipoPlato: 'comida' }]);
    return slot;
  }

  const mark = async (slotId: string, body: Record<string, unknown>) =>
    rest('meal_plan_recipes', { method: 'PATCH', serviceRole: true, query: `id=eq.${slotId}`, body });

  test('the same user discarding one recipe in 3 plans adds 1, not 3', async () => {
    const recipe = recipes[0];
    const before = await stats(recipe);

    for (let i = 0; i < 3; i++) {
      await mark(await planWith(a, recipe), { estado: 'descartada' });
    }

    expect((await stats(recipe)).veces_descartada).toBe(before.veces_descartada + 1);
  });

  test('a second user adds their own 1', async () => {
    const recipe = recipes[1];
    const before = await stats(recipe);

    await mark(await planWith(a, recipe), { estado: 'descartada' });
    await mark(await planWith(b, recipe), { estado: 'descartada' });
    await mark(await planWith(b, recipe), { estado: 'descartada' });

    expect((await stats(recipe)).veces_descartada).toBe(before.veces_descartada + 2);
  });

  test('cooking counts once per user and recipe too, and independently of discarding', async () => {
    const recipe = recipes[2];
    const before = await stats(recipe);

    for (let i = 0; i < 3; i++) {
      await mark(await planWith(a, recipe), { estado: 'cocinada' });
    }
    await mark(await planWith(a, recipe), { estado: 'descartada' });

    const after = await stats(recipe);
    expect(after.veces_cocinada).toBe(before.veces_cocinada + 1);
    expect(after.veces_descartada).toBe(before.veces_descartada + 1);
  });

  test('a rating on a cooked slot no longer moves rating_promedio or veces_calificada', async () => {
    const recipe = recipes[3];
    const before = await stats(recipe);

    await mark(await planWith(a, recipe), { estado: 'cocinada', rating: 5 });

    const after = await stats(recipe);
    expect(after.veces_calificada).toBe(before.veces_calificada);
    expect(after.rating_promedio).toBe(before.rating_promedio);
    expect(after.veces_cocinada).toBe(before.veces_cocinada + 1);
  });

  test('re-writing the same estado does not count again', async () => {
    const recipe = recipes[4];
    const slot = await planWith(a, recipe);
    await mark(slot, { estado: 'descartada' });
    const once = await stats(recipe);

    await mark(slot, { estado: 'descartada' });

    expect((await stats(recipe)).veces_descartada).toBe(once.veces_descartada);
  });

  test('the feedback table is closed to every browser role', async () => {
    expect((await rest('recipe_user_feedback', { token: a.token, query: 'select=user_id' })).status).toBe(403);
    const anon = await rest('recipe_user_feedback', { query: 'select=user_id' });
    expect((anon.body as { code?: string }).code).toBe(PERMISSION_DENIED);
  });
});

describe.skipIf(!(RUN && reachable))('copy_meal_plan_to_week target window (real DB)', () => {
  const ctx = createDbTestContext();
  let user: DbTestUser;
  let sourceId: string;

  beforeAll(async () => {
    user = await ctx.createUser();
    const [recipeId] = await catalogRecipeIds(user, 1);
    const source = await seedMealPlan(user, farWeek(40));
    await seedSlots(user, source.id, [{ recipeId, tipoPlato: 'comida' }]);
    sourceId = source.id;
  });

  afterAll(async () => {
    await ctx.cleanupAll();
  });

  const copy = async (semanaIso: string, fechaInicio: string) =>
    rpc('copy_meal_plan_to_week', { p_source_meal_plan_id: sourceId, p_semana_iso: semanaIso, p_fecha_inicio: fechaInicio }, { token: user.token });

  test('the current and the next week are accepted', async () => {
    const current = plannedWeek(0);
    const next = plannedWeek(1);

    expect((await copy(current.semanaIso, current.fechaInicio)).status).toBe(200);
    expect((await copy(next.semanaIso, next.fechaInicio)).status).toBe(200);
  });

  test('a far week, a past week and two weeks ahead are refused with 22023', async () => {
    for (const target of [farWeek(41), plannedWeek(-1), plannedWeek(2)]) {
      const res = await copy(target.semanaIso, target.fechaInicio);
      expect(res.status, target.semanaIso).toBe(400);
      expect((res.body as { code?: string }).code).toBe('22023');
    }
  });

  test('a date that is not the Monday of the week is refused', async () => {
    const next = plannedWeek(1);
    const wrongMonday = new Date(`${next.fechaInicio}T00:00:00Z`);
    wrongMonday.setUTCDate(wrongMonday.getUTCDate() + 1);

    const res = await copy(next.semanaIso, wrongMonday.toISOString().slice(0, 10));

    expect(res.status).toBe(400);
    expect((res.body as { code?: string }).code).toBe('22023');
  });

  test('a refused call creates no plan', async () => {
    const before = await rest('meal_plans', { token: user.token, query: 'select=id' });
    await copy(farWeek(42).semanaIso, farWeek(42).fechaInicio);
    const after = await rest('meal_plans', { token: user.token, query: 'select=id' });

    expect((after.body as unknown[]).length).toBe((before.body as unknown[]).length);
  });
});
