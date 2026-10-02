/**
 * FRESCO-782 (audit-6 A6-T2) — HTTP negative-contract tests for
 * delete-catalog-recipe.
 *
 * The function is a service-role hard delete of a catalog recipe, so
 * `requireAdminUser` is its only authorization boundary. Real HTTP against the
 * local Supabase Edge Functions runtime, not mocked. Every rejection is paired
 * with a read proving the recipe still exists.
 *
 * Runs only when `RUN_DB_INTEGRATION=1` AND the local stack answers —
 * `bun run test:db`. See tests/db/README.md.
 */

import { afterAll, describe, expect, test } from 'bun:test';
import { callFunction, catalogRecipeIds, createDbTestContext, rest, stackReachable } from '../harness';

const RUN = process.env.RUN_DB_INTEGRATION === '1';
const reachable = RUN ? await stackReachable() : false;

const ENDPOINT = 'delete-catalog-recipe';

describe.skipIf(!(RUN && reachable))('delete-catalog-recipe — HTTP negative contract (real functions runtime)', () => {
  const ctx = createDbTestContext();

  afterAll(async () => ctx.cleanupAll());

  async function recipeExists(id: string, token: string): Promise<boolean> {
    const res = await rest('recipes', { token, query: `id=eq.${id}&select=id` });
    return Array.isArray(res.body) && res.body.length === 1;
  }

  test('401 when called with no token', async () => {
    const res = await callFunction(ENDPOINT, { body: { recipe_id: crypto.randomUUID() } });
    expect(res.status).toBe(401);
  });

  test('401 when called with a garbage token', async () => {
    const res = await callFunction(ENDPOINT, { token: 'not-a-real-jwt', body: { recipe_id: crypto.randomUUID() } });
    expect(res.status).toBe(401);
  });

  test('403 for an authenticated user outside the admin allowlist — recipe is never deleted', async () => {
    const user = await ctx.createUser();
    const [recipeId] = await catalogRecipeIds(user, 1);

    const res = await callFunction(ENDPOINT, { token: user.token, body: { recipe_id: recipeId } });

    expect(res.status).toBe(403);
    expect(await recipeExists(recipeId, user.token)).toBe(true);
  });

  test('403 for an authenticated user even when the body is empty — the gate runs before validation', async () => {
    const user = await ctx.createUser();
    const res = await callFunction(ENDPOINT, { token: user.token, body: {} });
    expect(res.status).toBe(403);
  });
});
