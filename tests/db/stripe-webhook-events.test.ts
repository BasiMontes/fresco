/**
 * FRESCO-816 (audit-6 A6-S10) — `stripe_webhook_events`, the webhook's idempotency key,
 * proven against the real database.
 *
 * Pinned here:
 *   1. The table is closed to every client role: a signed-in user cannot read it, write a
 *      fake "already processed" row to make the webhook skip a real event, or delete one.
 *   2. The service role (the webhook's client) can claim an event id once; claiming it again
 *      is a unique violation, which is what `claimWebhookEvent` turns into "already done".
 *   3. A released event can be claimed again, so a resend of a failed event still runs.
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
const EVENT_ID = `evt_fresco816_${Date.now()}`;

async function claim(eventId: string) {
  return rest('stripe_webhook_events', {
    method: 'POST',
    serviceRole: true,
    prefer: 'return=minimal',
    body: { event_id: eventId, event_type: 'checkout.session.completed' },
  });
}

async function release(eventId: string) {
  return rest('stripe_webhook_events', {
    method: 'DELETE',
    serviceRole: true,
    query: `event_id=eq.${eventId}`,
  });
}

describe.skipIf(!(RUN && reachable))('stripe_webhook_events (real DB)', () => {
  const ctx = createDbTestContext();
  let user: DbTestUser;

  beforeAll(async () => {
    user = await ctx.createUser();
  });

  afterAll(async () => {
    await release(EVENT_ID);
    await ctx.cleanupAll();
  });

  test('a signed-in user can neither read, write nor delete the table', async () => {
    const read = await rest('stripe_webhook_events', { token: user.token, query: 'select=*' });
    expect(read.status).toBe(403);
    expect((read.body as { code?: string }).code).toBe(PERMISSION_DENIED);

    const write = await rest('stripe_webhook_events', {
      method: 'POST',
      token: user.token,
      prefer: 'return=minimal',
      body: { event_id: 'evt_forged', event_type: 'customer.subscription.deleted' },
    });
    expect(write.status).toBe(403);
    expect((write.body as { code?: string }).code).toBe(PERMISSION_DENIED);

    const remove = await rest('stripe_webhook_events', { method: 'DELETE', token: user.token, query: 'event_id=eq.evt_forged' });
    expect(remove.status).toBe(403);
  });

  test('an event id is claimed once; claiming it again is a unique violation', async () => {
    const first = await claim(EVENT_ID);
    expect(first.status).toBe(201);

    const second = await claim(EVENT_ID);
    expect(second.status).toBe(409);
    expect((second.body as { code?: string }).code).toBe(UNIQUE_VIOLATION);
  });

  test('a released event can be claimed again', async () => {
    await release(EVENT_ID);

    const again = await claim(EVENT_ID);
    expect(again.status).toBe(201);
  });
});
