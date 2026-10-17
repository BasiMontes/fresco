/**
 * FRESCO-1005 (audit 7b: A7-LAUNCH-01) — `pending_confirmation_emails`, the retry queue of the
 * subscription confirmation email, proven against the real database.
 *
 * Pinned here:
 *   1. The table is closed to every client role: a signed-in user cannot read the queue, add a
 *      row to make the cron email someone, or delete a row to stop their own retry.
 *   2. The service role (webhook and cron) can insert, read, update and delete.
 *   3. One row per subscription: a second insert is a unique violation, which is why the
 *      first failure's upsert (`ignoreDuplicates`) can never reset the attempts of an existing row.
 *   4. A row dies with its user (`on delete cascade`), so erasing an account leaves no email address trail
 *      to retry.
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
const UNIQUE_VIOLATION = '23505';
const SUBSCRIPTION_ID = `sub_fresco1005_${Date.now()}`;

async function insertPending(subscriptionId: string, userId: string) {
  return rest('pending_confirmation_emails', {
    method: 'POST',
    serviceRole: true,
    prefer: 'return=minimal',
    body: { subscription_id: subscriptionId, user_id: userId, last_error: 'resend rejected' },
  });
}

async function removePending(subscriptionId: string) {
  return rest('pending_confirmation_emails', { method: 'DELETE', serviceRole: true, query: `subscription_id=eq.${subscriptionId}` });
}

describe.skipIf(!(RUN && reachable))('pending_confirmation_emails (real DB)', () => {
  const ctx = createDbTestContext();
  let user: DbTestUser;

  beforeAll(async () => {
    user = await ctx.createUser();
  });

  afterAll(async () => {
    await removePending(SUBSCRIPTION_ID);
    await ctx.cleanupAll();
  });

  test('a signed-in user can neither read, write nor delete the queue', async () => {
    const read = await rest('pending_confirmation_emails', { token: user.token, query: 'select=*' });
    expect(read.status).toBe(403);
    expect((read.body as { code?: string }).code).toBe(PERMISSION_DENIED);

    const write = await rest('pending_confirmation_emails', {
      method: 'POST',
      token: user.token,
      prefer: 'return=minimal',
      body: { subscription_id: 'sub_forged', user_id: user.id },
    });
    expect(write.status).toBe(403);
    expect((write.body as { code?: string }).code).toBe(PERMISSION_DENIED);

    const remove = await rest('pending_confirmation_emails', { method: 'DELETE', token: user.token, query: 'subscription_id=eq.sub_forged' });
    expect(remove.status).toBe(403);
  });

  test('the service role queues a subscription once, with one attempt and a timestamp', async () => {
    const first = await insertPending(SUBSCRIPTION_ID, user.id);
    expect(first.status).toBe(201);

    const read = await rest('pending_confirmation_emails', { serviceRole: true, query: `subscription_id=eq.${SUBSCRIPTION_ID}&select=attempts,last_error,created_at,last_attempt_at` });
    const [row] = read.body as Array<{ attempts: number, last_error: string, created_at: string, last_attempt_at: string }>;
    expect(row.attempts).toBe(1);
    expect(row.last_error).toBe('resend rejected');
    expect(row.created_at).toBeString();
    expect(row.last_attempt_at).toBeString();
  });

  test('a second insert for the same subscription is a unique violation', async () => {
    const second = await insertPending(SUBSCRIPTION_ID, user.id);

    expect(second.status).toBe(409);
    expect((second.body as { code?: string }).code).toBe(UNIQUE_VIOLATION);
  });

  test('the retry pass can count another attempt, and an attempt below 1 is refused', async () => {
    const bump = await rest('pending_confirmation_emails', {
      method: 'PATCH',
      serviceRole: true,
      prefer: 'return=minimal',
      query: `subscription_id=eq.${SUBSCRIPTION_ID}`,
      body: { attempts: 2, last_attempt_at: new Date().toISOString() },
    });
    expect(bump.status).toBe(204);

    const invalid = await rest('pending_confirmation_emails', {
      method: 'PATCH',
      serviceRole: true,
      prefer: 'return=minimal',
      query: `subscription_id=eq.${SUBSCRIPTION_ID}`,
      body: { attempts: 0 },
    });
    expect(invalid.status).toBe(400);
  });

  test('a row is deleted when its user is', async () => {
    const mortal = await ctx.createUser();
    const subscriptionId = `${SUBSCRIPTION_ID}_cascade`;
    expect((await insertPending(subscriptionId, mortal.id)).status).toBe(201);

    await ctx.cleanupAll();

    const left = await rest('pending_confirmation_emails', { serviceRole: true, query: `subscription_id=eq.${subscriptionId}&select=subscription_id` });
    expect(left.body).toEqual([]);
  });
});
