import type { createServiceClient } from '@/lib/supabase/service';
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import Stripe from 'stripe';
import * as realStripe from '@/lib/stripe';
import { fakeSupabase } from '@/tests/mocks/supabase-query-builder';

/**
 * FRESCO-360: unit coverage for the orphan-plan sweep — the second safety net
 * behind the `protect_subscription_columns` INSERT guard. Kept as a unit test
 * (not e2e) on purpose: exercising it through the real cron route would run
 * the global reconcile loop against every `user_profiles` row and could
 * downgrade a parallel e2e scenario's seeded Pro fixture mid-test.
 *
 * FRESCO-410: plus the `GET` handler's auth + config gate.
 *
 * Below that: the main reconcile loop itself — previously untested (the
 * auth-gate block always seeded `user_profiles: { rows: [] }`, so `checked`
 * stayed 0 and `stripe.subscriptions.retrieve`/`resolveReconciledState`
 * never ran on a real row). `retrieveMock` is reassignable per test so each
 * scenario controls what Stripe returns.
 */

const retrieveMock = mock(async (_id: string): Promise<Stripe.Subscription> => ({} as Stripe.Subscription));

let supa = fakeSupabase();
void mock.module('@/lib/supabase/service', () => ({ createServiceClient: () => supa.client }));
void mock.module('@/lib/stripe', () => ({
  ...realStripe,
  stripe: { subscriptions: { retrieve: retrieveMock } },
}));

const { GET, sweepOrphanPaidPlans } = await import('./route');

const PRO_PRICE_ID = 'price_pro_month';

function activeSubscription(overrides: Partial<{ status: Stripe.Subscription.Status, priceId: string, currentPeriodEnd: number, trialEnd: number | null }> = {}): Stripe.Subscription {
  const status = overrides.status ?? 'active';
  return {
    id: 'sub_1',
    status,
    trial_end: overrides.trialEnd ?? (status === 'trialing' ? 1_700_003_600 : null),
    items: {
      data: [
        {
          price: { id: overrides.priceId ?? PRO_PRICE_ID },
          current_period_end: overrides.currentPeriodEnd ?? 1_700_003_600,
        },
      ],
    },
  } as unknown as Stripe.Subscription;
}

interface OrphanRow { id: string, plan: 'pro' | 'family' }

function fakeClient(opts: { orphans?: OrphanRow[], loadError?: unknown, failIds?: string[] }) {
  const updated: string[] = [];
  const client = {
    from() {
      return {
        select() {
          return {
            in() {
              return {
                is: async () => ({ data: opts.orphans ?? [], error: opts.loadError ?? null }),
              };
            },
          };
        },
        update() {
          return {
            eq: async (_col: string, id: string) => {
              if (opts.failIds?.includes(id)) { return { error: new Error(`update failed for ${id}`) }; }
              updated.push(id);
              return { error: null };
            },
          };
        },
      };
    },
  };
  return { client: client as unknown as ReturnType<typeof createServiceClient>, updated };
}

describe('sweepOrphanPaidPlans', () => {
  test('downgrades every pro/family row that has no stripe_subscription_id', async () => {
    const { client, updated } = fakeClient({
      orphans: [
        { id: 'a', plan: 'pro' },
        { id: 'b', plan: 'family' },
      ],
    });

    const swept = await sweepOrphanPaidPlans(client);

    expect(swept).toBe(2);
    expect(updated).toEqual(['a', 'b']);
  });

  test('returns 0 and writes nothing when there are no orphans', async () => {
    const { client, updated } = fakeClient({ orphans: [] });

    expect(await sweepOrphanPaidPlans(client)).toBe(0);
    expect(updated).toEqual([]);
  });

  test('returns 0 on a load error without attempting any update', async () => {
    const { client, updated } = fakeClient({ loadError: new Error('boom'), orphans: [{ id: 'a', plan: 'pro' }] });

    expect(await sweepOrphanPaidPlans(client)).toBe(0);
    expect(updated).toEqual([]);
  });

  test('skips a row whose update fails and still sweeps the rest', async () => {
    const { client, updated } = fakeClient({
      orphans: [
        { id: 'a', plan: 'pro' },
        { id: 'b', plan: 'pro' },
        { id: 'c', plan: 'family' },
      ],
      failIds: ['b'],
    });

    const swept = await sweepOrphanPaidPlans(client);

    expect(swept).toBe(2);
    expect(updated).toEqual(['a', 'c']);
  });
});

