/**
 * FRESCO-464 PR2 — HTTP negative-contract tests for generate-meal-plan.
 *
 * Real HTTP against the local Supabase Edge Functions runtime (`supabase
 * start`), not mocked, not e2e. Covers only the paths reachable without a
 * full successful generation: the auth gate, the rate limit, and body
 * validation — a full generation needs the 1000-recipe catalog seeded and is
 * out of scope here (menu-selector.ts already has unit coverage for that
 * logic).
 *
 * Runs only when `RUN_DB_INTEGRATION=1` AND the local stack answers —
 * `bun run test:db`. See tests/db/README.md.
 */

import type { DbTestUser } from '../harness';
import { afterAll, describe, expect, test } from 'bun:test';
import { getDateFromIsoWeek } from '../../../lib/date/iso-week';
import { callFunction, createDbTestContext, rest, rpc, stackReachable } from '../harness';
import { textHasAllergen } from '../recipe-allergen-diet-rules';

const RUN = process.env.RUN_DB_INTEGRATION === '1';
const reachable = RUN ? await stackReachable() : false;

const ENDPOINT = 'generate-meal-plan';

describe.skipIf(!(RUN && reachable))('generate-meal-plan — HTTP negative contract (real functions runtime)', () => {
  const ctx = createDbTestContext();

  afterAll(async () => ctx.cleanupAll());

  test('401 when called with no token', async () => {
    const res = await callFunction(ENDPOINT, {});
    expect(res.status).toBe(401);
  });

  test('401 when called with a garbage token', async () => {
    const res = await callFunction(ENDPOINT, { token: 'not-a-real-jwt' });
    expect(res.status).toBe(401);
  });

  test('429 once the 5/h rate limit is pre-saturated', async () => {
    // Pre-saturates the same atomic RPC the function itself calls, rather
    // than driving 5 real generations (needs the full catalog — out of
    // scope). See harness.ts's own rate-limit spoof test for the same
    // pattern.
    const user = await ctx.createUser();
    await Promise.all(
      Array.from({ length: 5 }, async () => rpc('check_and_increment_rate_limit', {
        p_user_id: user.id,
        p_endpoint: ENDPOINT,
        p_limit: 5,
        p_window_seconds: 3600,
      }, { token: user.token })),
    );

    const res = await callFunction(ENDPOINT, {
      token: user.token,
      body: { semana_iso: '2099-W01', fecha_inicio: '2099-01-05' },
    });
    expect(res.status).toBe(429);
  });

  test('400 when the body is missing semana_iso / fecha_inicio', async () => {
    const user = await ctx.createUser();
    const res = await callFunction(ENDPOINT, { token: user.token, body: {} });
    expect(res.status).toBe(400);
  });
});

/**
 * FRESCO-1016 (audit 7b A7-TEST-04) — the wiring of the money-and-safety path, through the real function:
 * profile read -> get_filtered_recipes -> entitlement check -> selection -> create_meal_plan -> 21 slots.
 * Until now only its refusals were tested here; its positive path was an e2e with two allergens.
 */
interface GeneratedRecipe {
  id: string
  nombre: string
  alergenos: string[] | null
  ingredientes_principales: string[] | null
  pasos_resumen: string[] | null
}
interface GenerateBody {
  meal_plan_id: string
  menu: Record<string, Record<string, GeneratedRecipe | null>>
  advertencias: string[]
  explicacion_aprendizaje: string | null
}

const WEEK = '2099-W20';
const weekBody = { semana_iso: WEEK, fecha_inicio: getDateFromIsoWeek(WEEK).toISOString().slice(0, 10) };

