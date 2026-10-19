/**
 * FRESCO-1010 (audit 7b A7-LOGIC-07) — the shopping list learns that its plan changed.
 * `meal_plan_recipes` carries a trigger that sets `shopping_lists.desactualizada_desde` when a change alters
 * what is bought, and only then:
 *   1. a fresh list is not stale;
 *   2. cooking a slot, or rating it, does not make it stale (the ingredients were bought for it);
 *   3. discarding a slot, replacing its recipe, setting a substitution and adding a slot do (nothing deletes a slot but the plan's own cascade);
 *   4. a second change does not move the moment of the first;
 *   5. the owner can clear the flag, and nobody else can read or clear it.
 *
 * Runs only with `RUN_DB_INTEGRATION=1` and a reachable local stack: `bun run test:db`.
 */

import type { DbTestUser } from './harness';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { catalogRecipeIds, createDbTestContext, rest, seedMealPlan, seedShoppingList, seedSlots, stackReachable } from './harness';

const RUN = process.env.RUN_DB_INTEGRATION === '1';
const reachable = RUN ? await stackReachable() : false;

describe.skipIf(!(RUN && reachable))('shopping list stale flag (real DB)', () => {
  const ctx = createDbTestContext();
  let owner: DbTestUser;
  let stranger: DbTestUser;
  let recipes: string[];
  let week = 10;

  beforeAll(async () => {
    owner = await ctx.createUser();
    stranger = await ctx.createUser();
    recipes = await catalogRecipeIds(owner, 4);
  });

  afterAll(async () => {
    await ctx.cleanupAll();
  });

  async function setup() {
    const plan = await seedMealPlan(owner, { semanaIso: `2099-W${String(week++)}`, fechaInicio: '2099-03-02' });
    const slots = await seedSlots(owner, plan.id, [
      { recipeId: recipes[0], tipoPlato: 'comida' },
      { recipeId: recipes[1], tipoPlato: 'cena' },
    ]);
    const listId = await seedShoppingList(owner, plan.id);
    return { plan, slots, listId };
  }

  async function stale(listId: string, as: DbTestUser = owner): Promise<string | null | undefined> {
    const res = await rest('shopping_lists', { token: as.token, query: `id=eq.${listId}&select=desactualizada_desde` });
    const row = (res.body as Array<{ desactualizada_desde: string | null }>)[0];
    return row ? row.desactualizada_desde : undefined;
  }

  const patchSlot = async (slotId: string, body: Record<string, unknown>) =>
    rest('meal_plan_recipes', { method: 'PATCH', serviceRole: true, query: `id=eq.${slotId}`, body });

  test('a fresh list is not stale', async () => {
    const { listId } = await setup();

    expect(await stale(listId)).toBeNull();
  });

  test('cooking a slot or rating it does not make the list stale', async () => {
    const { listId, slots } = await setup();

    await patchSlot(slots[0], { estado: 'cocinada' });
    await patchSlot(slots[0], { rating: 4 });

    expect(await stale(listId)).toBeNull();
  });

  test('discarding a slot makes the list stale', async () => {
    const { listId, slots } = await setup();

    await patchSlot(slots[0], { estado: 'descartada' });

    expect(await stale(listId)).not.toBeNull();
  });

  test('replacing the recipe of a slot makes the list stale', async () => {
    const { listId, slots } = await setup();

    await patchSlot(slots[1], { recipe_id: recipes[2], estado: 'sustituida' });

    expect(await stale(listId)).not.toBeNull();
  });

  test('setting an ingredient substitution makes the list stale', async () => {
    const { listId, slots } = await setup();

    await patchSlot(slots[0], { sustitucion_ingrediente: { original: 'nata', sustituto: 'leche' } });

    expect(await stale(listId)).not.toBeNull();
  });

  test('adding a slot to the week makes the list stale', async () => {
    const added = await setup();
    await rest('meal_plan_recipes', {
      method: 'POST',
      serviceRole: true,
      prefer: 'return=minimal',
      body: { meal_plan_id: added.plan.id, recipe_id: recipes[3], dia: 'viernes', tipo_plato: 'desayuno' },
    });
    expect(await stale(added.listId)).not.toBeNull();
  });

  test('a second change keeps the moment of the first', async () => {
    const { listId, slots } = await setup();

    await patchSlot(slots[0], { estado: 'descartada' });
    const first = await stale(listId);
    await patchSlot(slots[1], { estado: 'descartada' });

    expect(await stale(listId)).toBe(first);
  });

  test('a plan without a list is not an error', async () => {
    const plan = await seedMealPlan(owner, { semanaIso: '2099-W52', fechaInicio: '2099-12-28' });
    const [slot] = await seedSlots(owner, plan.id, [{ recipeId: recipes[0], tipoPlato: 'comida' }]);

    expect((await patchSlot(slot, { estado: 'descartada' })).status).toBeLessThan(300);
  });

  test('the owner clears the flag; another user can neither read nor clear it', async () => {
    const { listId, slots } = await setup();
    await patchSlot(slots[0], { estado: 'descartada' });

    expect(await stale(listId, stranger)).toBeUndefined();
    await rest('shopping_lists', { method: 'PATCH', token: stranger.token, query: `id=eq.${listId}`, body: { desactualizada_desde: null } });
    expect(await stale(listId)).not.toBeNull();

    const clear = await rest('shopping_lists', { method: 'PATCH', token: owner.token, query: `id=eq.${listId}`, body: { desactualizada_desde: null } });
    expect(clear.status).toBeLessThan(300);
    expect(await stale(listId)).toBeNull();
  });
});
