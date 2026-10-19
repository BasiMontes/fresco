/**
 * FRESCO-1017 (audit 7b A7-ABUSE-04) — `meal_plans` holds at most 104 rows per user (two years of
 * weekly plans). Before, any year from 0000 to 9999 was a valid week, so one account could grow
 * ~530k rows, all of them read by the profile export. The rows come from `create_meal_plan` through
 * the service role (FRESCO-777: `authenticated` has no INSERT), so the cap is proven on that path.
 *
 * Runs only when `RUN_DB_INTEGRATION=1` AND the local Supabase stack answers —
 * `bun run test:db`. A bare `bun test` skips the whole file (see `tests/db/README.md`).
 */

import type { DbTestUser } from './harness';
import { afterAll, describe, expect, test } from 'bun:test';
import { createDbTestContext, rest, seedMealPlan, stackReachable } from './harness';

const RUN = process.env.RUN_DB_INTEGRATION === '1';
const reachable = RUN ? await stackReachable() : false;

const CAP = 104;
const CHECK_VIOLATION = '23514';

/** Week `n` (0-based) of a run of consecutive ISO weeks: 52 per year, from 2060. */
function weekRow(user: DbTestUser, n: number) {
  const year = 2060 + Math.floor(n / 52);
  const week = String((n % 52) + 1).padStart(2, '0');
  return { user_id: user.id, semana_iso: `${year}-W${week}`, fecha_inicio: '2060-01-05', advertencias: [] };
}

async function insertPlans(user: DbTestUser, from: number, count: number) {
  const rows = Array.from({ length: count }, (_, i) => weekRow(user, from + i));
  return rest('meal_plans', { method: 'POST', serviceRole: true, prefer: 'return=minimal', body: rows });
}

describe.skipIf(!(RUN && reachable))('meal_plans per-user cap (real DB)', () => {
  const ctx = createDbTestContext();

  afterAll(async () => ctx.cleanupAll());

  test('a user holds at most 104 plans: the 105th is a check violation', async () => {
    const user = await ctx.createUser();
    // Two batches: the quota trigger sees exact counts at every statement boundary.
    expect((await insertPlans(user, 0, CAP / 2)).status).toBe(201);
    expect((await insertPlans(user, CAP / 2, CAP / 2)).status).toBe(201);

    const over = await insertPlans(user, CAP, 1);
    expect(over.status).toBe(400);
    const body = over.body as { code?: string, message?: string };
    expect(body.code).toBe(CHECK_VIOLATION);
    expect(body.message ?? '').toContain('limit of 104 plans per user');
  });

  test('one user\'s cap does not consume another\'s', async () => {
    const other = await ctx.createUser();
    const plan = await seedMealPlan(other, { semanaIso: '2099-W10', fechaInicio: '2099-03-02' });
    expect(plan.id).toBeTruthy();
  });

  test('deleting a plan frees a slot', async () => {
    const user = await ctx.createUser();
    expect((await insertPlans(user, 0, CAP / 2)).status).toBe(201);
    expect((await insertPlans(user, CAP / 2, CAP / 2)).status).toBe(201);
    expect((await insertPlans(user, CAP, 1)).status).toBe(400);

    const removed = await rest('meal_plans', {
      method: 'DELETE',
      serviceRole: true,
      query: `user_id=eq.${user.id}&semana_iso=eq.${weekRow(user, 0).semana_iso}`,
      prefer: 'return=minimal',
    });
    expect(removed.status).toBe(204);

    expect((await insertPlans(user, CAP, 1)).status).toBe(201);
  });
});
