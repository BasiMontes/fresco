/**
 * FRESCO-878 — `assign_recipe_to_slot` (SECURITY INVOKER, no identity
 * parameter). Proves, against the real database: the owner can put an allowed
 * recipe into an open slot, and every other path is refused with the same
 * `P0001`: a slot that is not theirs, a missing slot, another `tipo_plato`, a
 * recipe the profile filters out, a slot already cooked or excluded, a day
 * already behind us, and an anonymous caller.
 *
 * Runs only when `RUN_DB_INTEGRATION=1` AND the local Supabase stack answers —
 * `bun run test:db`. A bare `bun test` skips the whole file (see
 * `tests/db/README.md`).
 */

import type { DbTestUser } from './harness';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { createDbTestContext, rest, rpc, seedMealPlan, seedSlots, stackReachable } from './harness';

const RUN = process.env.RUN_DB_INTEGRATION === '1';
const reachable = RUN ? await stackReachable() : false;

interface AllowedRecipe {
  id: string
  alergenos: string[] | null
  clasificacion: { tipo_plato?: string } | null
}

interface SlotRow {
  recipe_id: string | null
  estado: string
  sustitucion_ingrediente: unknown
}

async function allowedRecipes(user: DbTestUser): Promise<AllowedRecipe[]> {
  const res = await rpc('get_filtered_recipes', { p_user_id: user.id }, { token: user.token });
  if (res.status !== 200 || !Array.isArray(res.body)) {
    throw new Error(`[test] get_filtered_recipes failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body as AllowedRecipe[];
}

function pick(recipes: AllowedRecipe[], tipo: string, skip: string[] = []): AllowedRecipe {
  const found = recipes.find(r => r.clasificacion?.tipo_plato === tipo && !skip.includes(r.id));
  if (!found) { throw new Error(`[test] no allowed catalog recipe of tipo_plato ${tipo}`); }
  return found;
}

async function readSlot(user: DbTestUser, slotId: string): Promise<SlotRow> {
  const res = await rest('meal_plan_recipes', {
    token: user.token,
    query: `id=eq.${slotId}&select=recipe_id,estado,sustitucion_ingrediente`,
  });
  return (res.body as SlotRow[])[0];
}

function errorCode(body: unknown): string | undefined {
  return (body as { code?: string }).code;
}

function errorMessage(body: unknown): string | undefined {
  return (body as { message?: string }).message;
}

describe.skipIf(!(RUN && reachable))('assign_recipe_to_slot (real DB)', () => {
  const ctx = createDbTestContext();
  let owner: DbTestUser;
  let intruder: DbTestUser;
  let comida: AllowedRecipe;
  let otraComida: AllowedRecipe;
  let cena: AllowedRecipe;

  beforeAll(async () => {
    [owner, intruder] = await Promise.all([ctx.createUser(), ctx.createUser()]);
    const recipes = await allowedRecipes(owner);
    comida = pick(recipes, 'comida');
    otraComida = pick(recipes, 'comida', [comida.id]);
    cena = pick(recipes, 'cena');
  });

  afterAll(async () => ctx.cleanupAll());

  test('the owner puts an allowed recipe of the same tipo_plato into their open slot', async () => {
    const plan = await seedMealPlan(owner, { semanaIso: '2099-W10', fechaInicio: '2099-03-02' });
    const [slotId] = await seedSlots(owner, plan.id, [{ recipeId: comida.id, tipoPlato: 'comida' }]);

    const res = await rpc('assign_recipe_to_slot', { p_slot_id: slotId, p_recipe_id: otraComida.id }, { token: owner.token });

    expect(res.status).toBe(204);
    const slot = await readSlot(owner, slotId);
    expect(slot.recipe_id).toBe(otraComida.id);
    expect(slot.estado).toBe('pendiente');
    expect(slot.sustitucion_ingrediente).toBeNull();
  });

  test('a different user cannot assign a recipe to someone else\'s slot: RLS scoping, nothing changes', async () => {
    const plan = await seedMealPlan(owner, { semanaIso: '2099-W11', fechaInicio: '2099-03-09' });
    const [slotId] = await seedSlots(owner, plan.id, [{ recipeId: comida.id, tipoPlato: 'comida' }]);

    const res = await rpc('assign_recipe_to_slot', { p_slot_id: slotId, p_recipe_id: otraComida.id }, { token: intruder.token });

    expect(res.status).toBe(400);
    expect(errorCode(res.body)).toBe('P0001');
    expect(errorMessage(res.body)).toContain('slot not found');
    expect((await readSlot(owner, slotId)).recipe_id).toBe(comida.id);
  });

  test('a foreign slot and a missing slot raise the same error, so existence is not disclosed', async () => {
    const plan = await seedMealPlan(owner, { semanaIso: '2099-W12', fechaInicio: '2099-03-16' });
    const [slotId] = await seedSlots(owner, plan.id, [{ recipeId: comida.id, tipoPlato: 'comida' }]);

    const foreign = await rpc('assign_recipe_to_slot', { p_slot_id: slotId, p_recipe_id: otraComida.id }, { token: intruder.token });
    const missing = await rpc(
      'assign_recipe_to_slot',
      { p_slot_id: '00000000-0000-4000-8000-000000000000', p_recipe_id: otraComida.id },
      { token: intruder.token },
    );

    expect(errorCode(foreign.body)).toBe('P0001');
    expect(errorMessage(foreign.body)).toBe(errorMessage(missing.body));
  });

  test('a recipe of another tipo_plato is refused', async () => {
    const plan = await seedMealPlan(owner, { semanaIso: '2099-W13', fechaInicio: '2099-03-23' });
    const [slotId] = await seedSlots(owner, plan.id, [{ recipeId: comida.id, tipoPlato: 'comida' }]);

    const res = await rpc('assign_recipe_to_slot', { p_slot_id: slotId, p_recipe_id: cena.id }, { token: owner.token });

    expect(res.status).toBe(400);
    expect(errorCode(res.body)).toBe('P0001');
    expect(errorMessage(res.body)).toContain('does not match');
    expect((await readSlot(owner, slotId)).recipe_id).toBe(comida.id);
  });

  test('a recipe the profile filters out (declared allergen) is refused in the server', async () => {
    const recipes = await allowedRecipes(owner);
    const withAllergen = recipes.find(r => r.clasificacion?.tipo_plato === 'comida' && (r.alergenos?.length ?? 0) > 0);
    if (!withAllergen?.alergenos) { throw new Error('[test] no allowed comida recipe declares an allergen'); }

    const allergic = await ctx.createUser();
    await rest('user_profiles', {
      method: 'PATCH',
      token: allergic.token,
      query: `id=eq.${allergic.id}`,
      prefer: 'return=minimal',
      body: { alergenos: [withAllergen.alergenos[0]] },
    });
    const safe = pick(
      (await allowedRecipes(allergic)).filter(r => r.id !== withAllergen.id),
      'comida',
    );
    const plan = await seedMealPlan(allergic, { semanaIso: '2099-W14', fechaInicio: '2099-03-30' });
    const [slotId] = await seedSlots(allergic, plan.id, [{ recipeId: safe.id, tipoPlato: 'comida' }]);

    const res = await rpc('assign_recipe_to_slot', { p_slot_id: slotId, p_recipe_id: withAllergen.id }, { token: allergic.token });

    expect(res.status).toBe(400);
    expect(errorCode(res.body)).toBe('P0001');
    expect(errorMessage(res.body)).toContain('not available for this profile');
    expect((await readSlot(allergic, slotId)).recipe_id).toBe(safe.id);
  });

  const closedSlots = [
    { estado: 'cocinada', semanaIso: '2099-W20', fechaInicio: '2099-05-11' },
    { estado: 'descartada', semanaIso: '2099-W21', fechaInicio: '2099-05-18' },
    { estado: 'excluida', semanaIso: '2099-W22', fechaInicio: '2099-05-25' },
  ];

  test.each(closedSlots)('a slot already $estado is not open', async ({ estado, semanaIso, fechaInicio }) => {
    const plan = await seedMealPlan(owner, { semanaIso, fechaInicio });
    const [slotId] = await seedSlots(owner, plan.id, [{ recipeId: comida.id, tipoPlato: 'comida', estado }]);

    const res = await rpc('assign_recipe_to_slot', { p_slot_id: slotId, p_recipe_id: otraComida.id }, { token: owner.token });

    expect(res.status).toBe(400);
    expect(errorCode(res.body)).toBe('P0001');
    expect(errorMessage(res.body)).toContain('is not open');
    expect((await readSlot(owner, slotId)).recipe_id).toBe(comida.id);
  });

  test('a slot of a day already behind us is refused: history is not rewritten', async () => {
    const plan = await seedMealPlan(owner, { semanaIso: '2020-W02', fechaInicio: '2020-01-06' });
    const [slotId] = await seedSlots(owner, plan.id, [{ recipeId: comida.id, tipoPlato: 'comida' }]);

    const res = await rpc('assign_recipe_to_slot', { p_slot_id: slotId, p_recipe_id: otraComida.id }, { token: owner.token });

    expect(res.status).toBe(400);
    expect(errorCode(res.body)).toBe('P0001');
    expect(errorMessage(res.body)).toContain('past day');
    expect((await readSlot(owner, slotId)).recipe_id).toBe(comida.id);
  });

  test('an anonymous caller (no session) cannot execute it', async () => {
    const plan = await seedMealPlan(owner, { semanaIso: '2099-W15', fechaInicio: '2099-04-06' });
    const [slotId] = await seedSlots(owner, plan.id, [{ recipeId: comida.id, tipoPlato: 'comida' }]);

    const res = await rpc('assign_recipe_to_slot', { p_slot_id: slotId, p_recipe_id: otraComida.id });

    expect([401, 403]).toContain(res.status);
    expect((await readSlot(owner, slotId)).recipe_id).toBe(comida.id);
  });
});
