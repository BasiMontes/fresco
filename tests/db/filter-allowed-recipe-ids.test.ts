/**
 * FRESCO-1153 (revisión integral, hallazgo FS-2) — a favourite is a recipe the person marked at some
 * point, possibly before declaring an allergen, and possibly a recipe since retired. The "Sugerencias para
 * ti" carousel and `/favorites` read favourites straight from `recipes`, so they proposed ingredients of,
 * and listed, recipes the profile rules out.
 *
 * `filter_allowed_recipe_ids(p_recipe_ids)` answers which of the given recipes pass the CALLER's current
 * profile, by asking `get_filtered_recipes` (the single food-safety choke point, ADR-0001) instead of
 * copying its rules. It is SECURITY INVOKER and takes no identity parameter: it reads `auth.uid()`, so it
 * cannot be told to answer for somebody else.
 *
 * Proven against the real database with real sessions:
 *   1. a recipe with a declared allergen, and an inactive recipe, are left out; a safe one is kept;
 *   2. it follows the profile as it changes, and answers per caller (another user's profile is not used);
 *   3. ids that do not exist and an empty list are harmless;
 *   4. `anon` cannot call it.
 *
 * Runs only when `RUN_DB_INTEGRATION=1` AND the local Supabase stack answers — `bun run test:db`.
 */

import type { DbTestUser } from './harness';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { createDbTestContext, rest, rpc, stackReachable } from './harness';

const RUN = process.env.RUN_DB_INTEGRATION === '1';
const reachable = RUN ? await stackReachable() : false;

async function recipeId(user: DbTestUser, filter: string): Promise<string> {
  const res = await rest('recipes', { token: user.token, query: `select=id&${filter}&order=id.asc&limit=1` });
  const row = (res.body as { id: string }[])[0];
  if (!row) { throw new Error(`[test] no catalogue recipe for ${filter}`); }
  return row.id;
}

async function allowed(user: DbTestUser, ids: string[]): Promise<string[]> {
  const res = await rpc('filter_allowed_recipe_ids', { p_recipe_ids: ids }, { token: user.token });
  expect(res.status).toBe(200);
  return (res.body as string[]).slice().sort();
}

describe.skipIf(!(RUN && reachable))('filter_allowed_recipe_ids answers per caller and per current profile (real DB)', () => {
  const ctx = createDbTestContext();
  let eggId: string;
  let safeId: string;
  let inactiveId: string;
  let all: string[];

  beforeAll(async () => {
    const probe = await ctx.createUser({ healthDataConsent: true });
    eggId = await recipeId(probe, 'activo=eq.true&alergenos=cs.["huevo"]');
    safeId = await recipeId(probe, 'activo=eq.true&alergenos=not.cs.["huevo"]');
    inactiveId = await recipeId(probe, 'activo=eq.false');
    all = [eggId, safeId, inactiveId];
  });

  afterAll(async () => ctx.cleanupAll());

  test('an inactive recipe is never allowed; the others follow the profile as it changes', async () => {
    const user = await ctx.createUser({ healthDataConsent: true });

    expect(await allowed(user, all)).toEqual([eggId, safeId].sort());

    const declared = await rest('user_profiles', { method: 'PATCH', token: user.token, query: `id=eq.${user.id}`, prefer: 'return=minimal', body: { alergenos: ['huevo'] } });
    expect(declared.status).toBe(204);

    expect(await allowed(user, all)).toEqual([safeId]);
  });

  test('it answers for the caller only: another profile is not used', async () => {
    const withEgg = await ctx.createUser({ healthDataConsent: true });
    const without = await ctx.createUser({ healthDataConsent: true });
    await rest('user_profiles', { method: 'PATCH', token: withEgg.token, query: `id=eq.${withEgg.id}`, prefer: 'return=minimal', body: { alergenos: ['huevo'] } });

    expect(await allowed(withEgg, [eggId, safeId])).toEqual([safeId]);
    expect(await allowed(without, [eggId, safeId])).toEqual([eggId, safeId].sort());
  });

  test('an empty list and ids that do not exist are harmless', async () => {
    const user = await ctx.createUser({ healthDataConsent: true });

    expect(await allowed(user, [])).toEqual([]);
    expect(await allowed(user, [crypto.randomUUID(), safeId])).toEqual([safeId]);
  });

  test('anon cannot call it', async () => {
    const res = await rpc('filter_allowed_recipe_ids', { p_recipe_ids: [safeId] }, {});

    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});
