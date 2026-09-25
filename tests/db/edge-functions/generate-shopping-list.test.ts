/**
 * FRESCO-464 PR2 — HTTP negative-contract tests for generate-shopping-list.
 *
 * Real HTTP against the local Supabase Edge Functions runtime (`supabase
 * start`), not mocked, not e2e. This function has no rate limit of its own,
 * so only the auth gate and body validation apply.
 *
 * Runs only when `RUN_DB_INTEGRATION=1` AND the local stack answers —
 * `bun run test:db`. See tests/db/README.md.
 */

import type { DbTestUser } from '../harness';
import { afterAll, describe, expect, test } from 'bun:test';
import { callFunction, createDbTestContext, rest, seedMealPlan, seedSlots, stackReachable } from '../harness';

const RUN = process.env.RUN_DB_INTEGRATION === '1';
const reachable = RUN ? await stackReachable() : false;

const ENDPOINT = 'generate-shopping-list';

interface Pasillo { items: { nombre: string, cantidad: number }[] }
interface ShoppingListResponse { pasillos: Pasillo[] }
interface RecipeRow { id: string, ingredientes_principales: string[] }

function totalFor(response: ShoppingListResponse, nombre: string): number {
  return response.pasillos
    .flatMap(p => p.items)
    .filter(item => item.nombre.toLowerCase() === nombre.toLowerCase())
    .reduce((sum, item) => sum + item.cantidad, 0);
}

/** Same deterministic lookup as `tests/db/confirm-ingredient-substitution.test.ts` — a real catalog recipe that lists "gambas". */
async function findGambasRecipe(user: DbTestUser): Promise<RecipeRow> {
  const res = await rest('recipes', {
    token: user.token,
    query: 'select=id,ingredientes_principales&ingredientes_principales=cs.%5B%22gambas%22%5D&limit=1',
  });
  if (!Array.isArray(res.body) || res.body.length === 0) {
    throw new Error(`[test] no catalog recipe with "gambas" found: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body[0] as RecipeRow;
}

describe.skipIf(!(RUN && reachable))('generate-shopping-list — HTTP negative contract (real functions runtime)', () => {
  const ctx = createDbTestContext();

  afterAll(async () => ctx.cleanupAll());

  test('401 when called with no token', async () => {
    const res = await callFunction(ENDPOINT, {});
    expect(res.status).toBe(401);
  });

  test('401 when called with a garbage token', async () => {
    const res = await callFunction(ENDPOINT, { token: 'not-a-real-jwt' });
    expect(res.status).toBe(401);
  });

  test('400 when the body is missing meal_plan_id', async () => {
    const user = await ctx.createUser();
    const res = await callFunction(ENDPOINT, { token: user.token, body: {} });
    expect(res.status).toBe(400);
  });
});

/**
 * FRESCO-716/ADR-0033 — a confirmed per-slot ingredient substitution must
 * show up in the generated shopping list instead of the original, without
 * affecting a different slot that still uses the original ingredient.
 */
describe.skipIf(!(RUN && reachable))('generate-shopping-list — reflects a confirmed ingredient substitution (real functions runtime)', () => {
  const ctx = createDbTestContext();

  afterAll(async () => ctx.cleanupAll());

  test('a substituted slot contributes the substitute; an unsubstituted slot of the same recipe still contributes the original', async () => {
    const user = await ctx.createUser();
    const recipe = await findGambasRecipe(user);
    const plan = await seedMealPlan(user);
    const [substitutedSlotId] = await seedSlots(user, plan.id, [
      { recipeId: recipe.id, tipoPlato: 'comida' },
      { recipeId: recipe.id, tipoPlato: 'cena' },
    ]);

    await rest('meal_plan_recipes', {
      method: 'PATCH',
      token: user.token,
      query: `id=eq.${substitutedSlotId}`,
      prefer: 'return=minimal',
      body: { sustitucion_ingrediente: { original: 'gambas', sustituto: 'tofu firme' } },
    });

    const res = await callFunction(ENDPOINT, { token: user.token, body: { meal_plan_id: plan.id } });

    expect(res.status).toBe(200);
    const body = res.body as ShoppingListResponse;
    // The substituted slot's own "gambas" is gone from its total, replaced
    // by "tofu firme"; the second, unsubstituted slot (same recipe) still
    // contributes "gambas" — both totals must be positive, proving neither
    // slot's contribution leaked into the other's.
    expect(totalFor(body, 'tofu firme')).toBeGreaterThan(0);
    expect(totalFor(body, 'gambas')).toBeGreaterThan(0);
  });

  test('no confirmed substitutions — the list shows the original ingredient, unchanged', async () => {
    const user = await ctx.createUser();
    const recipe = await findGambasRecipe(user);
    const plan = await seedMealPlan(user, { semanaIso: '2099-W05', fechaInicio: '2099-02-02' });
    await seedSlots(user, plan.id, [{ recipeId: recipe.id, tipoPlato: 'comida' }]);

    const res = await callFunction(ENDPOINT, { token: user.token, body: { meal_plan_id: plan.id } });

    expect(res.status).toBe(200);
    const body = res.body as ShoppingListResponse;
    expect(totalFor(body, 'gambas')).toBeGreaterThan(0);
    expect(totalFor(body, 'tofu firme')).toBe(0);
  });
});
