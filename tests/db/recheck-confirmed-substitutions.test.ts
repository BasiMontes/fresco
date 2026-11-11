/**
 * FRESCO-1154 (revisión integral, hallazgo FS-3) — a confirmed ingredient substitution was checked
 * against the profile once, when it was confirmed, and used for ever after.
 *
 * Two ways it went stale, both found in the review: (a) the person confirms gambas -> tofu firme (tagged
 * soy) and later declares soy; (b) a guest confirms it and the guest data moves to an account that
 * declares soy (the recipe passes the account's filter, so the slot survives). In both the shopping list
 * kept buying the tofu and the recipe sheet kept showing it as the active substitute.
 *
 * Fix: the substitution is re-checked with the SAME rule that let it be confirmed
 * (`get_safe_ingredient_substitutes`: allergen overlap, disliked ingredient, diet flags) at every write
 * that can make it unsafe, and cleared with one warning per plan when it no longer passes. The dish stays:
 * only the swap goes. Proven against the real database with real sessions:
 *   1. declaring soy after confirming a tofu substitution clears it, keeps the dish, warns, marks the
 *      shopping list stale;
 *   2. a change that does not touch the substitute leaves it alone, and so does another user's slot;
 *   3. reassigning guest data clears a substitution that breaks the target account's profile;
 *   4. re-tagging a catalogue substitute clears it for the people who confirmed it and whose profile now
 *      rules it out.
 *
 * Runs only when `RUN_DB_INTEGRATION=1` AND the local Supabase stack answers — `bun run test:db`.
 */

import type { DbTestUser } from './harness';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { createDbTestContext, farWeek, plannedWeek, rest, rpc, seedMealPlan, seedShoppingList, seedSlots, stackReachable } from './harness';

const RUN = process.env.RUN_DB_INTEGRATION === '1';
const reachable = RUN ? await stackReachable() : false;

interface Substitution { original: string, sustituto: string }

const AVISO = 'la sustitución de ingrediente';

async function recipeWith(user: DbTestUser, ingrediente: string): Promise<string> {
  const res = await rest('recipes', {
    token: user.token,
    query: `select=id&activo=eq.true&ingredientes_principales=cs.["${ingrediente}"]&alergenos=not.cs.["soja"]&order=id.asc&limit=1`,
  });
  const row = (res.body as { id: string }[])[0];
  if (!row) { throw new Error(`[test] no active catalogue recipe with ${ingrediente} and no soy`); }
  return row.id;
}

async function patchProfile(user: DbTestUser, body: Record<string, unknown>): Promise<void> {
  const res = await rest('user_profiles', { method: 'PATCH', token: user.token, query: `id=eq.${user.id}`, prefer: 'return=minimal', body });
  expect(res.status).toBe(204);
}

async function confirm(user: DbTestUser, slotId: string, original: string, sustituto: string): Promise<void> {
  const res = await rpc('confirm_ingredient_substitution', {
    p_slot_id: slotId,
    p_ingrediente_original: original,
    p_ingrediente_sustituto: sustituto,
  }, { token: user.token });
  expect(res.status).toBeLessThan(300);
}

async function slotOf(slotId: string): Promise<{ recipe_id: string | null, estado: string, sustitucion_ingrediente: Substitution | null }> {
  const res = await rest('meal_plan_recipes', {
    serviceRole: true,
    query: `id=eq.${slotId}&select=recipe_id,estado,sustitucion_ingrediente`,
  });
  return (res.body as { recipe_id: string | null, estado: string, sustitucion_ingrediente: Substitution | null }[])[0];
}

async function advertenciasOf(planId: string): Promise<string[]> {
  const res = await rest('meal_plans', { serviceRole: true, query: `id=eq.${planId}&select=advertencias` });
  return (res.body as { advertencias: string[] }[])[0].advertencias;
}

async function staleSince(planId: string): Promise<string | null> {
  const res = await rest('shopping_lists', { serviceRole: true, query: `meal_plan_id=eq.${planId}&select=desactualizada_desde` });
  return (res.body as { desactualizada_desde: string | null }[])[0].desactualizada_desde;
}

