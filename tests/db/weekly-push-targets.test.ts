/**
 * FRESCO-1180 — who the Sunday push reminder reaches. The cron fires when the current ISO week is about
 * to end, so `send-weekly-reengagement-push` now asks `get_push_subscriptions_without_current_plan` about
 * the NEXT week. Against the real function: a user with a plan this week and none next week is a target
 * for next week (and not for this one), a user who already planned next week is not, and a user with no
 * plan at all is. Far-future weeks keep the fixtures away from any real plan.
 *
 * Runs only when `RUN_DB_INTEGRATION=1` AND the local stack answers: `bun run test:db`. See tests/db/README.md.
 */

import type { DbTestUser } from './harness';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { createDbTestContext, farWeek, rest, rpc, seedMealPlan, stackReachable } from './harness';

const RUN = process.env.RUN_DB_INTEGRATION === '1';
const reachable = RUN ? await stackReachable() : false;

const THIS_WEEK = farWeek(30);
const NEXT_WEEK = farWeek(31);

const P256DH = `B${'A'.repeat(86)}`;
const AUTH = 'A'.repeat(22);

async function subscribe(user: DbTestUser): Promise<void> {
  // A subscription is the user's own row: `service_role` has no INSERT on this table, only the owner does.
  const res = await rest('push_subscriptions', {
    method: 'POST',
    token: user.token,
    prefer: 'return=minimal',
    body: { user_id: user.id, endpoint: `https://fcm.googleapis.com/fcm/send/${crypto.randomUUID()}`, p256dh: P256DH, auth: AUTH },
  });
  if (res.status >= 300) {
    throw new Error(`[weekly-push-targets.test] subscribe failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
}

async function targetsFor(semanaIso: string): Promise<Set<string>> {
  const res = await rpc('get_push_subscriptions_without_current_plan', { p_semana_iso: semanaIso }, { serviceRole: true });
  expect(res.status).toBe(200);
  return new Set((res.body as Array<{ user_id: string }>).map(row => row.user_id));
}

describe.skipIf(!(RUN && reachable))('weekly push targets (real DB)', () => {
  const ctx = createDbTestContext();
  let planned: DbTestUser;
  let alreadyNext: DbTestUser;
  let nothing: DbTestUser;

  beforeAll(async () => {
    [planned, alreadyNext, nothing] = await Promise.all([ctx.createUser(), ctx.createUser(), ctx.createUser()]);
    await Promise.all([subscribe(planned), subscribe(alreadyNext), subscribe(nothing)]);
    await seedMealPlan(planned, THIS_WEEK);
    await seedMealPlan(alreadyNext, NEXT_WEEK);
  });

  afterAll(async () => ctx.cleanupAll());

  test('a user with a plan this week and none next week is a target for next week', async () => {
    expect((await targetsFor(NEXT_WEEK.semanaIso)).has(planned.id)).toBe(true);
  });

  test('a user who already planned next week is not a target for next week', async () => {
    expect((await targetsFor(NEXT_WEEK.semanaIso)).has(alreadyNext.id)).toBe(false);
  });

  test('a user with no plan at all is a target', async () => {
    expect((await targetsFor(NEXT_WEEK.semanaIso)).has(nothing.id)).toBe(true);
  });

  test('asked about the week that is ending instead, the first user would be skipped: the original bug', async () => {
    const thisWeek = await targetsFor(THIS_WEEK.semanaIso);
    expect(thisWeek.has(planned.id)).toBe(false);
    expect(thisWeek.has(alreadyNext.id)).toBe(true);
  });
});
