/**
 * FRESCO-913 (definitive audit C-09) — `create_meal_plan`, the one transaction that writes a weekly
 * plan and all its slots, proven against the real database.
 *
 * Pinned here:
 *   1. A valid call creates the plan and every slot and returns the plan id.
 *   2. A week that is not a real ISO week, or a `fecha_inicio` that is not its Monday, or no slots,
 *      is refused with `22023` and nothing is written.
 *   3. Atomicity, the point of the ticket: when the SLOTS fail (a bad day, a duplicate slot, an
 *      unknown recipe) the plan row is rolled back with them. Before, a cut between the two inserts
 *      left a plan with no slots that blocked regenerating the week.
 *   4. A second plan for the same user and week is a unique violation and leaves the first intact.
 *   5. The function is executable by the service role only, and the table refuses a malformed week
 *      even when written directly.
 *
 * Runs only when `RUN_DB_INTEGRATION=1` AND the local Supabase stack answers —
 * `bun run test:db`. See `tests/db/README.md`.
 */

import type { DbTestUser } from './harness';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { catalogRecipeIds, createDbTestContext, rest, rpc, stackReachable } from './harness';

const RUN = process.env.RUN_DB_INTEGRATION === '1';
const reachable = RUN ? await stackReachable() : false;

const INVALID_PARAMETER = '22023';
const INVALID_TEXT = '22P02';
const UNIQUE_VIOLATION = '23505';
const FK_VIOLATION = '23503';
const CHECK_VIOLATION = '23514';
const PERMISSION_DENIED = '42501';

const DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'] as const;
const TIPOS = ['desayuno', 'comida', 'cena'] as const;

