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
 *   4. FRESCO-909: a claim carries `claimed_at` / `completed_at`; the service role can UPDATE
 *      it; the takeover compare-and-swap lets exactly one of several concurrent workers win;
 *      the migration's backfill is guarded so re-applying it cannot complete an in-flight claim.
 *
 * Runs only when `RUN_DB_INTEGRATION=1` AND the local Supabase stack answers —
 * `bun run test:db`. See `tests/db/README.md`.
 */

import type { DbTestUser } from './harness';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { createDbTestContext, rest, stackReachable } from './harness';

const RUN = process.env.RUN_DB_INTEGRATION === '1';
const reachable = RUN ? await stackReachable() : false;

const PERMISSION_DENIED = '42501';
const UNIQUE_VIOLATION = '23505';
const EVENT_ID = `evt_fresco816_${Date.now()}`;
const CAS_EVENT_ID = `evt_fresco909_${Date.now()}`;
const MIGRATION = 'supabase/migrations/20261012110000_stripe_webhook_events_claim_state.sql';

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
    await release(CAS_EVENT_ID);
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

  test('FRESCO-909: a fresh claim is stamped claimed_at, has no completed_at, and the service role can complete it', async () => {
    const read = async () => {
      const res = await rest('stripe_webhook_events', { serviceRole: true, query: `event_id=eq.${EVENT_ID}&select=claimed_at,completed_at` });
      return (res.body as Array<{ claimed_at: string | null, completed_at: string | null }>)[0];
    };
    const before = await read();
    expect(before.claimed_at).not.toBeNull();
    expect(before.completed_at).toBeNull();

    const done = await rest('stripe_webhook_events', {
      method: 'PATCH',
      serviceRole: true,
      prefer: 'return=minimal',
      query: `event_id=eq.${EVENT_ID}`,
      body: { completed_at: new Date().toISOString() },
    });
    expect(done.status).toBe(204);
    expect((await read()).completed_at).not.toBeNull();
  });

  test('FRESCO-909: neither anon nor a signed-in user can update a claim (so they cannot complete or retake one)', async () => {
    for (const token of [undefined, user.token]) {
      const res = await rest('stripe_webhook_events', {
        method: 'PATCH',
        token,
        prefer: 'return=representation',
        query: `event_id=eq.${EVENT_ID}`,
        body: { completed_at: null },
      });
      expect([401, 403]).toContain(res.status);
    }
    const anonRead = await rest('stripe_webhook_events', { query: 'select=*' });
    expect([401, 403]).toContain(anonRead.status);
  });

  test('FRESCO-909: of several concurrent takeovers of the same expired claim exactly one wins', async () => {
    const observed = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const seed = await rest('stripe_webhook_events', {
      method: 'POST',
      serviceRole: true,
      prefer: 'return=minimal',
      body: { event_id: CAS_EVENT_ID, event_type: 'customer.subscription.updated', claimed_at: observed },
    });
    expect(seed.status).toBe(201);

    const attempts = await Promise.all(Array.from({ length: 8 }, async () => rest('stripe_webhook_events', {
      method: 'PATCH',
      serviceRole: true,
      prefer: 'return=representation',
      query: `event_id=eq.${CAS_EVENT_ID}&completed_at=is.null&claimed_at=eq.${encodeURIComponent(observed)}`,
      body: { claimed_at: new Date().toISOString() },
    })));

    const winners = attempts.filter(a => Array.isArray(a.body) && a.body.length === 1);
    expect(attempts.every(a => a.status === 200)).toBe(true);
    expect(winners).toHaveLength(1);
  });

  test('FRESCO-909: the migration backfills only when it creates the columns, so re-applying never completes an in-flight claim', () => {
    const sql = readFileSync(MIGRATION, 'utf8');
    const guard = sql.indexOf('if not exists (');
    const backfill = sql.indexOf('set claimed_at = processed_at, completed_at = processed_at');
    const endIf = sql.indexOf('end if;');

    expect(guard).toBeGreaterThan(-1);
    expect(backfill).toBeGreaterThan(guard);
    expect(backfill).toBeLessThan(endIf);
    expect(sql).toContain('grant select, insert, update, delete on public.stripe_webhook_events to service_role');
  });
});
