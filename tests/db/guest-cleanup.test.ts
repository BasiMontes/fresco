/**
 * FRESCO-1008 (audit 7b A7-PRIV-05) — `cleanup_abandoned_guests` against the real database.
 *   1. It deletes the guests older than the age it is given (the cron job uses 3 days) and leaves
 *      real accounts alone.
 *   2. For every guest it deletes it queues the PostHog erasure `retry-posthog-erasures` works from:
 *      an `account_erasures` row with `posthog = 'failed'` and the user id as the pending distinct id.
 *   3. Nothing but the service role can run it.
 *
 * `p_max_age` is `0 seconds` here so the test guest qualifies; that deletes EVERY guest in the
 * local stack, which is why this file must not run next to another one that holds a live guest
 * (`bun test` runs files one after another). Runs only with `RUN_DB_INTEGRATION=1`.
 */

import { createHash } from 'node:crypto';
import { describe, expect, test } from 'bun:test';
import { anonKey, createDbTestContext, nativeFetch, resolveUrl, rest, rpc, stackReachable } from './harness';

const RUN = process.env.RUN_DB_INTEGRATION === '1';
const reachable = RUN ? await stackReachable() : false;

const PERMISSION_DENIED = '42501';
const code = (res: { body: unknown }) => (res.body as { code?: string }).code;

async function createGuest(): Promise<{ id: string, token: string }> {
  const res = await nativeFetch(`${resolveUrl()}/auth/v1/signup`, {
    method: 'POST',
    headers: { 'apikey': await anonKey(), 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    throw new Error(`[guest-cleanup.test] anonymous sign-in failed: ${res.status} ${await res.text()}`);
  }
  const json = await res.json() as { access_token: string, user: { id: string } };
  return { id: json.user.id, token: json.access_token };
}

describe.skipIf(!(RUN && reachable))('cleanup_abandoned_guests (real DB)', () => {
  const ctx = createDbTestContext();

  test('deletes the guest, keeps the real account, and queues the guest\'s PostHog erasure', async () => {
    const guest = await createGuest();
    const account = await ctx.createUser();

    const res = await rpc('cleanup_abandoned_guests', { p_max_age: '0 seconds' }, { serviceRole: true });
    expect(res.status).toBe(200);
    expect(res.body as number).toBeGreaterThanOrEqual(1);

    const hash = createHash('sha256').update(guest.id).digest('hex');
    const queued = await rest('account_erasures', { serviceRole: true, query: `user_hash=eq.${hash}&select=posthog,pending_posthog_distinct_id,stripe` });
    expect(queued.body).toEqual([{ posthog: 'failed', pending_posthog_distinct_id: guest.id, stripe: 'none' }]);

    const remaining = await rest('user_profiles', { token: account.token, query: `id=eq.${account.id}&select=id` });
    expect(remaining.body).toEqual([{ id: account.id }]);
    await ctx.cleanupAll();
  });

  test('a guest younger than the age is left alone and queues nothing', async () => {
    const guest = await createGuest();

    await rpc('cleanup_abandoned_guests', {}, { serviceRole: true });

    const hash = createHash('sha256').update(guest.id).digest('hex');
    const queued = await rest('account_erasures', { serviceRole: true, query: `user_hash=eq.${hash}&select=id` });
    expect(queued.body).toEqual([]);
    const key = await anonKey();
    const still = await nativeFetch(`${resolveUrl()}/auth/v1/user`, { headers: { apikey: key, Authorization: `Bearer ${guest.token}` } });
    expect(still.status).toBe(200);
  });

  test('is not executable by anon or authenticated', async () => {
    const user = await ctx.createUser();

    expect(code(await rpc('cleanup_abandoned_guests', {}))).toBe(PERMISSION_DENIED);
    expect(code(await rpc('cleanup_abandoned_guests', {}, { token: user.token }))).toBe(PERMISSION_DENIED);
    await ctx.cleanupAll();
  });
});
