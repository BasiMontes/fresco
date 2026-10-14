/**
 * FRESCO-919 (definitive audit C-15, ADR-0044) — `user_profiles.analytics_consent` holds the
 * cookie-banner decision so server-side PostHog events can honour it. Proven against the real
 * database:
 *   1. It starts as null (never synced), which the server treats as "no consent".
 *   2. The owner can write true and false with their own session.
 *   3. Another user cannot change it (RLS: zero rows touched, value unchanged).
 *   4. The service role, which the webhook and the Edge Functions use, can read it.
 *
 * Runs only when `RUN_DB_INTEGRATION=1` AND the local Supabase stack answers —
 * `bun run test:db`. See `tests/db/README.md`.
 */

import type { DbTestUser } from './harness';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { createDbTestContext, rest, stackReachable } from './harness';

const RUN = process.env.RUN_DB_INTEGRATION === '1';
const reachable = RUN ? await stackReachable() : false;

describe.skipIf(!(RUN && reachable))('user_profiles.analytics_consent (real DB)', () => {
  const ctx = createDbTestContext();
  let owner: DbTestUser;
  let other: DbTestUser;

  beforeAll(async () => {
    owner = await ctx.createUser();
    other = await ctx.createUser();
  });

  afterAll(async () => {
    await ctx.cleanupAll();
  });

  const write = async (user: DbTestUser, target: DbTestUser, value: boolean | null) =>
    rest('user_profiles', { method: 'PATCH', token: user.token, prefer: 'return=representation', query: `id=eq.${target.id}`, body: { analytics_consent: value } });

  const readAsService = async (user: DbTestUser) =>
    ((await rest('user_profiles', { serviceRole: true, query: `id=eq.${user.id}&select=analytics_consent` })).body as Array<{ analytics_consent: boolean | null }>)[0].analytics_consent;

  test('starts as null (never synced)', async () => {
    expect(await readAsService(owner)).toBeNull();
  });

  test('the owner can record an acceptance and then a rejection', async () => {
    expect((await write(owner, owner, true)).status).toBeLessThan(300);
    expect(await readAsService(owner)).toBe(true);

    expect((await write(owner, owner, false)).status).toBeLessThan(300);
    expect(await readAsService(owner)).toBe(false);
  });

  test('another user cannot change someone else\'s decision', async () => {
    await write(owner, owner, false);

    const result = await write(other, owner, true);

    expect(result.body).toEqual([]);
    expect(await readAsService(owner)).toBe(false);
  });
});
