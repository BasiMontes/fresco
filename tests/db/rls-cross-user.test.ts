/**
 * FRESCO-464 (scope expansion, comment §A) — cross-user RLS denial tests.
 *
 * For every table holding user data: user A seeds a row, then user B — with
 * B's own JWT, never the service-role key — attempts SELECT / UPDATE / DELETE /
 * INSERT-for-A against it and the test asserts a real denial (empty result set,
 * zero rows affected, or `42501`). Verification of "row unchanged" is always
 * done by re-reading through A's own token, never service-role, so the check
 * exercises the same RLS path the app uses.
 *
 * Runs only under `bun run test:db` (`RUN_DB_INTEGRATION=1` + reachable stack).
 */

import type { DbTestUser } from './harness';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import {
  catalogRecipeIds,
  createDbTestContext,

  rest,
  seedMealPlan,
  seedShoppingList,
  seedSlots,
  stackReachable,
} from './harness';

const RUN = process.env.RUN_DB_INTEGRATION === '1';
const reachable = RUN ? await stackReachable() : false;

/** A PostgREST write that RLS filtered to zero rows returns 200 + `[]` (with `return=representation`). */
function expectZeroRows(result: { status: number, body: unknown }): void {
  expect(result.status).toBe(200);
  expect(result.body).toEqual([]);
}

/** A PostgREST INSERT that violates a `WITH CHECK` policy returns 403 + `42501`. */
function expectRlsInsertDenied(result: { status: number, body: unknown }): void {
  expect(result.status).toBe(403);
  expect((result.body as { code?: string }).code).toBe('42501');
}