describe.skipIf(!(RUN && reachable))('create_meal_plan (real DB)', () => {
  const ctx = createDbTestContext();
  let user: DbTestUser;
  let recipeId: string;

  // Each test uses its own week so the (user, week) uniqueness never couples them.
  const weeks = ['2031-W10', '2031-W11', '2031-W12', '2031-W13', '2031-W14', '2031-W15', '2031-W16', '2031-W17', '2031-W18'];
  let nextWeek = 0;
  const week = () => weeks[nextWeek++];
  // The Monday of ISO week N of 2031 (2031-W01 starts Monday 2030-12-30).
  const mondayOf = (isoWeek: string) => {
    const n = Number(isoWeek.slice(-2));
    return new Date(Date.UTC(2030, 11, 30) + (n - 1) * 7 * 86_400_000).toISOString().slice(0, 10);
  };

  function slots(overrides: Array<Record<string, unknown>> = []) {
    const all = DIAS.flatMap(dia => TIPOS.map(tipo => ({ recipe_id: recipeId, dia, tipo_plato: tipo, estado: 'pendiente' })));
    return overrides.length > 0 ? overrides : all;
  }

  async function create(semana: string, extra: Record<string, unknown> = {}) {
    // A malformed label has no Monday to derive: those calls always pass their own p_fecha_inicio.
    const fecha = 'p_fecha_inicio' in extra ? extra.p_fecha_inicio : mondayOf(semana);
    return rpc('create_meal_plan', {
      p_user_id: user.id,
      p_semana_iso: semana,
      p_fecha_inicio: fecha,
      p_advertencias: [],
      p_explicacion_aprendizaje: null,
      p_slots: slots(),
      ...extra,
    }, { serviceRole: true });
  }

  const plansOf = async (semana: string) =>
    (await rest('meal_plans', { serviceRole: true, query: `user_id=eq.${user.id}&semana_iso=eq.${semana}&select=id` })).body as Array<{ id: string }>;
  const slotCount = async (planId: string) =>
    ((await rest('meal_plan_recipes', { serviceRole: true, query: `meal_plan_id=eq.${planId}&select=id` })).body as unknown[]).length;
  const codeOf = (res: { body: unknown }) => (res.body as { code?: string }).code;

  beforeAll(async () => {
    user = await ctx.createUser();
    recipeId = (await catalogRecipeIds(user, 1))[0]!;
  });

  afterAll(async () => {
    await ctx.cleanupAll();
  });

  test('creates the plan and all 21 slots and returns the plan id', async () => {
    const semana = week();

    const res = await create(semana);

    expect(res.status).toBe(200);
    const planId = res.body as string;
    expect(planId).toMatch(/^[0-9a-f-]{36}$/);
    expect((await plansOf(semana)).map(p => p.id)).toEqual([planId]);
    expect(await slotCount(planId)).toBe(21);
  });

  test.each([
    ['not a week label', 'abc'],
    ['no W separator', '2031-10'],
    ['week 00', '2031-W00'],
    ['week 54', '2031-W54'],
    ['week 53 in a year that has only 52', '2027-W53'],
  ])('refuses a semana_iso that is %s, and writes nothing', async (_label, semana) => {
    const res = await create(semana, { p_fecha_inicio: '2031-03-03' });

    expect(res.status).toBe(400);
    expect(codeOf(res)).toBe(INVALID_PARAMETER);
    expect(await plansOf(semana)).toEqual([]);
  });

  test('refuses a fecha_inicio that is not the Monday of that week, and writes nothing', async () => {
    const semana = week();

    const res = await create(semana, { p_fecha_inicio: '2031-03-05' });

    expect(res.status).toBe(400);
    expect(codeOf(res)).toBe(INVALID_PARAMETER);
    expect(await plansOf(semana)).toEqual([]);
  });

  test('refuses an empty slot list: a plan without slots is what this function prevents', async () => {
    const semana = week();

    const res = await create(semana, { p_slots: [] });

    expect(res.status).toBe(400);
    expect(codeOf(res)).toBe(INVALID_PARAMETER);
    expect(await plansOf(semana)).toEqual([]);
  });

  test.each([
    ['a day that does not exist', [{ recipe_id: 'RECIPE', dia: 'funday', tipo_plato: 'cena' }], INVALID_TEXT],
    ['the same slot twice', [{ recipe_id: 'RECIPE', dia: 'lunes', tipo_plato: 'cena' }, { recipe_id: 'RECIPE', dia: 'lunes', tipo_plato: 'cena' }], UNIQUE_VIOLATION],
    ['a recipe that does not exist', [{ recipe_id: '00000000-0000-4000-8000-000000000000', dia: 'lunes', tipo_plato: 'cena' }], FK_VIOLATION],
  ])('when the slots fail (%s) the plan is rolled back too: no orphan', async (_label, rawSlots, expectedCode) => {
    const semana = week();
    const bad = (rawSlots as Array<Record<string, unknown>>).map(s => (s.recipe_id === 'RECIPE' ? { ...s, recipe_id: recipeId } : s));

    const res = await create(semana, { p_slots: bad });

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(codeOf(res)).toBe(expectedCode);
    // The plan INSERT ran first inside the function; it must have been rolled back with the slots.
    expect(await plansOf(semana)).toEqual([]);
  });

  test('a second plan for the same user and week is a unique violation and leaves the first intact', async () => {
    const semana = week();
    const first = await create(semana);
    expect(first.status).toBe(200);

    const second = await create(semana);

    expect(second.status).toBe(409);
    expect(codeOf(second)).toBe(UNIQUE_VIOLATION);
    const plans = await plansOf(semana);
    expect(plans).toHaveLength(1);
    expect(await slotCount(plans[0].id)).toBe(21);
  });

  test('a signed-in user and an anonymous caller cannot execute it', async () => {
    const asUser = await rpc('create_meal_plan', {
      p_user_id: user.id,
      p_semana_iso: week(),
      p_fecha_inicio: '2031-03-03',
      p_advertencias: [],
      p_explicacion_aprendizaje: null,
      p_slots: slots(),
    }, { token: user.token });
    expect(asUser.status).toBe(403);
    expect(codeOf(asUser)).toBe(PERMISSION_DENIED);

    const anonymous = await rpc('create_meal_plan', {
      p_user_id: user.id,
      p_semana_iso: week(),
      p_fecha_inicio: '2031-03-03',
      p_advertencias: [],
      p_explicacion_aprendizaje: null,
      p_slots: slots(),
    });
    expect([401, 403]).toContain(anonymous.status);
    expect(codeOf(anonymous)).toBe(PERMISSION_DENIED);
  });

  test('the table itself refuses a malformed week, even written directly with the service role', async () => {
    const res = await rest('meal_plans', {
      method: 'POST',
      serviceRole: true,
      prefer: 'return=minimal',
      body: { user_id: user.id, semana_iso: '2031-W99', fecha_inicio: '2031-03-03', advertencias: [] },
    });

    expect(res.status).toBe(400);
    expect(codeOf(res)).toBe(CHECK_VIOLATION);
    expect(JSON.stringify(res.body)).toContain('meal_plans_semana_iso_valida');
  });
});
