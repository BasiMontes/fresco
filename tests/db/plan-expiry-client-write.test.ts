/**
 * FRESCO-1313/QAFRESCO-7 — the reconcile sweep keeps a Pro row with no Stripe
 * subscription while its `plan_expires_at` is in the future. That is only safe if
 * no client can write that column, so it is proven here against the real database
 * (`protect_subscription_columns`, ADR-0007), on UPDATE and on INSERT.
 *
 * Runs only when `RUN_DB_INTEGRATION=1` AND the local Supabase stack answers —
 * `bun run test:db`. See `tests/db/README.md`.
 */

import type { DbTestUser } from './harness';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { createDbTestContext, rest, stackReachable } from './harness';

const RUN = process.env.RUN_DB_INTEGRATION === '1';
const reachable = RUN ? await stackReachable() : false;

const RAISED = 'P0001';

function failure(body: unknown): { code?: string, message?: string } {
  return body as { code?: string, message?: string };
}

describe.skipIf(!(RUN && reachable))('plan_expires_at is closed to clients (real DB)', () => {
  const ctx = createDbTestContext();
  let user: DbTestUser;
  const future = new Date(Date.now() + 30 * 86_400_000).toISOString();

  beforeAll(async () => {
    user = await ctx.createUser();
  });

  afterAll(async () => ctx.cleanupAll());

  async function patchOwn(body: Record<string, unknown>) {
    return rest('user_profiles', { method: 'PATCH', token: user.token, query: `id=eq.${user.id}`, prefer: 'return=minimal', body });
  }

  test('the owner of a profile cannot set an end date', async () => {
    const own = await patchOwn({ plan_expires_at: future });

    expect(own.status).toBe(400);
    expect(failure(own.body).code).toBe(RAISED);
    expect(failure(own.body).message ?? '').toContain('managed by the Stripe webhook');
  });

  test('a profile cannot be inserted with an end date', async () => {
    // The BEFORE INSERT trigger runs before the unique check, so this row (which already exists)
    // is refused by the trigger and not by a duplicate-key error.
    const insert = await rest('user_profiles', { method: 'POST', token: user.token, prefer: 'return=minimal', body: { id: user.id, plan_expires_at: future } });

    expect(insert.status).toBe(400);
    expect(failure(insert.body).code).toBe(RAISED);
  });

  test('a granted Pro cannot extend their own end date', async () => {
    const grant = await rest('user_profiles', { method: 'PATCH', serviceRole: true, query: `id=eq.${user.id}`, prefer: 'return=minimal', body: { plan: 'pro', plan_expires_at: future } });
    expect(grant.status).toBe(204);

    const extend = await patchOwn({ plan_expires_at: new Date(Date.now() + 59 * 86_400_000).toISOString() });

    expect(extend.status).toBe(400);
    expect(failure(extend.body).code).toBe(RAISED);
  });
});
