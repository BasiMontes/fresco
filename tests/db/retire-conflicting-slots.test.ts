/**
 * FRESCO-1151 (revisión integral, hallazgo FS-1) — a menu already generated is re-checked when the
 * profile or the catalogue changes.
 *
 * Before, saving an allergen or a diet only wrote `user_profiles`, and re-tagging a recipe in the
 * catalogue only wrote `recipes`: the slots already generated kept the now forbidden dish, with no
 * warning. Owner decision (2026-11-11): the dish is taken out by itself and the person is told.
 *
 * Proven against the real database with real sessions:
 *   1. declaring an allergen empties the conflicting slots of this week and the next ones
 *      (`recipe_id` null, left open as `pendiente`, FRESCO-1157), leaves a safe slot, a cooked slot and every past week
 *      alone, writes one `advertencias` entry per affected plan and marks the shopping list stale;
 *   2. the same for a diet flag and for a disliked ingredient;
 *   3. re-tagging or retiring a catalogue recipe does the same for the users who have it planned;
 *   4. another user's slots are never touched;
 *   5. a change that conflicts with nothing writes no warning;
 *   6. the function behind it cannot be called by a client.
 *
 * Runs only when `RUN_DB_INTEGRATION=1` AND the local Supabase stack answers — `bun run test:db`.
 */

import type { DbTestUser } from './harness';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { createDbTestContext, plannedWeek, rest, rpc, seedMealPlan, seedShoppingList, seedSlots, stackReachable } from './harness';

const RUN = process.env.RUN_DB_INTEGRATION === '1';
const reachable = RUN ? await stackReachable() : false;

interface SlotRow {
  dia: string
  tipo_plato: string
  recipe_id: string | null
  estado: string
}

const AVISO = 'con tu perfil';

async function recipeId(user: DbTestUser, filter: string): Promise<string> {
  const res = await rest('recipes', { token: user.token, query: `select=id&activo=eq.true&${filter}&order=id.asc&limit=1` });
  const row = (res.body as { id: string }[])[0];
  if (!row) { throw new Error(`[test] no catalogue recipe for ${filter}`); }
  return row.id;
}

async function patchProfile(user: DbTestUser, body: Record<string, unknown>): Promise<void> {
  const res = await rest('user_profiles', {
    method: 'PATCH',
    token: user.token,
    query: `id=eq.${user.id}`,
    prefer: 'return=minimal',
    body,
  });
  expect(res.status).toBe(204);
}

async function slotsOf(user: DbTestUser, planId: string): Promise<SlotRow[]> {
  const res = await rest('meal_plan_recipes', {
    token: user.token,
    query: `meal_plan_id=eq.${planId}&select=dia,tipo_plato,recipe_id,estado&order=dia.asc`,
  });
  return res.body as SlotRow[];
}

async function advertenciasOf(user: DbTestUser, planId: string): Promise<string[]> {
  const res = await rest('meal_plans', { token: user.token, query: `id=eq.${planId}&select=advertencias` });
  return (res.body as { advertencias: string[] }[])[0].advertencias;
}

async function staleSince(user: DbTestUser, planId: string): Promise<string | null> {
  const res = await rest('shopping_lists', { token: user.token, query: `meal_plan_id=eq.${planId}&select=desactualizada_desde` });
  return (res.body as { desactualizada_desde: string | null }[])[0].desactualizada_desde;
}

