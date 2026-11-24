/**
 * FRESCO-1263 — an authenticated user can read back their own generated menu, with the recipes behind it.
 *
 * Scenario "Un usuario autenticado puede leer de vuelta su propio menú generado" (`.context/qa/regression.feature`).
 * The real regression, 2026-07-29: the RLS policy of `recipes` only let the `anon` role in, so a signed-in user got the
 * plan back with every recipe empty, or a permission error. Other tests here read `recipes` with a user token, but none
 * pinned that failure with the select the calendar actually uses (`lib/api/meal-plan.ts`: `meal_plan_recipes` with the
 * `recipes` embedded), and a plan read can fail on the embed while a plain read of `recipes` still works.
 *
 * The user is an ordinary one with their own JWT, never the service-role key, and not an admin. Only the seeding of the
 * plan and its slots goes through the service role, because `authenticated` can no longer insert them (FRESCO-777).
 *
 * Runs only under `bun run test:db` (`RUN_DB_INTEGRATION=1` + reachable stack).
 */

import type { DbTestUser } from './harness';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import {
  createDbTestContext,
  rest,
  seedMealPlan,
  seedSlots,
  stackReachable,
} from './harness';

const RUN = process.env.RUN_DB_INTEGRATION === '1';
const reachable = RUN ? await stackReachable() : false;

/** The select `getMealPlanForWeek` sends (`lib/api/meal-plan.ts`). */
const CALENDAR_SELECT = 'id,semana_iso,advertencias,explicacion_aprendizaje,meal_plan_recipes(id,dia,tipo_plato,estado,recipes(*))';

interface SlotRow {
  id: string
  tipo_plato: string
  recipes: { id: string, nombre: string } | null
}

describe.skipIf(!(RUN && reachable))('an authenticated user reads their own menu (real DB)', () => {
  const ctx = createDbTestContext();
  let user: DbTestUser;
  let planId: string;
  let recipeIds: string[];

  beforeAll(async () => {
    user = await ctx.createUser();
    // The ids come from the service role on purpose: the harness helper reads `recipes` with the user's token, so a broken
    // policy would fail this setup with a generic error instead of failing the assertions below that name the problem.
    const catalog = await rest('recipes', { serviceRole: true, query: 'select=id&activo=eq.true&order=id.asc&limit=3' });
    recipeIds = (catalog.body as { id: string }[]).map(r => r.id);
    expect(recipeIds).toHaveLength(3);
    ({ id: planId } = await seedMealPlan(user, { semanaIso: '2099-W01', fechaInicio: '2099-01-05' }));
    await seedSlots(user, planId, [
      { recipeId: recipeIds[0], tipoPlato: 'desayuno' },
      { recipeId: recipeIds[1], tipoPlato: 'comida' },
      { recipeId: recipeIds[2], tipoPlato: 'cena' },
    ]);
  });

  afterAll(async () => ctx.cleanupAll());

  test('the menu comes back with its slots and the recipe behind each one, as the calendar reads it', async () => {
    const res = await rest('meal_plans', { token: user.token, query: `id=eq.${planId}&select=${CALENDAR_SELECT}` });

    expect(res.status).toBe(200);
    const [plan] = res.body as { semana_iso: string, meal_plan_recipes: SlotRow[] }[];
    expect(plan.semana_iso).toBe('2099-W01');
    expect(plan.meal_plan_recipes).toHaveLength(3);
    // An embed the policy hides comes back as `null`, not as an error: that is how the 2026-07 regression looked.
    expect(plan.meal_plan_recipes.every(slot => slot.recipes !== null)).toBe(true);
    expect(plan.meal_plan_recipes.map(slot => slot.recipes?.id).sort()).toEqual([...recipeIds].sort());
    expect(plan.meal_plan_recipes.every(slot => typeof slot.recipes?.nombre === 'string' && slot.recipes.nombre.length > 0)).toBe(true);
  });

  test('the recipes themselves are readable with the user token, without any join', async () => {
    const res = await rest('recipes', { token: user.token, query: `id=in.(${recipeIds.join(',')})&select=id,nombre` });

    expect(res.status).toBe(200);
    expect((res.body as { id: string }[]).map(r => r.id).sort()).toEqual([...recipeIds].sort());
  });
});
