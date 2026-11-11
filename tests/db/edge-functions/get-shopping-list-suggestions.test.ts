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

import type { DbTestUser } from '../harness';
import { afterAll, describe, expect, test } from 'bun:test';
import { callFunction, createDbTestContext, farWeek, rest, rpc, seedMealPlan, seedShoppingList, stackReachable } from '../harness';

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

// FRESCO-1153 — the carousel proposes ingredients only from favourites that pass today's profile.
describe.skipIf(!(RUN && reachable))('get-shopping-list-suggestions — food safety (real functions runtime)', () => {
  const ctx = createDbTestContext();

  afterAll(async () => ctx.cleanupAll());

  async function pick(user: DbTestUser, filter: string): Promise<{ id: string, ingredientes: string[] }> {
    const res = await rest('recipes', { token: user.token, query: `select=id,ingredientes_principales&${filter}&order=id.asc&limit=1` });
    const row = (res.body as { id: string, ingredientes_principales: string[] }[])[0];
    if (!row) { throw new Error(`[test] no catalogue recipe for ${filter}`); }
    return { id: row.id, ingredientes: row.ingredientes_principales.map(i => i.toLowerCase()) };
  }

  async function favorite(user: DbTestUser, recipeId: string): Promise<void> {
    const res = await rest('favorites', { method: 'POST', token: user.token, prefer: 'return=minimal', body: { user_id: user.id, recipe_id: recipeId } });
    expect(res.status).toBe(201);
  }

  const listOf = new Map<string, string>();

  async function suggestionsFor(user: DbTestUser): Promise<string[]> {
    if (!listOf.has(user.id)) {
      const plan = await seedMealPlan(user, farWeek(20));
      listOf.set(user.id, await seedShoppingList(user, plan.id, []));
    }
    const listId = listOf.get(user.id)!;
    const res = await callFunction(ENDPOINT, { token: user.token, body: { shopping_list_id: listId } });
    expect(res.status).toBe(200);
    return ((res.body as { suggestions: { nombre: string }[] }).suggestions).map(s => s.nombre.toLowerCase());
  }

  async function declareEgg(user: DbTestUser): Promise<void> {
    const declared = await rest('user_profiles', { method: 'PATCH', token: user.token, query: `id=eq.${user.id}`, prefer: 'return=minimal', body: { alergenos: ['huevo'] } });
    expect(declared.status).toBe(204);
  }

  test('a favourite marked before declaring its allergen suggests nothing (the finding)', async () => {
    const user = await ctx.createUser({ healthDataConsent: true });
    const withEgg = await pick(user, 'activo=eq.true&alergenos=cs.["huevo"]');
    await favorite(user, withEgg.id);
    // Before the allergen is declared the favourite is fair game: this is what the carousel used to do for ever.
    expect((await suggestionsFor(user)).length).toBeGreaterThan(0);
    await declareEgg(user);

    expect(await suggestionsFor(user)).toEqual([]);
  });

  test('a favourite whose recipe has since been retired suggests nothing', async () => {
    const user = await ctx.createUser({ healthDataConsent: true });
    const recipe = await pick(user, 'activo=eq.true&alergenos=not.cs.["huevo"]');
    await favorite(user, recipe.id);
    expect((await suggestionsFor(user)).length).toBeGreaterThan(0);

    const retire = async (activo: boolean) => rest('recipes', { method: 'PATCH', serviceRole: true, query: `id=eq.${recipe.id}`, prefer: 'return=minimal', body: { activo } });
    try {
      expect((await retire(false)).status).toBe(204);
      expect(await suggestionsFor(user)).toEqual([]);
    }
    finally {
      await retire(true);
    }
  });

  test('control: a safe favourite still suggests its own ingredients, and only those', async () => {
    const user = await ctx.createUser({ healthDataConsent: true });
    const safe = await pick(user, 'activo=eq.true&alergenos=not.cs.["huevo"]');
    await favorite(user, safe.id);
    await declareEgg(user);

    const suggested = await suggestionsFor(user);

    expect(suggested.length).toBeGreaterThan(0);
    expect(suggested.every(name => safe.ingredientes.includes(name))).toBe(true);
  });
});