describe.skipIf(!(RUN && reachable))('a generated menu is re-checked when the profile or the catalogue changes (real DB)', () => {
  const ctx = createDbTestContext();
  let glutenId: string;
  let safeId: string;

  beforeAll(async () => {
    const probe = await ctx.createUser({ healthDataConsent: true });
    glutenId = await recipeId(probe, 'alergenos=cs.["gluten"]');
    safeId = await recipeId(probe, 'alergenos=not.cs.["gluten"]&dieta->>sin_gluten=eq.true');
  });

  afterAll(async () => ctx.cleanupAll());

  test('declaring an allergen retires the conflicting slots of this week and the next ones, and only those', async () => {
    const owner = await ctx.createUser({ healthDataConsent: true });
    const other = await ctx.createUser({ healthDataConsent: true });

    const week = plannedWeek(0);
    const next = plannedWeek(1);
    const past = plannedWeek(-3);
    const plans = {
      week: await seedMealPlan(owner, week),
      next: await seedMealPlan(owner, next),
      past: await seedMealPlan(owner, past),
      other: await seedMealPlan(other, week),
    };
    const planOf = [
      [owner, plans.week],
      [owner, plans.next],
      [owner, plans.past],
      [other, plans.other],
    ] as const;
    for (const [user, plan] of planOf) {
      await seedSlots(user, plan.id, [
        { recipeId: glutenId, tipoPlato: 'comida' },
        { recipeId: safeId, tipoPlato: 'cena' },
        { recipeId: glutenId, tipoPlato: 'desayuno', estado: 'cocinada' },
      ]);
    }
    await seedShoppingList(owner, plans.week.id);

    await patchProfile(owner, { alergenos: ['gluten'] });

    for (const plan of [plans.week, plans.next]) {
      const slots = await slotsOf(owner, plan.id);
      const byTipo = (tipo: string) => slots.find(s => s.tipo_plato === tipo)!;
      expect(byTipo('comida')).toMatchObject({ recipe_id: null, estado: 'pendiente' });
      expect(byTipo('cena')).toMatchObject({ recipe_id: safeId, estado: 'pendiente' });
      // A slot already cooked was eaten: it stays as it was.
      expect(byTipo('desayuno')).toMatchObject({ recipe_id: glutenId, estado: 'cocinada' });
      const avisos = (await advertenciasOf(owner, plan.id)).filter(a => a.includes(AVISO));
      expect(avisos).toHaveLength(1);
    }

    // A past week is never touched.
    const pastSlots = await slotsOf(owner, plans.past.id);
    expect(pastSlots.find(s => s.tipo_plato === 'comida')).toMatchObject({ recipe_id: glutenId, estado: 'pendiente' });
    expect(await advertenciasOf(owner, plans.past.id)).toEqual([]);

    // The list built for the week no longer matches it: the app asks for an update (FRESCO-1010).
    expect(await staleSince(owner, plans.week.id)).not.toBeNull();

    // Another user's plan, with the same recipe, is not the owner's business.
    const otherSlots = await slotsOf(other, plans.other.id);
    expect(otherSlots.find(s => s.tipo_plato === 'comida')).toMatchObject({ recipe_id: glutenId, estado: 'pendiente' });
    expect(await advertenciasOf(other, plans.other.id)).toEqual([]);
  });

  // FRESCO-1157: the notice promises "rellena el hueco con otra receta", so that has to be possible.
  test('a retired slot stays open: another recipe that fits can be put into it', async () => {
    const user = await ctx.createUser({ healthDataConsent: true });
    const plan = await seedMealPlan(user, plannedWeek(1));
    const [slotId] = await seedSlots(user, plan.id, [{ recipeId: glutenId, tipoPlato: 'comida' }]);
    await patchProfile(user, { alergenos: ['gluten'] });
    expect((await slotsOf(user, plan.id))[0]).toMatchObject({ recipe_id: null, estado: 'pendiente' });

    const allowed = await rpc('get_filtered_recipes', { p_user_id: user.id }, { token: user.token });
    const fits = (allowed.body as { id: string, clasificacion: { tipo_plato?: string } | null }[]).find(r => r.clasificacion?.tipo_plato === 'comida');
    if (!fits) { throw new Error('[test] no allowed comida recipe'); }
    const filled = await rpc('assign_recipe_to_slot', { p_slot_id: slotId, p_recipe_id: fits.id }, { token: user.token });

    expect(filled.status).toBeLessThan(300);
    expect((await slotsOf(user, plan.id))[0]).toMatchObject({ recipe_id: fits.id, estado: 'pendiente' });
  });

  test('a diet flag retires the recipes that break it', async () => {
    const user = await ctx.createUser({ healthDataConsent: true });
    const notGlutenFree = await recipeId(user, 'dieta->>sin_gluten=eq.false');
    const plan = await seedMealPlan(user, plannedWeek(0));
    await seedSlots(user, plan.id, [{ recipeId: notGlutenFree, tipoPlato: 'comida' }, { recipeId: safeId, tipoPlato: 'cena' }]);

    await patchProfile(user, { dieta_sin_gluten: true });

    const slots = await slotsOf(user, plan.id);
    expect(slots.find(s => s.tipo_plato === 'comida')).toMatchObject({ recipe_id: null, estado: 'pendiente' });
    expect(slots.find(s => s.tipo_plato === 'cena')).toMatchObject({ recipe_id: safeId, estado: 'pendiente' });
  });

  test('a disliked ingredient retires the recipes that use it', async () => {
    const user = await ctx.createUser({ healthDataConsent: true });
    const plan = await seedMealPlan(user, plannedWeek(1));
    const recipe = await rest('recipes', { token: user.token, query: `select=id,ingredientes_principales&id=eq.${glutenId}` });
    const ingrediente = ((recipe.body as { ingredientes_principales: string[] }[])[0].ingredientes_principales)[0];
    await seedSlots(user, plan.id, [{ recipeId: glutenId, tipoPlato: 'comida' }]);

    await patchProfile(user, { ingredientes_odiados: [ingrediente.toLowerCase()] });

    expect((await slotsOf(user, plan.id))[0]).toMatchObject({ recipe_id: null, estado: 'pendiente' });
  });

  test('re-tagging or retiring a catalogue recipe retires it from the menus that hold it', async () => {
    const user = await ctx.createUser({ healthDataConsent: true });
    await patchProfile(user, { alergenos: ['sesamo'] });
    const target = await recipeId(user, 'alergenos=not.cs.["sesamo"]&alergenos=not.cs.["gluten"]');
    const before = await rest('recipes', { serviceRole: true, query: `select=alergenos&id=eq.${target}` });
    const original = (before.body as { alergenos: string[] }[])[0].alergenos;

    const plan = await seedMealPlan(user, plannedWeek(0));
    await seedSlots(user, plan.id, [{ recipeId: target, tipoPlato: 'comida' }, { recipeId: target, tipoPlato: 'cena' }]);

    try {
      const retag = await rest('recipes', {
        method: 'PATCH',
        serviceRole: true,
        query: `id=eq.${target}`,
        prefer: 'return=minimal',
        body: { alergenos: [...original, 'sesamo'] },
      });
      expect(retag.status).toBe(204);
      const slots = await slotsOf(user, plan.id);
      expect(slots.every(s => s.recipe_id === null && s.estado === 'pendiente')).toBe(true);
      expect((await advertenciasOf(user, plan.id)).filter(a => a.includes(AVISO))).toHaveLength(1);
    }
    finally {
      await rest('recipes', { method: 'PATCH', serviceRole: true, query: `id=eq.${target}`, prefer: 'return=minimal', body: { alergenos: original } });
    }
  });

  test('a change that conflicts with nothing writes no warning and moves nothing', async () => {
    const user = await ctx.createUser({ healthDataConsent: true });
    const plan = await seedMealPlan(user, plannedWeek(0));
    await seedSlots(user, plan.id, [{ recipeId: safeId, tipoPlato: 'comida' }]);

    await patchProfile(user, { alergenos: ['gluten'] });

    expect((await slotsOf(user, plan.id))[0]).toMatchObject({ recipe_id: safeId, estado: 'pendiente' });
    expect(await advertenciasOf(user, plan.id)).toEqual([]);
  });

  test('a client cannot call the function that retires the slots', async () => {
    const attacker = await ctx.createUser({ healthDataConsent: true });
    const victim = await ctx.createUser({ healthDataConsent: true });
    const plan = await seedMealPlan(victim, plannedWeek(0));
    await seedSlots(victim, plan.id, [{ recipeId: safeId, tipoPlato: 'comida' }]);

    const res = await rpc('retire_conflicting_slots', { p_user_id: victim.id }, { token: attacker.token });

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect((await slotsOf(victim, plan.id))[0]).toMatchObject({ recipe_id: safeId, estado: 'pendiente' });
  });
});