describe('GET /api/cron/stripe-reconcile — auth + config gate', () => {
  const OLD_ENV = { ...process.env };

  beforeEach(() => {
    process.env.CRON_SECRET = 'cron_test';
    process.env.STRIPE_PRICE_ID_PRO_MONTH = 'price_pro_month';
    supa = fakeSupabase({ user_profiles: { rows: [] } });
  });
  afterEach(() => {
    process.env = { ...OLD_ENV };
  });

  function req(headers: Record<string, string> = {}) {
    return new Request('https://test.fresco.local/api/cron/stripe-reconcile', { headers });
  }

  test('500 when CRON_SECRET is not configured', async () => {
    delete process.env.CRON_SECRET;
    const res = await GET(req({ authorization: 'Bearer cron_test' }));
    expect(res.status).toBe(500);
  });

  test('401 when the Authorization header does not match', async () => {
    const res = await GET(req({ authorization: 'Bearer wrong' }));
    expect(res.status).toBe(401);
  });

  test('401 when there is no Authorization header', async () => {
    const res = await GET(req());
    expect(res.status).toBe(401);
  });

  test('500 when STRIPE_PRICE_ID_PRO_MONTH is not set', async () => {
    delete process.env.STRIPE_PRICE_ID_PRO_MONTH;
    const res = await GET(req({ authorization: 'Bearer cron_test' }));
    expect(res.status).toBe(500);
  });

  test('200 with a zero-drift summary when authorised and no profiles carry a subscription', async () => {
    const res = await GET(req({ authorization: 'Bearer cron_test' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ checked: 0, reconciled: 0, sweptOrphans: 0 });
  });
});

describe('GET /api/cron/stripe-reconcile — reconcile loop', () => {
  const OLD_ENV = { ...process.env };

  beforeEach(() => {
    process.env.CRON_SECRET = 'cron_test';
    process.env.STRIPE_PRICE_ID_PRO_MONTH = PRO_PRICE_ID;
    retrieveMock.mockClear();
  });
  afterEach(() => {
    process.env = { ...OLD_ENV };
  });

  function req() {
    return new Request('https://test.fresco.local/api/cron/stripe-reconcile', { headers: { authorization: 'Bearer cron_test' } });
  }

  test('writes plan + plan_expires_at when Stripe shows a live subscription the profile does not reflect yet', async () => {
    retrieveMock.mockImplementation(async () => activeSubscription());
    supa = fakeSupabase({
      user_profiles: {
        rows: [{ id: 'u1', plan: 'free', plan_expires_at: null, payment_failed_at: null, stripe_subscription_id: 'sub_1' }],
      },
    });

    const res = await GET(req());

    expect(res.status).toBe(200);
    const body = await res.json() as { checked: number, reconciled: number, drifted: Array<{ userId: string, changes: Record<string, unknown> }> };
    expect(body.checked).toBe(1);
    expect(body.reconciled).toBe(1);
    expect(body.drifted).toHaveLength(1);
    expect(body.drifted[0]?.userId).toBe('u1');
    expect(body.drifted[0]?.changes.plan).toEqual({ from: 'free', to: 'pro' });
  });

  test('writes nothing when the profile already matches the live Stripe state', async () => {
    const expiresAt = new Date(1_700_003_600 * 1000).toISOString();
    retrieveMock.mockImplementation(async () => activeSubscription());
    supa = fakeSupabase({
      user_profiles: {
        rows: [{ id: 'u1', plan: 'pro', plan_expires_at: expiresAt, payment_failed_at: null, stripe_subscription_id: 'sub_1' }],
      },
    });

    const res = await GET(req());

    const body = await res.json() as { checked: number, reconciled: number, drifted: unknown[] };
    expect(body.checked).toBe(1);
    expect(body.reconciled).toBe(0);
    expect(body.drifted).toEqual([]);
  });

  test('downgrades to free when Stripe no longer has the subscription (resource_missing)', async () => {
    retrieveMock.mockImplementation(async () => {
      throw new Stripe.errors.StripeError({ code: 'resource_missing', message: 'No such subscription' });
    });
    supa = fakeSupabase({
      user_profiles: {
        rows: [{ id: 'u1', plan: 'pro', plan_expires_at: '2026-01-01T00:00:00Z', payment_failed_at: null, stripe_subscription_id: 'sub_gone' }],
      },
    });

    const res = await GET(req());

    const body = await res.json() as { reconciled: number, drifted: Array<{ changes: Record<string, unknown> }> };
    expect(body.reconciled).toBe(1);
    expect(body.drifted[0]?.changes.plan).toEqual({ from: 'pro', to: 'free' });
  });

  test('skips the row and does not reconcile when Stripe retrieval fails for an unrelated reason', async () => {
    retrieveMock.mockImplementation(async () => {
      throw new Error('network timeout');
    });
    supa = fakeSupabase({
      user_profiles: {
        rows: [{ id: 'u1', plan: 'free', plan_expires_at: null, payment_failed_at: null, stripe_subscription_id: 'sub_1' }],
      },
    });

    const res = await GET(req());

    const body = await res.json() as { checked: number, reconciled: number, drifted: unknown[] };
    expect(body.checked).toBe(1);
    expect(body.reconciled).toBe(0);
    expect(body.drifted).toEqual([]);
  });

  test('skips a row whose live subscription is not on the Pro price', async () => {
    retrieveMock.mockImplementation(async () => activeSubscription({ priceId: 'price_some_other_plan' }));
    supa = fakeSupabase({
      user_profiles: {
        rows: [{ id: 'u1', plan: 'free', plan_expires_at: null, payment_failed_at: null, stripe_subscription_id: 'sub_1' }],
      },
    });

    const res = await GET(req());

    const body = await res.json() as { reconciled: number };
    expect(body.reconciled).toBe(0);
  });

  test('500 when loading user_profiles fails', async () => {
    supa = fakeSupabase({ user_profiles: { rows: null, selectError: new Error('connection reset') } });

    const res = await GET(req());

    expect(res.status).toBe(500);
  });

  test('leaves reconciled at 0 when the write itself fails', async () => {
    retrieveMock.mockImplementation(async () => activeSubscription());
    supa = fakeSupabase({
      user_profiles: {
        rows: [{ id: 'u1', plan: 'free', plan_expires_at: null, payment_failed_at: null, stripe_subscription_id: 'sub_1' }],
        updateError: new Error('write conflict'),
      },
    });

    const res = await GET(req());

    const body = await res.json() as { checked: number, reconciled: number };
    expect(body.checked).toBe(1);
    expect(body.reconciled).toBe(0);
  });
});
