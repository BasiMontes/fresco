/**
 * FRESCO-799 (audit-6 A6-S7) — client writes are bounded, proven against the real database.
 *
 * Anonymous sign-in is free, so a per-user cap only matters if it actually holds
 * in the database. Before, `recetas_propias`, `shopping_lists.items`,
 * `meal_plans.advertencias` and `favorites` had no size or row limit, and
 * `check_and_increment_rate_limit` let the caller pick any `p_endpoint` (a fresh
 * counter) and any `p_limit`.
 *
 * Pinned here:
 *   1. Length / size / cardinality CHECKs on the client-writable columns.
 *   2. Per-user row quotas: 200 `recetas_propias`, 1000 `favorites`.
 *   3. The rate limiter rejects an unregistered endpoint and clamps `p_limit` to
 *      the registered ceiling; the registry itself is invisible to clients.
 *
 * Runs only when `RUN_DB_INTEGRATION=1` AND the local Supabase stack answers —
 * `bun run test:db`. See `tests/db/README.md`.
 */

import type { DbTestUser } from './harness';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import {
  catalogRecipeIds,
  createDbTestContext,
  rest,
  rpc,
  seedMealPlan,
  seedShoppingList,
  stackReachable,
} from './harness';

const RUN = process.env.RUN_DB_INTEGRATION === '1';
const reachable = RUN ? await stackReachable() : false;

const CHECK_VIOLATION = '23514';
const PERMISSION_DENIED = '42501';

function expectCheckViolation(result: { status: number, body: unknown }, messageIncludes?: string): void {
  expect(result.status).toBe(400);
  const body = result.body as { code?: string, message?: string };
  expect(body.code).toBe(CHECK_VIOLATION);
  if (messageIncludes) {
    expect(body.message ?? '').toContain(messageIncludes);
  }
}

async function insertReceta(user: DbTestUser, body: Record<string, unknown>) {
  return rest('recetas_propias', {
    method: 'POST',
    token: user.token,
    prefer: 'return=minimal',
    body: { user_id: user.id, nombre: 'Tortilla', ingredientes: ['huevo'], pasos: ['batir'], ...body },
  });
}

