/**
 * FRESCO-1003 (audit 7b A7-API-04) — `POST /api/stripe/portal` opens a Stripe Billing Portal session
 * on every call. It asks `check_and_increment_rate_limit` for the `stripe-portal` endpoint, which the
 * RPC only accepts when `rate_limit_endpoints` lists it (FRESCO-799): this pins the registration and
 * the ceiling against the real database.
 *
 * Runs only when `RUN_DB_INTEGRATION=1` AND the local Supabase stack answers —
 * `bun run test:db`. A bare `bun test` skips the whole file (see `tests/db/README.md`).
 */

import type { DbTestUser } from './harness';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { createDbTestContext, rpc, stackReachable } from './harness';

const RUN = process.env.RUN_DB_INTEGRATION === '1';
const reachable = RUN ? await stackReachable() : false;

const CEILING = 20;

describe.skipIf(!(RUN && reachable))('stripe-portal rate limit (real DB)', () => {
  const ctx = createDbTestContext();
  let user: DbTestUser;

  beforeAll(async () => {
    user = await ctx.createUser();
  });

  afterAll(async () => ctx.cleanupAll());

  const hit = async (limit = CEILING) =>
    rpc('check_and_increment_rate_limit', { p_user_id: user.id, p_endpoint: 'stripe-portal', p_limit: limit, p_window_seconds: 3600 }, { token: user.token });

  test('the endpoint is registered: the first call is allowed, an unregistered one raises', async () => {
    const first = await hit();
    expect(first.status).toBe(200);
    expect(first.body).toBe(true);

    const unknown = await rpc('check_and_increment_rate_limit', { p_user_id: user.id, p_endpoint: 'stripe-portal-typo', p_limit: CEILING, p_window_seconds: 3600 }, { token: user.token });
    expect(unknown.status).toBe(400);
  });

  test('the call past 20 an hour is refused, and a caller cannot ask for a higher ceiling', async () => {
    // One call was spent above. The rest of the ceiling is allowed, even when the caller asks for more.
    for (let i = 1; i < CEILING; i++) {
      expect((await hit(1000)).body).toBe(true);
    }

    expect((await hit(1000)).body).toBe(false);
  });
});
