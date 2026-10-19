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
import { callFunction, createDbTestContext, rpc, seedMealPlan, seedShoppingList, stackReachable } from '../harness';

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

  test('429 once the 120/h rate limit is pre-saturated (endpoint registered in rate_limit_endpoints)', async () => {
    const user = await ctx.createUser();
    await Promise.all(
      Array.from({ length: 120 }, async () => rpc('check_and_increment_rate_limit', {
        p_user_id: user.id,
        p_endpoint: ENDPOINT,
        p_limit: 120,
        p_window_seconds: 3600,
      }, { token: user.token })),
    );

    const res = await callFunction(ENDPOINT, { token: user.token, body: { shopping_list_id: crypto.randomUUID() } });
    expect(res.status).toBe(429);
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

  test('a malformed saved item is skipped instead of failing the request (FRESCO-1015)', async () => {
    const user = await ctx.createUser();
    const plan = await seedMealPlan(user);
    // Lists written before jsonb_add_item rejected non-objects can hold items like these.
    const listId = await seedShoppingList(user, plan.id, [
      { nombre: 'Verduras', orden: 1, items: ['Tomate', null, { comprado: true }, { nombre: 'Pimiento', comprado: false }] },
      'Roto',
      { nombre: 'Sin items', orden: 3 },
    ]);

    const res = await callFunction(ENDPOINT, { token: user.token, body: { shopping_list_id: listId } });

    expect(res.status).toBe(200);
  });
});
