/**
 * FRESCO-879 — `catalogRecipeIds` must not hand out soft-deleted recipes.
 *
 * `update-recipe-status`'s "409 substitution with a recipe already placed
 * elsewhere" test failed once in CI with a 422: it takes the two lowest recipe
 * ids, and a soft-deleted row (`activo = false`, left behind by another DB test)
 * was the second one, so `get_filtered_recipes` rejected it before the duplicate
 * check could answer 409.
 *
 * This file plants an inactive recipe with the LOWEST possible id and keeps it
 * there. File names run in alphabetical order, so every later DB test (including
 * `update-recipe-status`) now runs against that worst case on every run, not on
 * the ~1 % of runs where a random id lands in the right position.
 *
 * Runs only when `RUN_DB_INTEGRATION=1` AND the local Supabase stack answers —
 * `bun run test:db`.
 */

import { afterAll, describe, expect, test } from 'bun:test';
import { catalogRecipeIds, createDbTestContext, rest, stackReachable } from './harness';

const RUN = process.env.RUN_DB_INTEGRATION === '1';
const reachable = RUN ? await stackReachable() : false;

const INACTIVE_LOWEST_ID = '00000000-0000-4000-8000-0000000000aa';

describe.skipIf(!(RUN && reachable))('catalogRecipeIds (real DB)', () => {
  const ctx = createDbTestContext();

  afterAll(async () => ctx.cleanupAll());

  test('never returns a soft-deleted recipe, even when it has the lowest id', async () => {
    const planted = await rest('recipes', {
      method: 'POST',
      serviceRole: true,
      prefer: 'resolution=ignore-duplicates,return=minimal',
      query: 'on_conflict=id',
      body: {
        id: INACTIVE_LOWEST_ID,
        nombre: 'fresco-879-inactive-canary',
        slug: 'fresco-879-inactive-canary',
        activo: false,
        ingredientes_principales: ['arroz'],
      },
    });
    expect(planted.status).toBe(201);

    const user = await ctx.createUser();
    const ids = await catalogRecipeIds(user, 2);

    expect(ids).not.toContain(INACTIVE_LOWEST_ID);
    expect(ids.length).toBeGreaterThanOrEqual(2);
  });
});