describe.skipIf(!(RUN && reachable))('a confirmed substitution is re-checked against the profile (real DB)', () => {
  const ctx = createDbTestContext();
  let gambasRecipe: string;
  let lecheRecipe: string;

  beforeAll(async () => {
    const probe = await ctx.createUser({ healthDataConsent: true });
    gambasRecipe = await recipeWith(probe, 'gambas');
    lecheRecipe = await recipeWith(probe, 'leche');
  });

  afterAll(async () => ctx.cleanupAll());

  test('declaring soy after confirming the tofu substitution clears it, keeps the dish, warns and marks the list stale', async () => {
    const user = await ctx.createUser({ healthDataConsent: true });
    const other = await ctx.createUser({ healthDataConsent: true });
    const plan = await seedMealPlan(user, plannedWeek(0));
    const otherPlan = await seedMealPlan(other, plannedWeek(0));
    const [slotId] = await seedSlots(user, plan.id, [{ recipeId: gambasRecipe, tipoPlato: 'comida' }]);
    const [otherSlotId] = await seedSlots(other, otherPlan.id, [{ recipeId: gambasRecipe, tipoPlato: 'comida' }]);
    await confirm(user, slotId, 'gambas', 'tofu firme');
    await confirm(other, otherSlotId, 'gambas', 'tofu firme');
    await seedShoppingList(user, plan.id);
    expect((await slotOf(slotId)).sustitucion_ingrediente).toEqual({ original: 'gambas', sustituto: 'tofu firme' });

    await patchProfile(user, { alergenos: ['soja'] });

    const slot = await slotOf(slotId);
    expect(slot.sustitucion_ingrediente).toBeNull();
    expect(slot.recipe_id).toBe(gambasRecipe);
    expect(slot.estado).not.toBe('excluida');
    expect((await advertenciasOf(plan.id)).filter(a => a.includes(AVISO))).toHaveLength(1);
    expect(await staleSince(plan.id)).not.toBeNull();

    // Another person's identical substitution, with a profile that allows it, is not touched.
    expect((await slotOf(otherSlotId)).sustitucion_ingrediente).toEqual({ original: 'gambas', sustituto: 'tofu firme' });
    expect(await advertenciasOf(otherPlan.id)).toEqual([]);
  });

  test('a change that does not touch the substitute leaves it alone and writes no warning', async () => {
    const user = await ctx.createUser({ healthDataConsent: true });
    const plan = await seedMealPlan(user, plannedWeek(0));
    const [slotId] = await seedSlots(user, plan.id, [{ recipeId: gambasRecipe, tipoPlato: 'comida' }]);
    await confirm(user, slotId, 'gambas', 'tofu firme');

    await patchProfile(user, { alergenos: ['cacahuetes'] });

    expect((await slotOf(slotId)).sustitucion_ingrediente).toEqual({ original: 'gambas', sustituto: 'tofu firme' });
    expect((await advertenciasOf(plan.id)).filter(a => a.includes(AVISO))).toHaveLength(0);
  });

  test('reassigning guest data clears a substitution that breaks the target account profile, and keeps the dish', async () => {
    const guest = await ctx.createUser();
    const target = await ctx.createUser({ healthDataConsent: true });
    await patchProfile(target, { alergenos: ['soja'] });
    const plan = await seedMealPlan(guest, farWeek(11));
    const [slotId] = await seedSlots(guest, plan.id, [{ recipeId: gambasRecipe, tipoPlato: 'comida' }]);
    // The guest confirmed it while its own profile allowed it; seeded through the service role like the other fixtures.
    const seeded = await rest('meal_plan_recipes', {
      method: 'PATCH',
      serviceRole: true,
      query: `id=eq.${slotId}`,
      prefer: 'return=minimal',
      body: { sustitucion_ingrediente: { original: 'gambas', sustituto: 'tofu firme' } },
    });
    expect(seeded.status).toBe(204);

    const res = await rpc('reassign_guest_data', { p_from_user_id: guest.id, p_to_user_id: target.id }, { serviceRole: true });
    expect(res.status).toBeLessThan(300);

    const slot = await slotOf(slotId);
    expect(slot.sustitucion_ingrediente).toBeNull();
    expect(slot.recipe_id).toBe(gambasRecipe);
    expect((await advertenciasOf(plan.id)).filter(a => a.includes(AVISO))).toHaveLength(1);
  });

  test('re-tagging a catalogue substitute clears it for the people whose profile now rules it out', async () => {
    const user = await ctx.createUser({ healthDataConsent: true });
    await patchProfile(user, { alergenos: ['soja'] });
    const plan = await seedMealPlan(user, plannedWeek(1));
    const [slotId] = await seedSlots(user, plan.id, [{ recipeId: lecheRecipe, tipoPlato: 'comida' }]);
    await confirm(user, slotId, 'leche', 'leche de coco');
    expect((await slotOf(slotId)).sustitucion_ingrediente).toEqual({ original: 'leche', sustituto: 'leche de coco' });

    const pair = 'ingrediente_original=eq.leche&ingrediente_sustituto=eq.leche de coco';
    try {
      const retag = await rest('ingredient_substitutions', {
        method: 'PATCH',
        serviceRole: true,
        query: pair,
        prefer: 'return=minimal',
        body: { alergenos: ['soja'] },
      });
      expect(retag.status).toBe(204);
      expect((await slotOf(slotId)).sustitucion_ingrediente).toBeNull();
      expect((await slotOf(slotId)).recipe_id).toBe(lecheRecipe);
    }
    finally {
      await rest('ingredient_substitutions', { method: 'PATCH', serviceRole: true, query: pair, prefer: 'return=minimal', body: { alergenos: [] } });
    }
  });
});
