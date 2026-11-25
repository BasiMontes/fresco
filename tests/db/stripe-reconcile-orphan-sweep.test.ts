/**
 * FRESCO-1289 (audit 11 F5, regression.feature "El cron de reconciliación degrada perfiles Pro huérfanos sin
 * suscripción"). The route test asserts that every row the sweep returns is downgraded, but it uses a fake client that
 * ignores the filter that CHOOSES the rows (`plan in (pro, family)` and `stripe_subscription_id is null`). A filter
 * that is too wide would send a paying customer to Free, and one that is too narrow would leave Pro to someone who
 * no longer pays. This test runs the real `sweepOrphanPaidPlans` against the real database and checks who changes.
 *
 * The sweep acts on every orphan row of the database, so this file relies on `tests/db` running one file at a time
 * (`bun run test:db`), as it does today: every other file cleans its own users in `afterAll`.
 *
 * Runs only when `RUN_DB_INTEGRATION=1` AND the local Supabase stack answers (`bun run test:db`).
 */

import type { DbTestUser } from './harness';
import { createClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { sweepOrphanPaidPlans } from '@/lib/billing/reconcile';
import { createDbTestContext, nativeFetch, resolveUrl, rest, serviceRoleKey, stackReachable } from './harness';

const RUN = process.env.RUN_DB_INTEGRATION === '1';
const reachable = RUN ? await stackReachable() : false;

describe.skipIf(!(RUN && reachable))('sweepOrphanPaidPlans (real DB)', () => {
  const ctx = createDbTestContext();
  let orphanPro: DbTestUser;
  let orphanFamily: DbTestUser;
  let subscribedPro: DbTestUser;
  let free: DbTestUser;

  beforeAll(async () => {
    orphanPro = await ctx.createUser({ plan: 'pro' });
    orphanFamily = await ctx.createUser({ plan: 'family' });
    subscribedPro = await ctx.createUser({ plan: 'pro' });
    free = await ctx.createUser();
    const attach = await rest('user_profiles', {
      method: 'PATCH',
      serviceRole: true,
      prefer: 'return=minimal',
      query: `id=eq.${subscribedPro.id}`,
      body: { stripe_subscription_id: `sub_db_test_${subscribedPro.id.slice(0, 8)}` },
    });
    expect(attach.status).toBeLessThan(300);
  });

  afterAll(async () => {
    await ctx.cleanupAll();
  });

  const planOf = async (user: DbTestUser): Promise<string> =>
    ((await rest('user_profiles', { serviceRole: true, query: `id=eq.${user.id}&select=plan` })).body as Array<{ plan: string }>)[0].plan;

  test('downgrades the pro and family rows with no subscription and leaves everyone else alone', async () => {
    expect(await planOf(orphanPro)).toBe('pro');
    expect(await planOf(orphanFamily)).toBe('family');

    const client = createClient(resolveUrl(), await serviceRoleKey(), { global: { fetch: nativeFetch }, auth: { persistSession: false } });
    const swept = await sweepOrphanPaidPlans(client as never);

    expect(swept).toBeGreaterThanOrEqual(2);
    expect(await planOf(orphanPro)).toBe('free');
    expect(await planOf(orphanFamily)).toBe('free');
    // The paying customer and the free account must not move.
    expect(await planOf(subscribedPro)).toBe('pro');
    expect(await planOf(free)).toBe('free');
  });
});
