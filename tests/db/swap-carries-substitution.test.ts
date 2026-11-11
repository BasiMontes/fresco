/**
 * FRESCO-1155 (revisión integral, hallazgo FS-5) — dragging two dishes of the calendar to swap them moved
 * `recipe_id`, `estado` and `rating` but not `sustitucion_ingrediente`. The substitution stayed in the slot
 * and the recipe left: the dish the person had adjusted brought its ORIGINAL ingredient back into the
 * shopping list, and the other dish inherited a substitution it never had.
 *
 * Proven against the real database with real sessions, through the same RPC the calendar calls:
 *   1. after the swap the substitution goes with its recipe, and the slot that had none now has none;
 *   2. two slots that each carry a substitution trade them, each with its own recipe;
 *   3. a swap with a slot that has no substitution on either side changes nothing else (control).
 *
 * Runs only when `RUN_DB_INTEGRATION=1` AND the local Supabase stack answers — `bun run test:db`.
 */

import type { DbTestUser } from './harness';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { createDbTestContext, plannedWeek, rest, rpc, seedMealPlan, seedSlots, stackReachable } from './harness';

const RUN = process.env.RUN_DB_INTEGRATION === '1';
const reachable = RUN ? await stackReachable() : false;

interface Substitution { original: string, sustituto: string }
interface SlotRow { recipe_id: string | null, estado: string, sustitucion_ingrediente: Substitution | null }

async function recipeWith(user: DbTestUser, ingrediente: string): Promise<string> {
  const res = await rest('recipes', {
    token: user.token,
    query: `select=id&activo=eq.true&ingredientes_principales=cs.["${ingrediente}"]&alergenos=not.cs.["soja"]&order=id.asc&limit=1`,
  });
  const row = (res.body as { id: string }[])[0];
  if (!row) { throw new Error(`[test] no active catalogue recipe with ${ingrediente}`); }
  return row.id;
}

async function confirm(user: DbTestUser, slotId: string, original: string, sustituto: string): Promise<void> {
  const res = await rpc('confirm_ingredient_substitution', {
    p_slot_id: slotId,
    p_ingrediente_original: original,
    p_ingrediente_sustituto: sustituto,
  }, { token: user.token });
  expect(res.status).toBeLessThan(300);
}

async function slotOf(slotId: string): Promise<SlotRow> {
  const res = await rest('meal_plan_recipes', { serviceRole: true, query: `id=eq.${slotId}&select=recipe_id,estado,sustitucion_ingrediente` });
  return (res.body as SlotRow[])[0];
}

async function swap(user: DbTestUser, a: string, b: string): Promise<void> {
  const res = await rpc('swap_meal_plan_slots', { p_slot_a_id: a, p_slot_b_id: b }, { token: user.token });
  expect(res.status).toBeLessThan(300);
}

describe.skipIf(!(RUN && reachable))('swap_meal_plan_slots carries the ingredient substitution with its recipe (real DB)', () => {
  const ctx = createDbTestContext();
  let gambas: string;
  let leche: string;

  beforeAll(async () => {
    const probe = await ctx.createUser({ healthDataConsent: true });
    gambas = await recipeWith(probe, 'gambas');
    leche = await recipeWith(probe, 'leche');
  });

  afterAll(async () => ctx.cleanupAll());

  test('the substitution follows its recipe, and the slot that had none ends with none', async () => {
    const user = await ctx.createUser({ healthDataConsent: true });
    const plan = await seedMealPlan(user, plannedWeek(0));
    const [a, b] = await seedSlots(user, plan.id, [{ recipeId: gambas, tipoPlato: 'comida' }, { recipeId: leche, tipoPlato: 'comida' }]);
    await confirm(user, a, 'gambas', 'tofu firme');

    await swap(user, a, b);

    expect(await slotOf(a)).toMatchObject({ recipe_id: leche, sustitucion_ingrediente: null });
    expect(await slotOf(b)).toMatchObject({ recipe_id: gambas, sustitucion_ingrediente: { original: 'gambas', sustituto: 'tofu firme' } });
  });

  test('two slots that each carry a substitution trade them, each with its own recipe', async () => {
    const user = await ctx.createUser({ healthDataConsent: true });
    const plan = await seedMealPlan(user, plannedWeek(0));
    const [a, b] = await seedSlots(user, plan.id, [{ recipeId: gambas, tipoPlato: 'comida' }, { recipeId: leche, tipoPlato: 'comida' }]);
    await confirm(user, a, 'gambas', 'tofu firme');
    await confirm(user, b, 'leche', 'leche de coco');

    await swap(user, a, b);

    expect(await slotOf(a)).toMatchObject({ recipe_id: leche, sustitucion_ingrediente: { original: 'leche', sustituto: 'leche de coco' } });
    expect(await slotOf(b)).toMatchObject({ recipe_id: gambas, sustitucion_ingrediente: { original: 'gambas', sustituto: 'tofu firme' } });
  });

  test('control: with no substitution on either side the swap moves the recipes and nothing else', async () => {
    const user = await ctx.createUser({ healthDataConsent: true });
    const plan = await seedMealPlan(user, plannedWeek(0));
    const [a, b] = await seedSlots(user, plan.id, [{ recipeId: gambas, tipoPlato: 'comida' }, { recipeId: leche, tipoPlato: 'comida' }]);

    await swap(user, a, b);

    expect(await slotOf(a)).toMatchObject({ recipe_id: leche, estado: 'pendiente', sustitucion_ingrediente: null });
    expect(await slotOf(b)).toMatchObject({ recipe_id: gambas, estado: 'pendiente', sustitucion_ingrediente: null });
  });
});
