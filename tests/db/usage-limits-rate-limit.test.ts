/**
 * FRESCO-1017 (audit 7b A7-ABUSE-04, A7-ABUSE-05) — three authenticated endpoints had no limit:
 * `generate-shopping-list`, `get-shopping-list-suggestions` and `profile-export`. Each asks
 * `check_and_increment_rate_limit`, which only accepts an endpoint listed in `rate_limit_endpoints`
 * (FRESCO-799) and clamps `p_limit` to the stored ceiling: this pins the three registrations and
 * their ceilings against the real database.
 *
 * Runs only when `RUN_DB_INTEGRATION=1` AND the local Supabase stack answers —
 * `bun run test:db`. A bare `bun test` skips the whole file (see `tests/db/README.md`).
 */

import type { DbTestUser } from './harness';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { createDbTestContext, rpc, stackReachable } from './harness';

const RUN = process.env.RUN_DB_INTEGRATION === '1';
const reachable = RUN ? await stackReachable() : false;

const ENDPOINTS = [
  { endpoint: 'generate-shopping-list', ceiling: 60 },
  { endpoint: 'get-shopping-list-suggestions', ceiling: 120 },
  { endpoint: 'profile-export', ceiling: 10 },
] as const;

describe.skipIf(!(RUN && reachable))('usage limits for shopping-list and export endpoints (real DB)', () => {
  const ctx = createDbTestContext();
  let user: DbTestUser;

  beforeAll(async () => {
    user = await ctx.createUser();
  });

  afterAll(async () => ctx.cleanupAll());

  const hit = async (endpoint: string, limit: number) =>
    rpc('check_and_increment_rate_limit', { p_user_id: user.id, p_endpoint: endpoint, p_limit: limit, p_window_seconds: 3600 }, { token: user.token });

  for (const { endpoint, ceiling } of ENDPOINTS) {
    test(`${endpoint}: registered, allows ${ceiling} an hour, refuses the next, and the caller cannot raise the ceiling`, async () => {
      for (let i = 0; i < ceiling; i++) {
        const res = await hit(endpoint, 100_000);
        expect(res.status).toBe(200);
        expect(res.body).toBe(true);
      }

      expect((await hit(endpoint, 100_000)).body).toBe(false);
    });
  }

  test('an endpoint that is not registered raises instead of passing', async () => {
    const unknown = await hit('profile-export-typo', 10);
    expect(unknown.status).toBe(400);
  });
});
