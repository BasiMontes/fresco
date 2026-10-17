/**
 * FRESCO-1001 (audit 7b: A7-PAY-01) — the schema the Stripe mode guard stands on, proven against
 * the real database. ADR-0061.
 *
 * Every environment shares one Supabase project, so the Stripe mode has to be a fact of the
 * database, not of the deploy that happens to receive an event:
 *
 *   1. `billing_mode`, the mode this database serves, is closed to every client role: a signed-in
 *      user or an anonymous caller cannot read it, flip it to make test events acceptable, or write
 *      a second row. The service role (the webhook) reads exactly one row, and cannot write it:
 *      the owner flips it once at go-live with `supabase db query --linked`.
 *   2. `user_profiles.stripe_livemode`, the mode of the Stripe ids on a profile, is written by the
 *      webhook only: the owner of the profile cannot set it (ADR-0007), nor can a new profile be
 *      inserted with it, while the service role can.
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
const RAISED = 'P0001';

function code(body: unknown): string | undefined {
  return (body as { code?: string }).code;
}

describe.skipIf(!(RUN && reachable))('Stripe mode guard schema (real DB)', () => {
  const ctx = createDbTestContext();
  let user: DbTestUser;

  beforeAll(async () => {
    user = await ctx.createUser();
  });

  afterAll(async () => ctx.cleanupAll());

  test('billing_mode is closed to a signed-in user: no read, no flip, no second row', async () => {
    const read = await rest('billing_mode', { token: user.token, query: 'select=*' });
    expect(read.status).toBe(403);
    expect(code(read.body)).toBe(PERMISSION_DENIED);

    const flip = await rest('billing_mode', { method: 'PATCH', token: user.token, query: 'singleton=eq.true', prefer: 'return=minimal', body: { stripe_livemode: true } });
    expect(flip.status).toBe(403);
    expect(code(flip.body)).toBe(PERMISSION_DENIED);

    const second = await rest('billing_mode', { method: 'POST', token: user.token, prefer: 'return=minimal', body: { singleton: false, stripe_livemode: true } });
    expect(second.status).toBe(403);
    expect(code(second.body)).toBe(PERMISSION_DENIED);
  });

  test('billing_mode is closed to an anonymous caller', async () => {
    const read = await rest('billing_mode', { query: 'select=*' });
    expect(read.status).toBe(401);
  });

  test('the service role reads exactly one row, in test mode, and cannot write it', async () => {
    const read = await rest('billing_mode', { serviceRole: true, query: 'select=singleton,stripe_livemode' });
    expect(read.status).toBe(200);
    expect(read.body).toEqual([{ singleton: true, stripe_livemode: false }]);

    const flip = await rest('billing_mode', { method: 'PATCH', serviceRole: true, query: 'singleton=eq.true', prefer: 'return=minimal', body: { stripe_livemode: true } });
    expect(flip.status).toBe(403);
    expect(code(flip.body)).toBe(PERMISSION_DENIED);

    const second = await rest('billing_mode', { method: 'POST', serviceRole: true, prefer: 'return=minimal', body: { singleton: false, stripe_livemode: true } });
    expect(second.status).toBe(403);
    expect(code(second.body)).toBe(PERMISSION_DENIED);
  });

  test('the owner of a profile cannot set stripe_livemode', async () => {
    const own = await rest('user_profiles', {
      method: 'PATCH',
      token: user.token,
      query: `id=eq.${user.id}`,
      prefer: 'return=minimal',
      body: { stripe_livemode: true },
    });

    expect(own.status).toBe(400);
    expect(code(own.body)).toBe(RAISED);
    expect((own.body as { message?: string }).message ?? '').toContain('managed by the Stripe webhook');
  });

  test('a profile cannot be inserted with stripe_livemode', async () => {
    // The BEFORE INSERT trigger runs before the unique check, so this row (which already exists)
    // is refused by the trigger and not by a duplicate-key error.
    const insert = await rest('user_profiles', {
      method: 'POST',
      token: user.token,
      prefer: 'return=minimal',
      body: { id: user.id, stripe_livemode: true },
    });

    expect(insert.status).toBe(400);
    expect(code(insert.body)).toBe(RAISED);
    expect((insert.body as { message?: string }).message ?? '').toContain('managed by the Stripe webhook');
  });

  test('the service role (the webhook) can set it, next to the Stripe ids', async () => {
    const set = await rest('user_profiles', {
      method: 'PATCH',
      serviceRole: true,
      query: `id=eq.${user.id}`,
      prefer: 'return=representation',
      body: { stripe_customer_id: `cus_fresco1001_${Date.now()}`, stripe_livemode: false },
    });

    expect(set.status).toBe(200);
    expect((set.body as { stripe_livemode: boolean }[])[0].stripe_livemode).toBe(false);
  });
});
