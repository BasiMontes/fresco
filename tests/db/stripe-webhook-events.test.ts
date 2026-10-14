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
import { createClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { claimWebhookEvent, completeWebhookEvent, releaseWebhookEvent, WEBHOOK_CLAIM_TTL_MS } from '@/lib/billing/webhook-events';
import { createDbTestContext, nativeFetch, resolveUrl, rest, serviceRoleKey, stackReachable } from './harness';

const RUN = process.env.RUN_DB_INTEGRATION === '1';
const reachable = RUN ? await stackReachable() : false;

const PERMISSION_DENIED = '42501';
const UNIQUE_VIOLATION = '23505';
const EVENT_ID = `evt_fresco816_${Date.now()}`;
const LIB_EVENT_ID = `evt_fresco909_lib_${Date.now()}`;
const LIB_RACE_EVENT_ID = `evt_fresco909_race_${Date.now()}`;
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
    await release(LIB_EVENT_ID);
    await release(LIB_RACE_EVENT_ID);
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

  describe('claimWebhookEvent against the real database (FRESCO-909)', () => {
    async function serviceClient() {
      return createClient(resolveUrl(), await serviceRoleKey(), { global: { fetch: nativeFetch }, auth: { persistSession: false } });
    }
    // The claim ages past the TTL by moving the library's clock, so the stored claimed_at
    // keeps the microseconds the default now() gave it: the compare-and-swap must match them.
    const future = () => Date.now() + WEBHOOK_CLAIM_TTL_MS + 60_000;
    const seedWithDefaultNow = async (eventId: string) => rest('stripe_webhook_events', {
      method: 'POST',
      serviceRole: true,
      prefer: 'return=minimal',
      body: { event_id: eventId, event_type: 'checkout.session.completed' },
    });
    const readRow = async (eventId: string) => {
      const res = await rest('stripe_webhook_events', { serviceRole: true, query: `event_id=eq.${eventId}&select=claimed_at,completed_at` });
      return (res.body as Array<{ claimed_at: string, completed_at: string | null }>)[0];
    };

    test('a claim stamped by the default now() is taken over once expired: the timestamptz equality round-trips through PostgREST', async () => {
      const client = await serviceClient();
      expect((await seedWithDefaultNow(LIB_EVENT_ID)).status).toBe(201);

      const fresh = await claimWebhookEvent(client, { eventId: LIB_EVENT_ID, eventType: 'checkout.session.completed' });
      expect(fresh.state).toBe('in_flight');

      const result = await claimWebhookEvent(client, { eventId: LIB_EVENT_ID, eventType: 'checkout.session.completed', now: future() });
      expect(result.state).toBe('taken_over');
      if (result.state !== 'taken_over') {
        throw new Error('unreachable');
      }
      expect(new Date((await readRow(LIB_EVENT_ID)).claimed_at).getTime()).toBe(new Date(result.claimedAt).getTime());
    });

    test('a stale worker cannot release or complete the claim that replaced its own; the holder can complete it', async () => {
      const client = await serviceClient();
      const before = await readRow(LIB_EVENT_ID);
      const stale = { eventId: LIB_EVENT_ID, claimedAt: new Date(new Date(before.claimed_at).getTime() - 600_000).toISOString() };

      await releaseWebhookEvent(client, stale);
      await completeWebhookEvent(client, stale);
      const after = await readRow(LIB_EVENT_ID);
      expect(after).toEqual(before);

      await completeWebhookEvent(client, { eventId: LIB_EVENT_ID, claimedAt: before.claimed_at });
      expect((await readRow(LIB_EVENT_ID)).completed_at).not.toBeNull();
      const done = await claimWebhookEvent(client, { eventId: LIB_EVENT_ID, eventType: 'checkout.session.completed', now: future() });
      expect(done.state).toBe('already_done');
    });

    test('two concurrent takeovers of one expired claim: exactly one is taken_over', async () => {
      const client = await serviceClient();
      expect((await seedWithDefaultNow(LIB_RACE_EVENT_ID)).status).toBe(201);

      const results = await Promise.all(Array.from({ length: 2 }, async () => claimWebhookEvent(client, { eventId: LIB_RACE_EVENT_ID, eventType: 'customer.subscription.updated', now: future() })));

      expect(results.filter(r => r.state === 'taken_over')).toHaveLength(1);
      expect(results.filter(r => r.state === 'in_flight')).toHaveLength(1);
    });
  });
});