describe.skipIf(!(RUN && reachable))('client write quotas and caps (real DB)', () => {
  const ctx = createDbTestContext();
  let user: DbTestUser;

  beforeAll(async () => {
    user = await ctx.createUser();
  });

  afterAll(async () => ctx.cleanupAll());

  // --- recetas_propias: size caps ------------------------------------------

  describe('recetas_propias size caps', () => {
    test('a normal recipe is accepted', async () => {
      const ok = await insertReceta(user, { nombre: 'Receta normal' });
      expect(ok.status).toBe(201);
    });

    test('nombre over 120 characters is rejected', async () => {
      expectCheckViolation(await insertReceta(user, { nombre: 'a'.repeat(121) }), 'recetas_propias_nombre_max_length');
    });

    test('more than 60 ingredients is rejected', async () => {
      const ingredientes = Array.from({ length: 61 }, (_, i) => `ing ${i}`);
      expectCheckViolation(await insertReceta(user, { ingredientes }), 'recetas_propias_ingredientes_bounds');
    });

    test('ingredients over 6000 bytes in total are rejected', async () => {
      const ingredientes = Array.from({ length: 7 }, () => 'x'.repeat(1000));
      expectCheckViolation(await insertReceta(user, { ingredientes }), 'recetas_propias_ingredientes_bounds');
    });

    test('more than 40 steps is rejected', async () => {
      const pasos = Array.from({ length: 41 }, (_, i) => `paso ${i}`);
      expectCheckViolation(await insertReceta(user, { pasos }), 'recetas_propias_pasos_bounds');
    });

    test('steps over 12000 bytes in total are rejected, even when repetitive', async () => {
      // Compresses to a few hundred bytes on disk: a pg_column_size cap would let it through.
      const pasos = Array.from({ length: 13 }, () => 'a'.repeat(1000));
      expectCheckViolation(await insertReceta(user, { pasos }), 'recetas_propias_pasos_bounds');
    });
  });

  // --- shopping_lists / meal_plans: jsonb and array caps -------------------

  describe('shopping_lists.items and meal_plans.advertencias caps', () => {
    let planId: string;
    let listId: string;

    beforeAll(async () => {
      planId = (await seedMealPlan(user)).id;
      listId = await seedShoppingList(user, planId);
    });

    test('items over 100000 bytes is rejected', async () => {
      const huge = [{ nombre: 'Verduras', orden: 1, items: [{ nombre: 'x'.repeat(100_001), comprado: false }] }];
      const res = await rest('shopping_lists', {
        method: 'PATCH',
        token: user.token,
        query: `id=eq.${listId}`,
        prefer: 'return=minimal',
        body: { items: huge },
      });
      expectCheckViolation(res, 'shopping_lists_items_bounds');
    });

    test('items must be a jsonb array', async () => {
      const res = await rest('shopping_lists', {
        method: 'PATCH',
        token: user.token,
        query: `id=eq.${listId}`,
        prefer: 'return=minimal',
        body: { items: { not: 'an array' } },
      });
      expectCheckViolation(res, 'shopping_lists_items_bounds');
    });

    test('advertencias with more than 20 entries is rejected', async () => {
      const res = await rest('meal_plans', {
        method: 'PATCH',
        token: user.token,
        query: `id=eq.${planId}`,
        prefer: 'return=minimal',
        body: { advertencias: Array.from({ length: 21 }, (_, i) => `aviso ${i}`) },
      });
      expectCheckViolation(res, 'meal_plans_advertencias_bounds');
    });

    test('a few short advertencias are accepted', async () => {
      const res = await rest('meal_plans', {
        method: 'PATCH',
        token: user.token,
        query: `id=eq.${planId}`,
        prefer: 'return=minimal',
        body: { advertencias: ['El menú supera tu presupuesto semanal'] },
      });
      expect(res.status).toBe(204);
    });
  });

  // --- row quotas -----------------------------------------------------------

  describe('per-user row quotas', () => {
    test('a user holds at most 200 recetas_propias', async () => {
      const quotaUser = await ctx.createUser();
      // Four batches: the quota trigger sees exact counts at every statement boundary.
      for (let batch = 0; batch < 4; batch++) {
        const rows = Array.from({ length: 50 }, (_, i) => ({
          user_id: quotaUser.id,
          nombre: `Receta ${batch}-${i}`,
          ingredientes: ['huevo'],
          pasos: ['batir'],
        }));
        const res = await rest('recetas_propias', { method: 'POST', token: quotaUser.token, prefer: 'return=minimal', body: rows });
        expect(res.status).toBe(201);
      }
      expectCheckViolation(await insertReceta(quotaUser, { nombre: 'La 201' }), 'limit of 200 recipes per user');
    });

    test('one user\'s quota does not consume another\'s', async () => {
      const other = await ctx.createUser();
      expect((await insertReceta(other, { nombre: 'Otra persona' })).status).toBe(201);
    });

    test('a user holds at most 1000 favorites', async () => {
      const quotaUser = await ctx.createUser();
      const recipes = await catalogRecipeIds(quotaUser, 1000, { includeInactive: true });
      for (let batch = 0; batch < 4; batch++) {
        const rows = recipes.slice(batch * 250, (batch + 1) * 250).map(recipe_id => ({ user_id: quotaUser.id, recipe_id }));
        const res = await rest('favorites', { method: 'POST', token: quotaUser.token, prefer: 'return=minimal', body: rows });
        expect(res.status).toBe(201);
      }
      // The quota trigger is BEFORE INSERT, so it answers before the unique(user, recipe) check.
      const over = await rest('favorites', {
        method: 'POST',
        token: quotaUser.token,
        prefer: 'return=minimal',
        body: { user_id: quotaUser.id, recipe_id: recipes[0] },
      });
      expectCheckViolation(over, 'limit of 1000 favourites per user');
    });
  });

  // --- rate limiter -----------------------------------------------------------

  describe('check_and_increment_rate_limit', () => {
    test('an unregistered endpoint is rejected, not given a fresh counter', async () => {
      const res = await rpc('check_and_increment_rate_limit', {
        p_user_id: user.id,
        p_endpoint: `made-up-${crypto.randomUUID()}`,
        p_limit: 1_000_000,
        p_window_seconds: 3600,
      }, { token: user.token });
      expect(res.status).toBe(400);
      expect((res.body as { message?: string }).message ?? '').toContain('unknown endpoint');
    });

    test('a caller-supplied p_limit above the registered ceiling is clamped', async () => {
      const limited = await ctx.createUser();
      // delete-account is registered at 5/hour; the caller asks for a million.
      const verdicts: unknown[] = [];
      for (let i = 0; i < 6; i++) {
        const res = await rpc('check_and_increment_rate_limit', {
          p_user_id: limited.id,
          p_endpoint: 'delete-account',
          p_limit: 1_000_000,
          p_window_seconds: 3600,
        }, { token: limited.token });
        expect(res.status).toBe(200);
        verdicts.push(res.body);
      }
      expect(verdicts).toEqual([true, true, true, true, true, false]);
    });

    test('a caller-supplied p_limit below the ceiling still applies', async () => {
      const limited = await ctx.createUser();
      const call = async () => rpc('check_and_increment_rate_limit', {
        p_user_id: limited.id,
        p_endpoint: 'update-recipe-status',
        p_limit: 2,
        p_window_seconds: 3600,
      }, { token: limited.token });
      expect((await call()).body).toBe(true);
      expect((await call()).body).toBe(true);
      expect((await call()).body).toBe(false);
    });

    test('the endpoint registry is not readable or writable by a client', async () => {
      const read = await rest('rate_limit_endpoints', { token: user.token, query: 'select=*' });
      expect(read.status).toBe(403);
      expect((read.body as { code?: string }).code).toBe(PERMISSION_DENIED);

      const write = await rest('rate_limit_endpoints', {
        method: 'POST',
        token: user.token,
        prefer: 'return=minimal',
        body: { endpoint: 'made-up', max_per_hour: 1_000_000 },
      });
      expect(write.status).toBe(403);
      expect((write.body as { code?: string }).code).toBe(PERMISSION_DENIED);
    });
  });
});
