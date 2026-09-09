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

import { afterAll, describe, expect, test } from 'bun:test';
import { callFunction, createDbTestContext, rpc, stackReachable } from '../harness';

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
