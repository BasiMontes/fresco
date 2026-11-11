/**
 * FRESCO-1089 (audit-8 A8-AUTHZ-01) — `reassign_guest_data` must re-filter the
 * moved slots against the WHOLE profile of the target account, not only its
 * allergens. Before, a guest plan carrying a dish the account's diet or its
 * disliked ingredients rule out, or a retired recipe, landed in the account's
 * menu untouched. `copy_meal_plan_to_week` got the same filter in FRESCO-994.
 *
 * Proven against the real database, calling the function the way the
 * `reassign-guest-data` Edge Function does (service role):
 *   1. a recipe that breaks the target's diet is neutralized;
 *   2. a recipe with an ingredient the target dislikes is neutralized;
 *   3. an inactive recipe is neutralized;
 *   4. a recipe with a declared allergen is neutralized (the FRESCO-362 rule);
 *   5. a recipe that passes everything is kept untouched;
 *   6. the returned count equals the number of neutralized slots.
 * A neutralized slot has the shape menu generation already writes for a slot
 * with no safe recipe: `estado = 'excluida'`, `recipe_id = null`.
 *
 * Runs only when `RUN_DB_INTEGRATION=1` AND the local Supabase stack answers —
 * `bun run test:db`. A bare `bun test` skips the whole file (see
 * `tests/db/README.md`).
 */

import type { DbTestUser } from './harness';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { createDbTestContext, farWeek, rest, restAll, rpc, seedMealPlan, seedSlots, stackReachable } from './harness';

const RUN = process.env.RUN_DB_INTEGRATION === '1';
const reachable = RUN ? await stackReachable() : false;

interface RecipeRow {
  id: string
  activo: boolean
  dieta: Record<string, boolean> | null
  alergenos: string[] | null
  ingredientes_principales: string[] | null
}

interface SlotRow {
  tipo_plato: string
  recipe_id: string | null
  estado: string
}

const lower = (values: string[] | null): string[] => (values ?? []).map(v => v.toLowerCase());
const isVegan = (r: RecipeRow): boolean => r.dieta?.vegano === true;

function pick(recipes: RecipeRow[], what: string, predicate: (r: RecipeRow) => boolean): RecipeRow {
  const found = recipes.find(predicate);
  if (!found) { throw new Error(`[test] no catalog recipe for: ${what}`); }
  return found;
}

describe.skipIf(!(RUN && reachable))('reassign_guest_data applies the full food-safety filter (real DB)', () => {
  const ctx = createDbTestContext();
  let guest: DbTestUser;
  let target: DbTestUser;
  let planId: string;
  let safe: RecipeRow;
  let breaksDiet: RecipeRow;
  let hasDislikedIngredient: RecipeRow;
  let inactive: RecipeRow;
  let hasAllergen: RecipeRow;
  let dislikedIngredient: string;

  beforeAll(async () => {
    guest = await ctx.createUser();
    target = await ctx.createUser({ healthDataConsent: true });

    const recipes = await restAll<RecipeRow>('recipes', {
      serviceRole: true,
      select: 'id,activo,dieta,alergenos,ingredientes_principales',
      order: 'id.asc',
    });

    // Target profile under test: vegan, gluten declared, one disliked ingredient.
    // The disliked ingredient is taken from a vegan, gluten-free, active recipe so
    // that recipe fails ONLY on the dislike.
    hasDislikedIngredient = pick(
      recipes,
      'vegan, active, gluten-free, with an ingredient',
      r => r.activo && isVegan(r) && !lower(r.alergenos).includes('gluten') && lower(r.ingredientes_principales).length > 0,
    );
    dislikedIngredient = lower(hasDislikedIngredient.ingredientes_principales)[0];
    const dislikes = (r: RecipeRow): boolean => lower(r.ingredientes_principales).includes(dislikedIngredient);

    safe = pick(recipes, 'passes every rule', r => r.activo && isVegan(r) && !lower(r.alergenos).includes('gluten') && !dislikes(r));
    breaksDiet = pick(recipes, 'active, not vegan, no gluten, no disliked ingredient', r => r.activo && !isVegan(r) && !lower(r.alergenos).includes('gluten') && !dislikes(r));
    inactive = pick(recipes, 'inactive, vegan, no gluten, no disliked ingredient', r => !r.activo && isVegan(r) && !lower(r.alergenos).includes('gluten') && !dislikes(r));
    hasAllergen = pick(recipes, 'active, vegan, with gluten, no disliked ingredient', r => r.activo && isVegan(r) && lower(r.alergenos).includes('gluten') && !dislikes(r));

    const declared = await rest('user_profiles', {
      method: 'PATCH',
      token: target.token,
      query: `id=eq.${target.id}`,
      prefer: 'return=minimal',
      body: { dieta_vegetariano: true, dieta_vegano: true, alergenos: ['gluten'], ingredientes_odiados: [dislikedIngredient] },
    });
    expect(declared).toEqual({ status: 204, body: null });

    const plan = await seedMealPlan(guest, farWeek(10));
    planId = plan.id;
    await seedSlots(guest, planId, [
      { recipeId: safe.id, tipoPlato: 'comida' },
      { recipeId: breaksDiet.id, tipoPlato: 'cena' },
      { recipeId: hasDislikedIngredient.id, tipoPlato: 'desayuno' },
      { recipeId: inactive.id, tipoPlato: 'comida' },
      { recipeId: hasAllergen.id, tipoPlato: 'cena' },
    ]);
  });

  afterAll(async () => ctx.cleanupAll());

  test('slots failing the target diet, dislikes, activity or allergens are neutralized; a safe one is kept', async () => {
    const res = await rpc(
      'reassign_guest_data',
      { p_from_user_id: guest.id, p_to_user_id: target.id },
      { serviceRole: true },
    );
    expect(res.status).toBe(200);
    expect(res.body).toBe(4);

    const owner = await rest('meal_plans', { serviceRole: true, query: `id=eq.${planId}&select=user_id` });
    expect((owner.body as { user_id: string }[])[0].user_id).toBe(target.id);

    const slotsRes = await rest('meal_plan_recipes', {
      serviceRole: true,
      query: `meal_plan_id=eq.${planId}&select=tipo_plato,recipe_id,estado&order=dia.asc`,
    });
    const slots = slotsRes.body as SlotRow[];
    expect(slots).toHaveLength(5);

    const kept = slots.filter(s => s.recipe_id !== null);
    expect(kept.map(s => s.recipe_id)).toEqual([safe.id]);
    expect(kept[0].estado).toBe('pendiente');

    // FRESCO-1157: a dish taken out for the profile leaves an OPEN empty slot ("Sin receta", it can be filled),
    // not an `excluida` one, which the calendar paints "Excluida por ti" and which no recipe can be put into.
    const neutralized = slots.filter(s => s.recipe_id === null);
    expect(neutralized).toHaveLength(4);
    for (const slot of neutralized) {
      expect(slot.estado).toBe('pendiente');
    }

    // ... and the person is told, once per plan, with the number of dishes taken out.
    const plan = await rest('meal_plans', { serviceRole: true, query: `id=eq.${planId}&select=advertencias` });
    const avisos = (plan.body as { advertencias: string[] }[])[0].advertencias.filter(a => a.includes('con tu perfil'));
    expect(avisos).toHaveLength(1);
    expect(avisos[0]).toContain('4 platos');

    // None of the ruled-out recipes may survive anywhere on the moved plan.
    const surviving = slots.map(s => s.recipe_id);
    for (const bad of [breaksDiet, hasDislikedIngredient, inactive, hasAllergen]) {
      expect(surviving).not.toContain(bad.id);
    }
  });
});
