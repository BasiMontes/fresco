/**
 * FRESCO-779 (audit-6 A6-S2) — `push_subscriptions` accepts only real Web Push
 * endpoints from non-guest accounts, proven against the real database.
 *
 * Before this, `push_subscriptions` only had `UNIQUE(endpoint)`: any signed-in
 * caller, guests included, could store an arbitrary URL, and the weekly
 * re-engagement function (service role, every Sunday) would POST a signed VAPID
 * request to it — a blind SSRF — one row at a time with no timeout, so a slow
 * attacker-controlled server stalled the whole batch.
 *
 * Pinned here:
 *   1. The endpoint CHECK accepts the real push services and rejects everything
 *      else, and agrees with the TypeScript copy the sender uses
 *      (`supabase/functions/_shared/push-endpoint.ts`) on the same vectors.
 *   2. Key material has a bounded base64url shape.
 *   3. A user is capped at 10 subscriptions.
 *   4. A guest (anonymous) session cannot insert at all.
 *
 * Runs only when `RUN_DB_INTEGRATION=1` AND the local Supabase stack answers —
 * `bun run test:db`. See `tests/db/README.md`.
 */

import type { DbTestUser } from './harness';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { isAllowedPushEndpoint, MAX_PUSH_ENDPOINT_LENGTH } from '../../supabase/functions/_shared/push-endpoint';
import { ALLOWED_PUSH_ENDPOINTS, REJECTED_PUSH_ENDPOINTS } from '../../supabase/functions/_shared/push-endpoint.fixtures';
import { anonKey, createDbTestContext, nativeFetch, resolveUrl, rest, serviceRoleKey, stackReachable } from './harness';

const RUN = process.env.RUN_DB_INTEGRATION === '1';
const reachable = RUN ? await stackReachable() : false;

const CHECK_VIOLATION = '23514';
const PERMISSION_DENIED = '42501';

/** A well-formed P-256 public key and auth secret (base64url, as `PushSubscription.toJSON()` returns them). */
const P256DH = `B${'A'.repeat(86)}`;
const AUTH = 'A'.repeat(22);

/** Makes a vector unique per run (the table has UNIQUE(endpoint)) without changing its host or scheme. */
function unique(endpoint: string): string {
  const stamp = crypto.randomUUID();
  return endpoint.includes('?') ? `${endpoint}&n=${stamp}` : `${endpoint}?n=${stamp}`;
}

async function insertSubscription(user: DbTestUser, body: Record<string, unknown>) {
  return rest('push_subscriptions', {
    method: 'POST',
    token: user.token,
    prefer: 'return=minimal',
    body: { user_id: user.id, endpoint: 'https://fcm.googleapis.com/fcm/send/default', p256dh: P256DH, auth: AUTH, ...body },
  });
}

async function createGuest(): Promise<{ id: string, token: string }> {
  const res = await nativeFetch(`${resolveUrl()}/auth/v1/signup`, {
    method: 'POST',
    headers: { 'apikey': await anonKey(), 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    throw new Error(`[push-subscriptions-validation.test] anonymous sign-in failed: ${res.status} ${await res.text()}`);
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

describe.skipIf(!(RUN && reachable))('push_subscriptions validation (real DB)', () => {
  const ctx = createDbTestContext();
  const guestIds: string[] = [];
  let user: DbTestUser;

  beforeAll(async () => {
    user = await ctx.createUser();
  });

  afterAll(async () => {
    await Promise.all(guestIds.map(async id => deleteAuthUser(id)));
    await ctx.cleanupAll();
  });

  test.each(ALLOWED_PUSH_ENDPOINTS.map((e, i) => [i, e] as const))('accepts the real push service endpoint #%i', async (_i, endpoint) => {
    // Each insert uses its own user so the 10-per-user cap never interferes.
    const owner = await ctx.createUser();
    const res = await insertSubscription(owner, { endpoint: unique(endpoint) });
    expect(res.status).toBe(201);
  });

  test.each(REJECTED_PUSH_ENDPOINTS.map((e, i) => [i, e] as const))('rejects the non-push endpoint vector #%i with a check violation', async (_i, endpoint) => {
    const res = await insertSubscription(user, { endpoint: endpoint === '' ? '' : unique(endpoint) });
    expect(res.status).toBe(400);
    expect((res.body as { code?: string }).code).toBe(CHECK_VIOLATION);
  });

  test('the database and the sender agree on every vector', async () => {
    const verdicts = await Promise.all([...ALLOWED_PUSH_ENDPOINTS, ...REJECTED_PUSH_ENDPOINTS].map(async (endpoint) => {
      const owner = await ctx.createUser();
      const res = await insertSubscription(owner, { endpoint: endpoint === '' ? '' : unique(endpoint) });
      return { endpoint, db: res.status === 201, sender: isAllowedPushEndpoint(endpoint) };
    }));
    expect(verdicts.filter(v => v.db !== v.sender)).toEqual([]);
  });

  test('rejects an endpoint longer than the cap', async () => {
    const endpoint = `https://fcm.googleapis.com/${'a'.repeat(MAX_PUSH_ENDPOINT_LENGTH)}`;
    const res = await insertSubscription(user, { endpoint });
    expect(res.status).toBe(400);
    expect((res.body as { code?: string }).code).toBe(CHECK_VIOLATION);
  });

  test.each([
    ['p256dh with characters outside base64url', { p256dh: 'not base64 !!' }],
    ['p256dh far longer than a P-256 key', { p256dh: 'A'.repeat(500) }],
    ['empty auth secret', { auth: '' }],
    ['auth with characters outside base64url', { auth: '<script>' }],
  ])('rejects %s', async (_name, override) => {
    const res = await insertSubscription(user, { endpoint: unique('https://fcm.googleapis.com/fcm/send/keys'), ...override });
    expect(res.status).toBe(400);
    expect((res.body as { code?: string }).code).toBe(CHECK_VIOLATION);
  });

  test('a user cannot hold more than 10 subscriptions', async () => {
    const owner = await ctx.createUser();
    for (let i = 0; i < 10; i++) {
      expect((await insertSubscription(owner, { endpoint: unique('https://fcm.googleapis.com/fcm/send/cap') })).status).toBe(201);
    }

    const res = await insertSubscription(owner, { endpoint: unique('https://fcm.googleapis.com/fcm/send/cap') });
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toContain('limit');

    // Another account is unaffected by this user's cap.
    expect((await insertSubscription(user, { endpoint: unique('https://fcm.googleapis.com/fcm/send/other') })).status).toBe(201);
  });

  test('a guest (anonymous) session cannot subscribe', async () => {
    const guest = await createGuest();
    guestIds.push(guest.id);
    // The guest has a profile row like any session that went through onboarding, so a
    // rejection here is the INSERT policy, not the foreign key.
    const profile = await rest('user_profiles', { method: 'POST', token: guest.token, prefer: 'return=minimal', body: { id: guest.id } });
    expect(profile.status).toBe(201);

    const res = await insertSubscription({ id: guest.id, email: '', token: guest.token }, { endpoint: unique('https://fcm.googleapis.com/fcm/send/guest') });
    expect(res.status).toBe(403);
    expect((res.body as { code?: string }).code).toBe(PERMISSION_DENIED);
  });
});
