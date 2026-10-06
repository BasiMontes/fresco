import { describe, expect, test } from 'bun:test';
import { applyReconciledState, listSubscribedProfiles } from '@/lib/billing/reconcile';
import { createMockClient } from '@/lib/fixtures/mock-supabase-client';

// `sweepOrphanPaidPlans` is covered by `app/api/cron/stripe-reconcile/route.test.ts`.

describe('listSubscribedProfiles', () => {
  test('selects the comparison columns of every profile that has a Stripe subscription', async () => {
    const rows = [{ id: 'a', plan: 'pro', plan_expires_at: null, payment_failed_at: null, stripe_subscription_id: 'sub_a' }];
    const { client, callsOf } = createMockClient({ data: rows });

    expect(await listSubscribedProfiles(client)).toEqual(rows);
    expect(callsOf('select')).toEqual([['id, plan, plan_expires_at, payment_failed_at, stripe_subscription_id']]);
    expect(callsOf('not')).toEqual([['stripe_subscription_id', 'is', null]]);
  });

  test('returns an empty list when nothing matches, and throws on a read failure', async () => {
    expect(await listSubscribedProfiles(createMockClient({ data: null }).client)).toEqual([]);

    let error: unknown;
    try {
      await listSubscribedProfiles(createMockClient({ errorMessage: 'boom' }).client);
    }
    catch (caught) {
      error = caught;
    }
    expect(error).toBeDefined();
  });
});

describe('applyReconciledState', () => {
  test('writes the desired state onto that one profile and nothing else', async () => {
    const { client, callsOf } = createMockClient();
    const desired = { plan: 'pro' as const, payment_failed_at: null, plan_expires_at: '2026-12-01T00:00:00.000Z' };

    await applyReconciledState(client, { profileId: 'user-1', desired });

    expect(callsOf('update')).toEqual([[desired]]);
    expect(callsOf('eq')).toEqual([['id', 'user-1']]);
  });
});
