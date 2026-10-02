/**
 * FRESCO-782 (audit-6 A6-T2) — HTTP negative-contract tests for
 * send-weekly-reengagement-push.
 *
 * This function sends real push notifications to every subscribed user and
 * must only ever be triggerable by the pg_cron job (service-role caller,
 * `requireServiceRoleCaller`). Real HTTP against the local Supabase Edge
 * Functions runtime, not mocked. Only the rejection paths are exercised: the
 * happy path would send real notifications.
 *
 * Runs only when `RUN_DB_INTEGRATION=1` AND the local stack answers —
 * `bun run test:db`. See tests/db/README.md.
 */

import { afterAll, describe, expect, test } from 'bun:test';
import { callFunction, createDbTestContext, stackReachable } from '../harness';

const RUN = process.env.RUN_DB_INTEGRATION === '1';
const reachable = RUN ? await stackReachable() : false;

const ENDPOINT = 'send-weekly-reengagement-push';

describe.skipIf(!(RUN && reachable))('send-weekly-reengagement-push — HTTP negative contract (real functions runtime)', () => {
  const ctx = createDbTestContext();

  afterAll(async () => ctx.cleanupAll());

  test('401 when called with only the public anon key', async () => {
    const res = await callFunction(ENDPOINT, { body: {} });
    expect(res.status).toBe(401);
  });

  test('401 when called with a garbage token', async () => {
    const res = await callFunction(ENDPOINT, { token: 'not-a-real-jwt', body: {} });
    expect(res.status).toBe(401);
  });

  test('401 for a signed-in user — a user JWT is not the service-role caller', async () => {
    const user = await ctx.createUser();
    const res = await callFunction(ENDPOINT, { token: user.token, body: {} });
    expect(res.status).toBe(401);
  });
});
