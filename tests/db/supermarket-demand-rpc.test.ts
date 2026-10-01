/**
 * FRESCO-770 — proves `get_supermarket_demand` against the real database.
 *
 * The function is SECURITY DEFINER and cross-user by design (the refresh runner
 * needs every user's menus), so the property that matters is who may call it
 * and what comes back. Doctrine: `references/rpc-authorization.md` §5. It has
 * no identity parameter to spoof; the proof is that a signed-in user and the
 * anonymous role are refused, and that `service_role` gets aggregates only,
 * never a user, plan or slot id.
 *
 * Runs only when `RUN_DB_INTEGRATION=1` AND the local Supabase stack answers —
 * `bun run test:db`.
 */

import type { DbTestUser } from './harness';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { catalogRecipeIds, createDbTestContext, rest, rpc, seedMealPlan, seedSlots, stackReachable } from './harness';

const RUN = process.env.RUN_DB_INTEGRATION === '1';
const reachable = RUN ? await stackReachable() : false;

interface FilaDemanda { ingrediente: string, huecos: number }

async function ingredientesDe(recipeId: string): Promise<string[]> {
  const res = await rest('recipes', { serviceRole: true, query: `id=eq.${recipeId}&select=ingredientes_principales` });
  const crudos = (res.body as { ingredientes_principales: unknown }[])[0]?.ingredientes_principales;
  return Array.isArray(crudos) ? crudos.filter((i): i is string => typeof i === 'string') : [];
}

describe.skipIf(!(RUN && reachable))('get_supermarket_demand (real DB)', () => {
  const ctx = createDbTestContext();
  let user: DbTestUser;
  let esperado: Map<string, number>;

  beforeAll(async () => {
    user = await ctx.createUser();
    const [recetaCompra, recetaCocinada] = await catalogRecipeIds(user, 2);

    // Current plan: the same recipe twice still to buy (pending and substituted),
    // plus a cooked one that must not count.
    const actual = await seedMealPlan(user, { semanaIso: '2098-W24', fechaInicio: '2098-06-08' });
    await seedSlots(user, actual.id, [
      { recipeId: recetaCompra, tipoPlato: 'comida', estado: 'pendiente' },
      { recipeId: recetaCompra, tipoPlato: 'cena', estado: 'sustituida' },
      { recipeId: recetaCocinada, tipoPlato: 'desayuno', estado: 'cocinada' },
    ]);
    // An old plan that must not count.
    const antiguo = await seedMealPlan(user, { semanaIso: '2097-W02', fechaInicio: '2097-01-06' });
    await seedSlots(user, antiguo.id, [{ recipeId: recetaCompra, tipoPlato: 'comida' }]);

    esperado = new Map();
    for (const ingrediente of await ingredientesDe(recetaCompra)) {
      esperado.set(ingrediente, (esperado.get(ingrediente) ?? 0) + 2);
    }
  });

  afterAll(async () => ctx.cleanupAll());

  test('a signed-in user cannot call it', async () => {
    const res = await rpc('get_supermarket_demand', { p_desde: '2098-01-01' }, { token: user.token });
    expect([401, 403]).toContain(res.status);
  });

  test('the anonymous role cannot call it', async () => {
    const res = await rpc('get_supermarket_demand', { p_desde: '2098-01-01' });
    expect([401, 403]).toContain(res.status);
  });

  test('service_role gets the slots still to buy per ingredient, from plans starting on or after the date', async () => {
    const res = await rpc('get_supermarket_demand', { p_desde: '2098-01-01' }, { serviceRole: true });
    expect(res.status).toBe(200);
    const filas = res.body as FilaDemanda[];

    expect(esperado.size).toBeGreaterThan(0);
    for (const [ingrediente, huecos] of esperado) {
      // Pending + substituted count (2); the cooked slot and the old plan do not, and the test's own plans are the only ones from 2098 on.
      expect(filas.find(f => f.ingrediente === ingrediente)?.huecos).toBe(huecos);
    }
  });

  test('a later date drops the plan that starts before it', async () => {
    const res = await rpc('get_supermarket_demand', { p_desde: '2098-06-09' }, { serviceRole: true });
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  test('it returns aggregates only: no user, plan or slot id leaves the function', async () => {
    const res = await rpc('get_supermarket_demand', { p_desde: '2098-01-01' }, { serviceRole: true });
    const filas = res.body as Record<string, unknown>[];
    expect(filas.length).toBeGreaterThan(0);
    for (const fila of filas) {
      expect(Object.keys(fila).sort()).toEqual(['huecos', 'ingrediente']);
    }
    expect(JSON.stringify(res.body)).not.toContain(user.id);
  });

  test('it takes no identity parameter: passing one is refused by the API', async () => {
    const res = await rpc('get_supermarket_demand', { p_desde: '2098-01-01', p_user_id: user.id }, { serviceRole: true });
    expect(res.status).toBe(404);
  });
});
