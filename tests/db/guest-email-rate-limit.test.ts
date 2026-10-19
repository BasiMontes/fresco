/**
 * FRESCO-1006 (audit 7b A7-ABUSE-02) — `POST /api/auth/guest-email` mails a code to an address the
 * guest typed. It asks `check_and_increment_rate_limit` for the `guest-email-change` endpoint, which
 * the RPC only accepts when `rate_limit_endpoints` lists it (FRESCO-799): this pins the registration
 * and the ceiling against the real database, with a real anonymous-style user.
 *
 * Runs only when `RUN_DB_INTEGRATION=1` AND the local Supabase stack answers —
 * `bun run test:db`. A bare `bun test` skips the whole file (see `tests/db/README.md`).
 */

import type { DbTestUser } from './harness';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { createDbTestContext, rpc, stackReachable } from './harness';

const RUN = process.env.RUN_DB_INTEGRATION === '1';
const reachable = RUN ? await stackReachable() : false;

const CEILING = 3;

describe.skipIf(!(RUN && reachable))('guest-email-change rate limit (real DB)', () => {
  const ctx = createDbTestContext();
  let user: DbTestUser;

  beforeAll(async () => {
    user = await ctx.createUser();
  });

  afterAll(async () => ctx.cleanupAll());

  const hit = async (limit = CEILING) =>
    rpc('check_and_increment_rate_limit', { p_user_id: user.id, p_endpoint: 'guest-email-change', p_limit: limit, p_window_seconds: 3600 }, { token: user.token });

  test('the endpoint is registered: an unregistered one raises, this one is allowed', async () => {
    const unknown = await rpc('check_and_increment_rate_limit', { p_user_id: user.id, p_endpoint: 'guest-email-chnage', p_limit: CEILING, p_window_seconds: 3600 }, { token: user.token });
    expect(unknown.status).toBe(400);

    expect((await hit()).body).toBe(true);
  });

  test('the fourth call in an hour is refused, and a caller cannot ask for a higher ceiling', async () => {
    // One call was spent above: two more are allowed, even when the caller asks for 1000.
    expect((await hit(1000)).body).toBe(true);
    expect((await hit(1000)).body).toBe(true);

    expect((await hit(1000)).body).toBe(false);
  });
});
