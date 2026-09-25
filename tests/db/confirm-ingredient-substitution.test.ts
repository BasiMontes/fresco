/**
 * FRESCO-534 — proves `confirm_ingredient_substitution` writes only to the
 * caller's own slot (RLS-scoped, no identity parameter — see `ADR-0033`),
 * re-verifies the candidate's safety at write time (not just read time), and
 * rejects an ingredient that isn't actually part of the slot's recipe.
 *
 * Runs only when `RUN_DB_INTEGRATION=1` AND the local Supabase stack answers —
 * `bun run test:db`. A bare `bun test` / `bun run test:coverage` skips the
 * whole file (see `tests/db/README.md`).
 */

import type { DbTestUser } from './harness';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { createDbTestContext, rest, rpc, seedMealPlan, seedSlots, stackReachable } from './harness';

const RUN = process.env.RUN_DB_INTEGRATION === '1';
const reachable = RUN ? await stackReachable() : false;

interface RecipeRow { id: string, ingredientes_principales: string[] }

/**
 * A catalog recipe that lists "gambas" (FRESCO-715's seed offers "tofu
 * firme" for it) but NOT "leche" — the second condition keeps the
 * recipe-membership test deterministic (see that test below).
 */
async function findGambasRecipe(user: DbTestUser): Promise<RecipeRow> {
  const res = await rest('recipes', {
    token: user.token,
    query: 'select=id,ingredientes_principales&ingredientes_principales=cs.%5B%22gambas%22%5D&ingredientes_principales=not.cs.%5B%22leche%22%5D&limit=1',
  });
  if (!Array.isArray(res.body) || res.body.length === 0) {
    throw new Error(`[test] no catalog recipe with "gambas" found: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body[0] as RecipeRow;
}

describe.skipIf(!(RUN && reachable))('confirm_ingredient_substitution (real DB)', () => {
  const ctx = createDbTestContext();
  let owner: DbTestUser;
  let intruder: DbTestUser;
  let recipe: RecipeRow;

  beforeAll(async () => {
    [owner, intruder] = await Promise.all([ctx.createUser(), ctx.createUser()]);
    recipe = await findGambasRecipe(owner);
  });

  afterAll(async () => ctx.cleanupAll());

  test('the owner confirms a currently-safe substitute for their own slot', async () => {
    const plan = await seedMealPlan(owner);
    const [slotId] = await seedSlots(owner, plan.id, [{ recipeId: recipe.id, tipoPlato: 'comida' }]);

    const res = await rpc('confirm_ingredient_substitution', {
      p_slot_id: slotId,
      p_ingrediente_original: 'gambas',
      p_ingrediente_sustituto: 'tofu firme',
    }, { token: owner.token });

    expect(res.status).toBe(204);

    const slot = await rest('meal_plan_recipes', { token: owner.token, query: `id=eq.${slotId}&select=sustitucion_ingrediente` });
    expect((slot.body as { sustitucion_ingrediente: unknown }[])[0].sustitucion_ingrediente)
      .toEqual({ original: 'gambas', sustituto: 'tofu firme' });
  });

  test('a candidate that is no longer safe (declared soy allergy) is rejected, even though it was in the catalog', async () => {
    const soyAllergic = await ctx.createUser();
    await rest('user_profiles', {
      method: 'PATCH',
      token: soyAllergic.token,
      query: `id=eq.${soyAllergic.id}`,
      prefer: 'return=minimal',
      body: { alergenos: ['soja'] },
    });
    const plan = await seedMealPlan(soyAllergic, { semanaIso: '2099-W02', fechaInicio: '2099-01-12' });
    const [slotId] = await seedSlots(soyAllergic, plan.id, [{ recipeId: recipe.id, tipoPlato: 'comida' }]);

    const res = await rpc('confirm_ingredient_substitution', {
      p_slot_id: slotId,
      p_ingrediente_original: 'gambas',
      p_ingrediente_sustituto: 'tofu firme',
    }, { token: soyAllergic.token });

    expect(res.status).toBe(400);
    expect((res.body as { code?: string }).code).toBe('P0001');

    const slot = await rest('meal_plan_recipes', { token: soyAllergic.token, query: `id=eq.${slotId}&select=sustitucion_ingrediente` });
    expect((slot.body as { sustitucion_ingrediente: unknown }[])[0].sustitucion_ingrediente).toBeNull();
  });

  test('a different user cannot confirm a substitution on someone else\'s slot — RLS scoping, not a spoofed parameter', async () => {
    const plan = await seedMealPlan(owner, { semanaIso: '2099-W03', fechaInicio: '2099-01-19' });
    const [slotId] = await seedSlots(owner, plan.id, [{ recipeId: recipe.id, tipoPlato: 'cena' }]);

    const res = await rpc('confirm_ingredient_substitution', {
      p_slot_id: slotId,
      p_ingrediente_original: 'gambas',
      p_ingrediente_sustituto: 'tofu firme',
    }, { token: intruder.token });

    expect(res.status).toBe(400);
    expect((res.body as { code?: string }).code).toBe('P0001');

    const reread = await rest('meal_plan_recipes', { token: owner.token, query: `id=eq.${slotId}&select=sustitucion_ingrediente` });
    expect((reread.body as { sustitucion_ingrediente: unknown }[])[0].sustitucion_ingrediente).toBeNull();
  });

  test('a genuinely safe substitute pair is still rejected when the original ingredient is not part of THIS slot\'s recipe', async () => {
    // "leche" -> "leche de avena" passes the step-0 safety check on its own
    // (a real, safe FRESCO-715 catalog pair) -- this isolates the recipe-
    // membership guard specifically, since the "gambas" recipe never lists
    // "leche" as an ingredient.
    const plan = await seedMealPlan(owner, { semanaIso: '2099-W04', fechaInicio: '2099-01-26' });
    const [slotId] = await seedSlots(owner, plan.id, [{ recipeId: recipe.id, tipoPlato: 'desayuno' }]);

    const res = await rpc('confirm_ingredient_substitution', {
      p_slot_id: slotId,
      p_ingrediente_original: 'leche',
      p_ingrediente_sustituto: 'leche de avena',
    }, { token: owner.token });

    expect(res.status).toBe(400);
    expect((res.body as { code?: string }).code).toBe('P0001');
  });
});
