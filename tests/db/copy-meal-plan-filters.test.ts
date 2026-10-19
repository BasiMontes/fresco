/**
 * FRESCO-994 (audit-7b A7-AUTHZ-01 + A7-TEST-02) — `copy_meal_plan_to_week`
 * ("Usar este menú") must apply the same food-safety filter as every other way
 * a recipe reaches a plan. Before, it copied every slot of the source week as it
 * was, so a user who declared an allergen after that week was generated, or whose
 * recipe was re-tagged or retired since, got the dish back.
 *
 * Proven against the real database with a real session:
 *   1. a recipe the profile rules out (allergen) is not copied: the slot is left
 *      empty (`recipe_id` null, `pendiente`) and the new plan carries an
 *      `advertencias` entry;
 *   2. an inactive recipe is not copied either;
 *   3. a recipe that passes the filter is copied untouched and writes no warning;
 *   4. the RPC is rate limited and registered in `rate_limit_endpoints`.
 *
 * Runs only when `RUN_DB_INTEGRATION=1` AND the local Supabase stack answers —
 * `bun run test:db`. A bare `bun test` skips the whole file (see
 * `tests/db/README.md`).
 */

import type { DbTestUser } from './harness';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { createDbTestContext, plannedWeek, rest, rpc, seedMealPlan, seedSlots, stackReachable } from './harness';

const RUN = process.env.RUN_DB_INTEGRATION === '1';
const reachable = RUN ? await stackReachable() : false;

interface SlotRow {
  dia: string
  tipo_plato: string
  recipe_id: string | null
  estado: string
}

async function firstRecipeId(user: DbTestUser, filter: string): Promise<string> {
  const res = await rest('recipes', { token: user.token, query: `select=id&${filter}&order=id.asc&limit=1` });
  const row = (res.body as { id: string }[])[0];
  if (!row) { throw new Error(`[test] no catalog recipe for ${filter}`); }
  return row.id;
}

async function allowedRecipeId(user: DbTestUser, tipo: string): Promise<string> {
  const res = await rpc('get_filtered_recipes', { p_user_id: user.id }, { token: user.token });
  const recipes = res.body as { id: string, clasificacion: { tipo_plato?: string } | null }[];
  const found = recipes.find(r => r.clasificacion?.tipo_plato === tipo);
  if (!found) { throw new Error(`[test] no allowed recipe of tipo_plato ${tipo}`); }
  return found.id;
}

async function copy(user: DbTestUser, sourceId: string, semanaIso: string, fechaInicio: string) {
  return rpc('copy_meal_plan_to_week', {
    p_source_meal_plan_id: sourceId,
    p_semana_iso: semanaIso,
    p_fecha_inicio: fechaInicio,
  }, { token: user.token });
}

async function slotsOf(user: DbTestUser, planId: string): Promise<SlotRow[]> {
  const res = await rest('meal_plan_recipes', {
    token: user.token,
    query: `meal_plan_id=eq.${planId}&select=dia,tipo_plato,recipe_id,estado&order=dia.asc,tipo_plato.asc`,
  });
  return res.body as SlotRow[];
}

async function advertenciasOf(user: DbTestUser, planId: string): Promise<string[]> {
  const res = await rest('meal_plans', { token: user.token, query: `id=eq.${planId}&select=advertencias` });
  return (res.body as { advertencias: string[] }[])[0].advertencias;
}

describe.skipIf(!(RUN && reachable))('copy_meal_plan_to_week applies the food-safety filter (real DB)', () => {
  const ctx = createDbTestContext();
  let user: DbTestUser;
  let safeId: string;
  let glutenId: string;
  let inactiveId: string;

  beforeAll(async () => {
    user = await ctx.createUser({ healthDataConsent: true });
    glutenId = await firstRecipeId(user, 'activo=eq.true&alergenos=cs.["gluten"]');
    inactiveId = await firstRecipeId(user, 'activo=eq.false');
    const declared = await rest('user_profiles', {
      method: 'PATCH',
      token: user.token,
      query: `id=eq.${user.id}`,
      prefer: 'return=minimal',
      body: { alergenos: ['gluten'] },
    });
    expect(declared.status).toBe(204);
    safeId = await allowedRecipeId(user, 'comida');
  });

  afterAll(async () => ctx.cleanupAll());

  test('a recipe the profile rules out and an inactive recipe are left empty, with a warning; a safe one is copied', async () => {
    const source = await seedMealPlan(user, { semanaIso: '2099-W01', fechaInicio: '2099-01-05' });
    await seedSlots(user, source.id, [
      { recipeId: safeId, tipoPlato: 'comida' },
      { recipeId: glutenId, tipoPlato: 'cena' },
      { recipeId: inactiveId, tipoPlato: 'desayuno' },
    ]);

    const target = plannedWeek(1);
    const res = await copy(user, source.id, target.semanaIso, target.fechaInicio);
    expect(res.status).toBe(200);
    const newPlanId = res.body as string;

    const slots = await slotsOf(user, newPlanId);
    expect(slots).toHaveLength(3);
    const byTipo = Object.fromEntries(slots.map(s => [s.tipo_plato, s]));
    expect(byTipo.comida.recipe_id).toBe(safeId);
    expect(byTipo.cena.recipe_id).toBeNull();
    expect(byTipo.cena.estado).toBe('pendiente');
    expect(byTipo.desayuno.recipe_id).toBeNull();
    expect(byTipo.desayuno.estado).toBe('pendiente');
    // No filtered-out recipe id may survive anywhere on the new plan.
    expect(slots.map(s => s.recipe_id)).not.toContain(glutenId);
    expect(slots.map(s => s.recipe_id)).not.toContain(inactiveId);

    const warnings = await advertenciasOf(user, newPlanId);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('perfil');
  });

  test('a plan whose recipes all pass the filter is copied as is and writes no warning', async () => {
    const source = await seedMealPlan(user, { semanaIso: '2099-W03', fechaInicio: '2099-01-19' });
    await seedSlots(user, source.id, [{ recipeId: safeId, tipoPlato: 'comida' }]);

    const target = plannedWeek(0);
    const res = await copy(user, source.id, target.semanaIso, target.fechaInicio);
    expect(res.status).toBe(200);
    const newPlanId = res.body as string;

    const slots = await slotsOf(user, newPlanId);
    expect(slots.map(s => s.recipe_id)).toEqual([safeId]);
    expect(await advertenciasOf(user, newPlanId)).toEqual([]);
  });

  test('copy_meal_plan_to_week is registered in rate_limit_endpoints and the call past the limit fails', async () => {
    // An unregistered endpoint makes check_and_increment_rate_limit raise 'unknown endpoint', so
    // 20 successful calls also prove the registry row; the registry itself is closed to clients.
    const ceiling = 20;

    const limited = await ctx.createUser();
    const source = await seedMealPlan(limited, { semanaIso: '2099-W05', fechaInicio: '2099-02-02' });
    await seedSlots(limited, source.id, [{ recipeId: safeId, tipoPlato: 'comida' }]);

    const target = plannedWeek(1);
    for (let i = 0; i < ceiling; i++) {
      const ok = await copy(limited, source.id, target.semanaIso, target.fechaInicio);
      expect(ok.status).toBe(200);
    }
    const over = await copy(limited, source.id, target.semanaIso, target.fechaInicio);
    expect(over.status).toBe(400);
    expect((over.body as { message?: string }).message ?? '').toContain('rate limit exceeded');
  });
});