describe.skipIf(!(RUN && reachable))('generate-meal-plan — the positive path (real functions runtime)', () => {
  const ctx = createDbTestContext();

  afterAll(async () => ctx.cleanupAll());

  const generate = async (user: DbTestUser) => callFunction(ENDPOINT, { token: user.token, body: weekBody });
  const recipesOf = (body: GenerateBody) => Object.values(body.menu).flatMap(day => Object.values(day)).filter((recipe): recipe is GeneratedRecipe => recipe !== null);
  const setProfile = async (user: DbTestUser, patch: Record<string, unknown>) => {
    const res = await rest('user_profiles', { method: 'PATCH', token: user.token, query: `id=eq.${user.id}`, prefer: 'return=minimal', body: patch });
    expect(res.status).toBeLessThan(300);
  };
  const setEntitlement = async (user: DbTestUser, patch: Record<string, unknown>) => {
    const res = await rest('user_profiles', { method: 'PATCH', serviceRole: true, query: `id=eq.${user.id}`, prefer: 'return=minimal', body: patch });
    expect(res.status).toBeLessThan(300);
  };
  const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const daysAhead = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

  test('a profile allergic to sesame gets 0 of 21 recipes with sesame, by tag and by the oracle\'s keywords', async () => {
    const user = await ctx.createUser({ healthDataConsent: true });
    await setProfile(user, { alergenos: ['sesamo'] });

    const res = await generate(user);
    expect(res.status).toBe(200);
    const body = res.body as GenerateBody;

    const recipes = recipesOf(body);
    expect(recipes.length).toBeGreaterThan(0);
    expect(recipes.filter(r => (r.alergenos ?? []).some(a => a.toLowerCase() === 'sesamo')).map(r => r.nombre)).toEqual([]);
    const textual = recipes.filter(r => [...(r.ingredientes_principales ?? []), ...(r.pasos_resumen ?? [])].some(text => textHasAllergen(text, 'sesamo')));
    expect(textual.map(r => r.nombre)).toEqual([]);
  });

  test('the 21 slots really exist in the database, each with a recipe or an honest empty state', async () => {
    const user = await ctx.createUser({ healthDataConsent: true });

    const res = await generate(user);
    expect(res.status).toBe(200);
    const body = res.body as GenerateBody;

    const slots = await rest('meal_plan_recipes', { token: user.token, query: `meal_plan_id=eq.${body.meal_plan_id}&select=dia,tipo_plato,recipe_id,estado` });
    expect(slots.body as unknown[]).toHaveLength(21);
  });

  test('a second generation for the same week is refused with 409 and writes nothing', async () => {
    const user = await ctx.createUser({ healthDataConsent: true });
    expect((await generate(user)).status).toBe(200);

    expect((await generate(user)).status).toBe(409);

    const plans = await rest('meal_plans', { token: user.token, query: 'select=id' });
    expect(plans.body as unknown[]).toHaveLength(1);
  });

  describe('the Pro entitlement is judged from the profile row, not trusted (A4-L8, FRESCO-1003)', () => {
    test('a Free user gets no learning explanation', async () => {
      const user = await ctx.createUser();

      const res = await generate(user);

      expect(res.status).toBe(200);
      expect((res.body as GenerateBody).explicacion_aprendizaje).toBeNull();
    });

    test('an active Pro gets one', async () => {
      const user = await ctx.createUser({ plan: 'pro' });
      await setEntitlement(user, { plan_expires_at: daysAhead(10) });

      const res = await generate(user);

      expect(res.status).toBe(200);
      expect(typeof (res.body as GenerateBody).explicacion_aprendizaje).toBe('string');
    });

    test('a Pro whose plan_expires_at has passed, with no payment failure, is treated as Free', async () => {
      const user = await ctx.createUser({ plan: 'pro' });
      await setEntitlement(user, { plan_expires_at: daysAgo(2), payment_failed_at: null });

      const res = await generate(user);

      expect(res.status).toBe(200);
      expect((res.body as GenerateBody).explicacion_aprendizaje).toBeNull();
    });

    test('a lapsed Pro inside the 30-day payment grace is still Pro; past it, Free', async () => {
      const inGrace = await ctx.createUser({ plan: 'pro' });
      await setEntitlement(inGrace, { plan_expires_at: daysAgo(2), payment_failed_at: daysAgo(5) });
      const pastGrace = await ctx.createUser({ plan: 'pro' });
      await setEntitlement(pastGrace, { plan_expires_at: daysAgo(2), payment_failed_at: daysAgo(40) });

      expect(typeof ((await generate(inGrace)).body as GenerateBody).explicacion_aprendizaje).toBe('string');
      expect(((await generate(pastGrace)).body as GenerateBody).explicacion_aprendizaje).toBeNull();
    });
  });
});
