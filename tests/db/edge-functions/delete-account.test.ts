/**
 * FRESCO-464 PR2 — HTTP negative-contract tests for delete-account.
 *
 * Real HTTP against the local Supabase Edge Functions runtime (`supabase
 * start`), not mocked, not e2e. Covers the auth gate, the per-user rate
 * limit, and the ADR-0023 recent-reauth gate (missing token / token
 * belonging to a different user). Every rejection is paired with an
 * admin-API existence check proving the account was never actually deleted.
 *
 * Runs only when `RUN_DB_INTEGRATION=1` AND the local stack answers —
 * `bun run test:db`. See tests/db/README.md.
 */

import { afterAll, describe, expect, test } from 'bun:test';
import { callFunction, createDbTestContext, nativeFetch, resolveUrl, rpc, serviceRoleKey, stackReachable } from '../harness';

const RUN = process.env.RUN_DB_INTEGRATION === '1';
const reachable = RUN ? await stackReachable() : false;

const ENDPOINT = 'delete-account';

async function adminUserExists(id: string): Promise<boolean> {
  const key = await serviceRoleKey();
  const res = await nativeFetch(`${resolveUrl()}/auth/v1/admin/users/${id}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  return res.status === 200;
}

describe.skipIf(!(RUN && reachable))('delete-account — HTTP negative contract (real functions runtime)', () => {
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

  test('429 once the 5/h rate limit is pre-saturated — account is never deleted', async () => {
    // A dedicated throwaway user, never reused by another test, so a real
    // 429 test never risks rate-limiting (or deleting) a still-needed fixture.
    const user = await ctx.createUser();
    await Promise.all(
      Array.from({ length: 5 }, async () => rpc('check_and_increment_rate_limit', {
        p_user_id: user.id,
        p_endpoint: ENDPOINT,
        p_limit: 5,
        p_window_seconds: 3600,
      }, { token: user.token })),
    );

    const res = await callFunction(ENDPOINT, { token: user.token, body: {} });
    expect(res.status).toBe(429);
    expect(await adminUserExists(user.id)).toBe(true);
  });

  test('401 registered user calling with no reauthToken — account is never deleted', async () => {
    const user = await ctx.createUser();
    const res = await callFunction(ENDPOINT, { token: user.token, body: {} });
    expect(res.status).toBe(401);
    expect(await adminUserExists(user.id)).toBe(true);
  });

  test('401 reauthToken belongs to a different user — account is never deleted', async () => {
    const userA = await ctx.createUser();
    const userB = await ctx.createUser();
    const res = await callFunction(ENDPOINT, { token: userA.token, body: { reauthToken: userB.token } });
    expect(res.status).toBe(401);
    expect(await adminUserExists(userA.id)).toBe(true);
  });
});
