/**
 * FRESCO-910 (definitive audit C-06, GDPR art. 17) — `account_erasures`, the record that an
 * account was erased, proven against the real database.
 *
 * Pinned here:
 *   1. The table is closed to every client role: a signed-in user can neither read the
 *      record, forge a row, nor delete one.
 *   2. The service role (`delete-account`'s client) can insert a row and read it back.
 *   3. The shape is enforced by the database: the user hash is a SHA-256 hex digest (a raw
 *      id is refused), and a pending PostHog id exists if and only if the PostHog deletion
 *      failed.
 *
 * Rows written here stay: the service role is granted insert and select only, on purpose.
 *
 * Runs only when `RUN_DB_INTEGRATION=1` AND the local Supabase stack answers —
 * `bun run test:db`. See `tests/db/README.md`.
 */

import type { DbTestUser } from './harness';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { createDbTestContext, rest, stackReachable } from './harness';

const RUN = process.env.RUN_DB_INTEGRATION === '1';
const reachable = RUN ? await stackReachable() : false;

const PERMISSION_DENIED = '42501';
const CHECK_VIOLATION = '23514';

function sha256Hex(): string {
  return `${crypto.randomUUID()}${crypto.randomUUID()}`.replaceAll('-', '').slice(0, 64);
}

async function insertAsService(row: Record<string, unknown>) {
  return rest('account_erasures', { method: 'POST', serviceRole: true, prefer: 'return=minimal', body: row });
}

describe.skipIf(!(RUN && reachable))('account_erasures (real DB)', () => {
  const ctx = createDbTestContext();
  let user: DbTestUser;

  beforeAll(async () => {
    user = await ctx.createUser();
  });

  afterAll(async () => {
    await ctx.cleanupAll();
  });

  test('a signed-in user can neither read, write nor delete the table', async () => {
    const read = await rest('account_erasures', { token: user.token, query: 'select=*' });
    expect(read.status).toBe(403);
    expect((read.body as { code?: string }).code).toBe(PERMISSION_DENIED);

    const write = await rest('account_erasures', {
      method: 'POST',
      token: user.token,
      prefer: 'return=minimal',
      body: { user_hash: sha256Hex(), stripe: 'none', posthog: 'deleted' },
    });
    expect(write.status).toBe(403);
    expect((write.body as { code?: string }).code).toBe(PERMISSION_DENIED);

    const remove = await rest('account_erasures', { method: 'DELETE', token: user.token, query: 'posthog=eq.deleted' });
    expect(remove.status).toBe(403);
  });

  test('the service role can record an erasure and read it back', async () => {
    const hash = sha256Hex();

    const inserted = await insertAsService({ user_hash: hash, stripe: 'cancelled', posthog: 'deleted' });
    expect(inserted.status).toBe(201);

    const read = await rest('account_erasures', { serviceRole: true, query: `user_hash=eq.${hash}&select=stripe,posthog,pending_posthog_distinct_id,erased_at` });
    const rows = read.body as Array<{ stripe: string, posthog: string, pending_posthog_distinct_id: string | null, erased_at: string }>;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ stripe: 'cancelled', posthog: 'deleted', pending_posthog_distinct_id: null });
    expect(Number.isNaN(Date.parse(rows[0].erased_at))).toBe(false);
  });

  test('a raw user id is refused: only a SHA-256 hex digest is accepted', async () => {
    const res = await insertAsService({ user_hash: crypto.randomUUID(), stripe: 'none', posthog: 'deleted' });

    expect(res.status).toBe(400);
    expect((res.body as { code?: string }).code).toBe(CHECK_VIOLATION);
  });

  test('a failed PostHog deletion must keep the id to retry, and nothing else may', async () => {
    const withoutId = await insertAsService({ user_hash: sha256Hex(), stripe: 'none', posthog: 'failed' });
    expect(withoutId.status).toBe(400);
    expect((withoutId.body as { code?: string }).code).toBe(CHECK_VIOLATION);

    const idOnSuccess = await insertAsService({ user_hash: sha256Hex(), stripe: 'none', posthog: 'deleted', pending_posthog_distinct_id: crypto.randomUUID() });
    expect(idOnSuccess.status).toBe(400);
    expect((idOnSuccess.body as { code?: string }).code).toBe(CHECK_VIOLATION);

    const valid = await insertAsService({ user_hash: sha256Hex(), stripe: 'none', posthog: 'failed', pending_posthog_distinct_id: crypto.randomUUID() });
    expect(valid.status).toBe(201);
  });

  test('stripe and posthog only take their documented values', async () => {
    expect((await insertAsService({ user_hash: sha256Hex(), stripe: 'refunded', posthog: 'deleted' })).status).toBe(400);
    expect((await insertAsService({ user_hash: sha256Hex(), stripe: 'none', posthog: 'maybe' })).status).toBe(400);
  });
});
