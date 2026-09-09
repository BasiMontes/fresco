/**
 * FRESCO-464 PR2 — HTTP negative-contract tests for reassign-guest-data.
 *
 * Real HTTP against the local Supabase Edge Functions runtime (`supabase
 * start`), not mocked, not e2e. Covers the guest-only gate, the per-guest
 * rate limit, and every rejection branch of the ADR-0022 ownership proof
 * (missing / garbage / non-registered `targetAccessToken`).
 *
 * This function's caller must be an anonymous (guest) session — the harness's
 * `createDbTestContext()` only creates registered (email+password) users, so
 * this file creates its own throwaway anonymous sessions via GoTrue's
 * anonymous sign-in endpoint (`POST /auth/v1/signup` with an empty body,
 * `supabase/config.toml`'s `enable_anonymous_sign_ins = true`; ADR-0003).
 * Every anonymous user created here is tracked and deleted in `afterAll`,
 * same posture as `createDbTestContext`'s cascade cleanup.
 *
 * Runs only when `RUN_DB_INTEGRATION=1` AND the local stack answers —
 * `bun run test:db`. See tests/db/README.md.
 */

import { afterAll, describe, expect, test } from 'bun:test';
import { anonKey, callFunction, createDbTestContext, nativeFetch, resolveUrl, rpc, serviceRoleKey, stackReachable } from '../harness';

const RUN = process.env.RUN_DB_INTEGRATION === '1';
const reachable = RUN ? await stackReachable() : false;

const ENDPOINT = 'reassign-guest-data';

interface GuestSession {
  id: string
  token: string
}

async function createGuestSession(): Promise<GuestSession> {
  const res = await nativeFetch(`${resolveUrl()}/auth/v1/signup`, {
    method: 'POST',
    headers: { 'apikey': await anonKey(), 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    throw new Error(`[reassign-guest-data.test] anonymous sign-in failed: ${res.status} ${await res.text()}`);
  }
  const json = await res.json() as { access_token: string, user: { id: string } };
  return { id: json.user.id, token: json.access_token };
}

async function deleteAuthUser(id: string): Promise<void> {
  const key = await serviceRoleKey();
  await nativeFetch(`${resolveUrl()}/auth/v1/admin/users/${id}`, {
    method: 'DELETE',
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
}

describe.skipIf(!(RUN && reachable))('reassign-guest-data — HTTP negative contract (real functions runtime)', () => {
  const ctx = createDbTestContext();
  const guestIds: string[] = [];

  const createGuest = async (): Promise<GuestSession> => {
    const guest = await createGuestSession();
    guestIds.push(guest.id);
    return guest;
  };

  afterAll(async () => {
    await Promise.all(guestIds.map(async id => deleteAuthUser(id)));
    await ctx.cleanupAll();
  });

  test('401 when called with no token', async () => {
    const res = await callFunction(ENDPOINT, {});
    expect(res.status).toBe(401);
  });

  test('401 when called with a garbage token', async () => {
    const res = await callFunction(ENDPOINT, { token: 'not-a-real-jwt' });
    expect(res.status).toBe(401);
  });

  test('400 when the caller is not an anonymous (guest) session', async () => {
    const registered = await ctx.createUser();
    const res = await callFunction(ENDPOINT, { token: registered.token, body: { targetAccessToken: 'whatever' } });
    expect(res.status).toBe(400);
    expect(res.body).not.toEqual({ reassigned: true });
  });

  test('429 once the 5/h per-guest rate limit is pre-saturated', async () => {
    const guest = await createGuest();
    await Promise.all(
      Array.from({ length: 5 }, async () => rpc('check_and_increment_rate_limit', {
        p_user_id: guest.id,
        p_endpoint: ENDPOINT,
        p_limit: 5,
        p_window_seconds: 3600,
      }, { token: guest.token })),
    );

    const res = await callFunction(ENDPOINT, { token: guest.token, body: { targetAccessToken: 'whatever' } });
    expect(res.status).toBe(429);
    expect(res.body).not.toEqual({ reassigned: true });
  });

  test('400 when targetAccessToken is missing', async () => {
    const guest = await createGuest();
    const res = await callFunction(ENDPOINT, { token: guest.token, body: {} });
    expect(res.status).toBe(400);
    expect(res.body).not.toEqual({ reassigned: true });
  });

  test('401 when targetAccessToken is garbage', async () => {
    const guest = await createGuest();
    const res = await callFunction(ENDPOINT, { token: guest.token, body: { targetAccessToken: 'not-a-real-jwt' } });
    expect(res.status).toBe(401);
    expect(res.body).not.toEqual({ reassigned: true });
  });

  test('400 when targetAccessToken belongs to another anonymous session', async () => {
    const guest = await createGuest();
    const otherGuest = await createGuest();
    const res = await callFunction(ENDPOINT, { token: guest.token, body: { targetAccessToken: otherGuest.token } });
    expect(res.status).toBe(400);
    expect(res.body).not.toEqual({ reassigned: true });
  });
});
