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
 *   4. FRESCO-947: the retry sweep (service role) can move a failed PostHog row to `deleted`
 *      only by clearing the id in the same write, can count attempts, and cannot rewrite the
 *      hash, the Stripe outcome or the erasure date.
 *
 * Rows written here stay: the service role is granted insert, select and a column-level
 * update, never delete, on purpose.
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

  describe('retrying a failed PostHog deletion (FRESCO-947)', () => {
    async function insertFailed(): Promise<string> {
      const hash = sha256Hex();
      const inserted = await insertAsService({ user_hash: hash, stripe: 'none', posthog: 'failed', pending_posthog_distinct_id: crypto.randomUUID() });
      expect(inserted.status).toBe(201);
      return hash;
    }

    async function patchAsService(hash: string, changes: Record<string, unknown>) {
      return rest('account_erasures', { method: 'PATCH', serviceRole: true, query: `user_hash=eq.${hash}`, prefer: 'return=minimal', body: changes });
    }

    async function readRow(hash: string) {
      const read = await rest('account_erasures', { serviceRole: true, query: `user_hash=eq.${hash}&select=posthog,pending_posthog_distinct_id,posthog_attempts,posthog_last_attempt_at` });
      return (read.body as Array<{ posthog: string, pending_posthog_distinct_id: string | null, posthog_attempts: number, posthog_last_attempt_at: string | null }>)[0];
    }

    test('a new row starts with no attempts', async () => {
      const hash = await insertFailed();

      expect(await readRow(hash)).toMatchObject({ posthog: 'failed', posthog_attempts: 0, posthog_last_attempt_at: null });
    });

    test('a row leaves failed only by dropping its id in the same write', async () => {
      const hash = await insertFailed();

      const idKept = await patchAsService(hash, { posthog: 'deleted' });
      expect(idKept.status).toBe(400);
      expect((idKept.body as { code?: string }).code).toBe(CHECK_VIOLATION);

      const done = await patchAsService(hash, { posthog: 'deleted', pending_posthog_distinct_id: null, posthog_last_attempt_at: new Date().toISOString() });
      expect(done.status).toBe(204);
      expect(await readRow(hash)).toMatchObject({ posthog: 'deleted', pending_posthog_distinct_id: null });
    });

    test('a failing retry counts an attempt and the row stays failed with its id', async () => {
      const hash = await insertFailed();

      const counted = await patchAsService(hash, { posthog_attempts: 1, posthog_last_attempt_at: new Date().toISOString() });
      expect(counted.status).toBe(204);

      const row = await readRow(hash);
      expect(row).toMatchObject({ posthog: 'failed', posthog_attempts: 1 });
      expect(row.pending_posthog_distinct_id).not.toBeNull();
    });

    test('the attempt counter cannot go negative', async () => {
      const res = await patchAsService(await insertFailed(), { posthog_attempts: -1 });

      expect(res.status).toBe(400);
      expect((res.body as { code?: string }).code).toBe(CHECK_VIOLATION);
    });

    test('the sweep cannot rewrite the hash, the Stripe outcome or the erasure date', async () => {
      const hash = await insertFailed();

      for (const changes of [{ user_hash: sha256Hex() }, { stripe: 'cancelled' }, { erased_at: new Date().toISOString() }]) {
        const res = await patchAsService(hash, changes);
        expect(res.status).toBe(403);
        expect((res.body as { code?: string }).code).toBe(PERMISSION_DENIED);
      }
    });

    test('a signed-in user cannot touch the retry columns', async () => {
      const hash = await insertFailed();

      const res = await rest('account_erasures', { method: 'PATCH', token: user.token, query: `user_hash=eq.${hash}`, prefer: 'return=minimal', body: { posthog_attempts: 99 } });

      expect(res.status).toBe(403);
      expect((await readRow(hash)).posthog_attempts).toBe(0);
    });
  });
});
