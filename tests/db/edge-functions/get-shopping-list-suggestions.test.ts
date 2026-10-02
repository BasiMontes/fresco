/**
 * FRESCO-782 (audit-6 A6-T2) — HTTP negative-contract tests for
 * get-shopping-list-suggestions.
 *
 * Real HTTP against the local Supabase Edge Functions runtime, not mocked.
 * Covers the auth gate, body validation and list ownership: a user must not be
 * able to read suggestions derived from somebody else's shopping list.
 *
 * Runs only when `RUN_DB_INTEGRATION=1` AND the local stack answers —
 * `bun run test:db`. See tests/db/README.md.
 */

import { afterAll, describe, expect, test } from 'bun:test';
import { callFunction, createDbTestContext, seedMealPlan, seedShoppingList, stackReachable } from '../harness';

const RUN = process.env.RUN_DB_INTEGRATION === '1';
const reachable = RUN ? await stackReachable() : false;

const ENDPOINT = 'get-shopping-list-suggestions';

describe.skipIf(!(RUN && reachable))('get-shopping-list-suggestions — HTTP negative contract (real functions runtime)', () => {
  const ctx = createDbTestContext();

  afterAll(async () => ctx.cleanupAll());

  test('401 when called with no token', async () => {
    const res = await callFunction(ENDPOINT, { body: { shopping_list_id: crypto.randomUUID() } });
    expect(res.status).toBe(401);
  });

  test('401 when called with a garbage token', async () => {
    const res = await callFunction(ENDPOINT, { token: 'not-a-real-jwt', body: { shopping_list_id: crypto.randomUUID() } });
    expect(res.status).toBe(401);
  });

  test('400 when shopping_list_id is missing', async () => {
    const user = await ctx.createUser();
    const res = await callFunction(ENDPOINT, { token: user.token, body: {} });
    expect(res.status).toBe(400);
  });

  test('404 for a list id that does not exist', async () => {
    const user = await ctx.createUser();
    const res = await callFunction(ENDPOINT, { token: user.token, body: { shopping_list_id: crypto.randomUUID() } });
    expect(res.status).toBe(404);
  });

  test('404 for a list owned by another user — no cross-user read', async () => {
    const owner = await ctx.createUser();
    const intruder = await ctx.createUser();
    const plan = await seedMealPlan(owner);
    const listId = await seedShoppingList(owner, plan.id);

    const res = await callFunction(ENDPOINT, { token: intruder.token, body: { shopping_list_id: listId } });

    expect(res.status).toBe(404);
  });
});