describe.skipIf(!(RUN && reachable))('cross-user RLS denial (real DB)', () => {
  const ctx = createDbTestContext();
  let A: DbTestUser;
  let B: DbTestUser;
  let recipe: string;

  // A's seeded rows.
  let planId: string;
  let slotId: string;
  let listId: string;
  let favoriteId: string;
  let recetaId: string;
  let pushId: string;

  beforeAll(async () => {
    [A, B] = await Promise.all([ctx.createUser(), ctx.createUser()]);
    [recipe] = await catalogRecipeIds(A, 1);

    ({ id: planId } = await seedMealPlan(A, { semanaIso: '2099-W01', fechaInicio: '2099-01-05' }));
    [slotId] = await seedSlots(A, planId, [{ recipeId: recipe, tipoPlato: 'comida' }]);
    listId = await seedShoppingList(A, planId);

    const fav = await rest('favorites', {
      method: 'POST',
      token: A.token,
      prefer: 'return=representation',
      body: { user_id: A.id, recipe_id: recipe },
    });
    favoriteId = (fav.body as { id: string }[])[0].id;

    const receta = await rest('recetas_propias', {
      method: 'POST',
      token: A.token,
      prefer: 'return=representation',
      body: { user_id: A.id, nombre: 'Tortilla de A', ingredientes: ['huevo'], pasos: ['batir'] },
    });
    recetaId = (receta.body as { id: string }[])[0].id;

    const push = await rest('push_subscriptions', {
      method: 'POST',
      token: A.token,
      prefer: 'return=representation',
      body: { user_id: A.id, endpoint: 'https://push.example/a', p256dh: 'key-a', auth: 'auth-a' },
    });
    pushId = (push.body as { id: string }[])[0].id;
  });

  afterAll(async () => ctx.cleanupAll());

  test('meal_plans — B cannot see, change, delete, or insert-for-A', async () => {
    const sel = await rest('meal_plans', { token: B.token, query: `id=eq.${planId}` });
    expect(sel.body).toEqual([]);

    expectZeroRows(await rest('meal_plans', {
      method: 'PATCH',
      token: B.token,
      prefer: 'return=representation',
      query: `id=eq.${planId}`,
      body: { semana_iso: 'HACKED' },
    }));

    expectZeroRows(await rest('meal_plans', {
      method: 'DELETE',
      token: B.token,
      prefer: 'return=representation',
      query: `id=eq.${planId}`,
    }));

    expectRlsInsertDenied(await rest('meal_plans', {
      method: 'POST',
      token: B.token,
      body: { user_id: A.id, semana_iso: '2099-W02', fecha_inicio: '2099-01-12', advertencias: [] },
    }));

    const check = await rest('meal_plans', { token: A.token, query: `id=eq.${planId}&select=semana_iso` });
    expect((check.body as { semana_iso: string }[])[0].semana_iso).toBe('2099-W01');
  });

  test('meal_plan_recipes — B cannot see, change, or insert via A\'s meal_plan_id', async () => {
    const sel = await rest('meal_plan_recipes', { token: B.token, query: `id=eq.${slotId}` });
    expect(sel.body).toEqual([]);

    expectZeroRows(await rest('meal_plan_recipes', {
      method: 'PATCH',
      token: B.token,
      prefer: 'return=representation',
      query: `id=eq.${slotId}`,
      body: { rating: 1 },
    }));

    expectRlsInsertDenied(await rest('meal_plan_recipes', {
      method: 'POST',
      token: B.token,
      body: { meal_plan_id: planId, recipe_id: recipe, dia: 'martes', tipo_plato: 'cena' },
    }));

    const check = await rest('meal_plan_recipes', { token: A.token, query: `id=eq.${slotId}&select=rating` });
    expect((check.body as { rating: number | null }[])[0].rating).toBeNull();
  });

  test('favorites — B cannot see, delete, or insert-for-A', async () => {
    const sel = await rest('favorites', { token: B.token, query: `id=eq.${favoriteId}` });
    expect(sel.body).toEqual([]);

    expectZeroRows(await rest('favorites', {
      method: 'DELETE',
      token: B.token,
      prefer: 'return=representation',
      query: `id=eq.${favoriteId}`,
    }));

    expectRlsInsertDenied(await rest('favorites', {
      method: 'POST',
      token: B.token,
      body: { user_id: A.id, recipe_id: recipe },
    }));

    const check = await rest('favorites', { token: A.token, query: `id=eq.${favoriteId}&select=id` });
    expect((check.body as unknown[]).length).toBe(1);
  });

  test('recetas_propias — B cannot see, change, delete, or insert-for-A', async () => {
    const sel = await rest('recetas_propias', { token: B.token, query: `id=eq.${recetaId}` });
    expect(sel.body).toEqual([]);

    expectZeroRows(await rest('recetas_propias', {
      method: 'PATCH',
      token: B.token,
      prefer: 'return=representation',
      query: `id=eq.${recetaId}`,
      body: { nombre: 'HACKED' },
    }));

    expectZeroRows(await rest('recetas_propias', {
      method: 'DELETE',
      token: B.token,
      prefer: 'return=representation',
      query: `id=eq.${recetaId}`,
    }));

    expectRlsInsertDenied(await rest('recetas_propias', {
      method: 'POST',
      token: B.token,
      body: { user_id: A.id, nombre: 'Inyectada', ingredientes: [], pasos: [] },
    }));

    const check = await rest('recetas_propias', { token: A.token, query: `id=eq.${recetaId}&select=nombre` });
    expect((check.body as { nombre: string }[])[0].nombre).toBe('Tortilla de A');
  });

  test('shopping_lists — B cannot see, change, delete, or insert-for-A', async () => {
    const sel = await rest('shopping_lists', { token: B.token, query: `id=eq.${listId}` });
    expect(sel.body).toEqual([]);

    expectZeroRows(await rest('shopping_lists', {
      method: 'PATCH',
      token: B.token,
      prefer: 'return=representation',
      query: `id=eq.${listId}`,
      body: { items: [] },
    }));

    expectZeroRows(await rest('shopping_lists', {
      method: 'DELETE',
      token: B.token,
      prefer: 'return=representation',
      query: `id=eq.${listId}`,
    }));

    expectRlsInsertDenied(await rest('shopping_lists', {
      method: 'POST',
      token: B.token,
      body: { user_id: A.id, meal_plan_id: planId, items: [] },
    }));

    const check = await rest('shopping_lists', { token: A.token, query: `id=eq.${listId}&select=items` });
    expect((check.body as { items: unknown[] }[])[0].items).not.toEqual([]);
  });

  test('user_profiles — B cannot read another profile or write its subscription columns (FRESCO-360 re-verify)', async () => {
    const sel = await rest('user_profiles', { token: B.token, query: `id=eq.${A.id}` });
    expect(sel.body).toEqual([]);

    // Subscription column — the FRESCO-360 self-grant-Pro path, from the other side.
    expectZeroRows(await rest('user_profiles', {
      method: 'PATCH',
      token: B.token,
      prefer: 'return=representation',
      query: `id=eq.${A.id}`,
      body: { plan: 'pro' },
    }));

    // A non-subscription column is still RLS-denied for a foreign profile.
    expectZeroRows(await rest('user_profiles', {
      method: 'PATCH',
      token: B.token,
      prefer: 'return=representation',
      query: `id=eq.${A.id}`,
      body: { num_personas: 9 },
    }));

    expectRlsInsertDenied(await rest('user_profiles', {
      method: 'POST',
      token: B.token,
      body: { id: A.id },
    }));

    const check = await rest('user_profiles', { token: A.token, query: `id=eq.${A.id}&select=plan,num_personas` });
    const row = (check.body as { plan: string, num_personas: number }[])[0];
    expect(row.plan).toBe('free');
    expect(row.num_personas).toBe(2);
  });

  test('push_subscriptions — B cannot see, delete, or insert-for-A', async () => {
    const sel = await rest('push_subscriptions', { token: B.token, query: `id=eq.${pushId}` });
    expect(sel.body).toEqual([]);

    expectZeroRows(await rest('push_subscriptions', {
      method: 'DELETE',
      token: B.token,
      prefer: 'return=representation',
      query: `id=eq.${pushId}`,
    }));

    expectRlsInsertDenied(await rest('push_subscriptions', {
      method: 'POST',
      token: B.token,
      body: { user_id: A.id, endpoint: 'https://push.example/hack', p256dh: 'k', auth: 'a' },
    }));

    const check = await rest('push_subscriptions', { token: A.token, query: `id=eq.${pushId}&select=id` });
    expect((check.body as unknown[]).length).toBe(1);
  });
});
