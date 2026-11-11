import type { createServiceClient } from '@/lib/supabase/service';
import * as realSentry from '@sentry/nextjs';
import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import Stripe from 'stripe';
import * as realConfirmationEmail from '@/lib/billing/confirmation-email';
import * as realStripe from '@/lib/stripe';
import { fakeSupabase as baseFakeSupabase } from '@/tests/mocks/supabase-query-builder';

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

// FRESCO-1088: `resource_missing` is only believed when Stripe still knows the customer.
const customerRetrieveMock = mock(async (_id: string): Promise<unknown> => ({ id: 'cus_1' }));

// FRESCO-909: the paid-checkout sweep runs last; by default Stripe lists no sessions.
const listSessionsMock = mock((_params: unknown): AsyncIterable<Stripe.Checkout.Session> => (async function* () {})());

// FRESCO-915: what the route reports to Sentry.
const captureException = mock((_error: unknown, _context?: unknown) => 'event-id');
const captureMessage = mock((_message: string, _context?: unknown) => 'event-id');
void mock.module('@sentry/nextjs', () => ({ ...realSentry, captureException, captureMessage }));

// FRESCO-1088: every pass reads `billing_mode` first; unless a test says otherwise the database serves test mode.
function fakeSupabase(tables: Parameters<typeof baseFakeSupabase>[0] = {}) {
  return baseFakeSupabase({ billing_mode: { rows: { stripe_livemode: false } }, ...tables });
}

let supa = fakeSupabase();
void mock.module('@/lib/supabase/service', () => ({ createServiceClient: () => supa.client }));
// FRESCO-1005: the confirmation-email retry pass has its own tests (lib/billing/confirmation-email.test.ts);
// here it must not add Sentry events or table reads to the reconcile assertions.
const retryPendingConfirmations = mock(async (_client: unknown, _stripe: unknown) => ({ tried: 0, sent: 0, failed: 0, gaveUp: 0, dropped: 0, skipped: 0 }));
void mock.module('@/lib/billing/confirmation-email', () => ({ ...realConfirmationEmail, retryPendingConfirmations }));
void mock.module('@/lib/stripe', () => ({
  ...realStripe,
  stripe: { subscriptions: { retrieve: retrieveMock }, customers: { retrieve: customerRetrieveMock }, checkout: { sessions: { list: listSessionsMock } } },
}));

const { GET, maxDuration } = await import('./route');
const { sweepOrphanPaidPlans } = await import('@/lib/billing/reconcile');

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
    process.env.STRIPE_SECRET_KEY = 'sk_test_unit';
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
    expect(await res.json()).toMatchObject({ checked: 0, reconciled: 0, sweptOrphans: 0, checkoutSweep: { scanned: 0, granted: 0, failed: 0 } });
  });

  test('FRESCO-1005: the summary carries the confirmation-email retry pass, which runs with the service client and the Stripe client', async () => {
    retryPendingConfirmations.mockClear();
    retryPendingConfirmations.mockResolvedValueOnce({ tried: 2, sent: 1, failed: 1, gaveUp: 0, dropped: 0, skipped: 0 });

    const res = await GET(req({ authorization: 'Bearer cron_test' }));

    expect((await res.json() as { confirmationRetries: unknown }).confirmationRetries).toEqual({ tried: 2, sent: 1, failed: 1, gaveUp: 0, dropped: 0, skipped: 0 });
    expect(retryPendingConfirmations.mock.calls[0][0]).toBe(supa.client);
  });

  test('FRESCO-1005: a retry pass that throws is reported to Sentry and does not turn the reconcile pass into a 500', async () => {
    captureException.mockClear();
    retryPendingConfirmations.mockRejectedValueOnce(new Error('pending table unreadable'));

    const res = await GET(req({ authorization: 'Bearer cron_test' }));

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ confirmationRetries: null });
    expect(captureException).toHaveBeenCalledTimes(1);
  });

  test('FRESCO-909: still answers 200 with the reconcile result when the paid-checkout sweep cannot list sessions', async () => {
    listSessionsMock.mockImplementationOnce(() => {
      throw new Error('stripe unreachable');
    });

    const res = await GET(req({ authorization: 'Bearer cron_test' }));

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ checked: 0, reconciled: 0, checkoutSweep: null });
  });
});

describe('GET /api/cron/stripe-reconcile — reconcile loop', () => {
  const OLD_ENV = { ...process.env };

  beforeEach(() => {
    process.env.CRON_SECRET = 'cron_test';
    process.env.STRIPE_SECRET_KEY = 'sk_test_unit';
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
        rows: [{ id: 'u1', plan: 'pro', plan_expires_at: '2026-01-01T00:00:00Z', payment_failed_at: null, stripe_subscription_id: 'sub_gone', stripe_customer_id: 'cus_1' }],
      },
    });

    const res = await GET(req());

    const body = await res.json() as { reconciled: number, drifted: Array<{ changes: Record<string, unknown> }> };
    expect(body.reconciled).toBe(1);
    expect(body.drifted[0]?.changes.plan).toEqual({ from: 'pro', to: 'free' });
  });

  test('FRESCO-1088: a missing subscription whose customer Stripe cannot confirm is a failure, not a downgrade', async () => {
    retrieveMock.mockImplementation(async () => {
      throw new Stripe.errors.StripeError({ code: 'resource_missing', message: 'No such subscription' });
    });
    customerRetrieveMock.mockImplementationOnce(async () => {
      throw new Stripe.errors.StripeError({ code: 'resource_missing', message: 'No such customer' });
    });
    supa = fakeSupabase({
      user_profiles: {
        rows: [{ id: 'u1', plan: 'pro', plan_expires_at: '2026-01-01T00:00:00Z', payment_failed_at: null, stripe_subscription_id: 'sub_gone', stripe_customer_id: 'cus_gone' }],
      },
    });

    const res = await GET(req());

    const body = await res.json() as { reconciled: number, failures: number, drifted: unknown[] };
    expect(body.reconciled).toBe(0);
    expect(body.failures).toBe(1);
    expect(body.drifted).toEqual([]);
  });

  test('FRESCO-1088: a missing subscription on a profile with no customer id is not downgraded either', async () => {
    retrieveMock.mockImplementation(async () => {
      throw new Stripe.errors.StripeError({ code: 'resource_missing', message: 'No such subscription' });
    });
    supa = fakeSupabase({
      user_profiles: {
        rows: [{ id: 'u1', plan: 'pro', plan_expires_at: '2026-01-01T00:00:00Z', payment_failed_at: null, stripe_subscription_id: 'sub_gone', stripe_customer_id: null }],
      },
    });

    const body = await (await GET(req())).json() as { reconciled: number, failures: number };

    expect(body.reconciled).toBe(0);
    expect(body.failures).toBe(1);
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

describe('GET /api/cron/stripe-reconcile — heartbeat and Sentry (FRESCO-915)', () => {
  const OLD_ENV = { ...process.env };
  const profile = { id: 'u1', plan: 'free', plan_expires_at: null, payment_failed_at: null, stripe_subscription_id: 'sub_1' };

  beforeEach(() => {
    process.env.CRON_SECRET = 'cron_test';
    process.env.STRIPE_SECRET_KEY = 'sk_test_unit';
    process.env.STRIPE_PRICE_ID_PRO_MONTH = PRO_PRICE_ID;
    retrieveMock.mockReset();
    captureException.mockClear();
  });
  afterEach(() => {
    process.env = { ...OLD_ENV };
  });

  function req(authorization = 'Bearer cron_test') {
    return new Request('https://test.fresco.local/api/cron/stripe-reconcile', { headers: { authorization } });
  }

  const taggedAsThisJob = () => captureException.mock.calls.every(([, context]) =>
    (context as { tags?: { cron_job?: string } }).tags?.cron_job === 'stripe-reconcile');

  test('a completed pass writes the heartbeat of this job', async () => {
    supa = fakeSupabase({ user_profiles: { rows: [] } });

    const res = await GET(req());

    expect(res.status).toBe(200);
    expect(supa.upserts).toHaveLength(1);
    expect(supa.upserts[0]).toMatchObject({ table: 'job_heartbeat', options: { onConflict: 'job' } });
    expect(supa.upserts[0]?.payload.job).toBe('stripe-reconcile');
    expect(captureException).not.toHaveBeenCalled();
  });

  test('a pass that reconciled a row writes it too', async () => {
    retrieveMock.mockImplementation(async () => activeSubscription());
    supa = fakeSupabase({ user_profiles: { rows: [profile] } });

    const body = await (await GET(req())).json() as { reconciled: number, failures: number };

    expect(body).toMatchObject({ reconciled: 1, failures: 0 });
    expect(supa.upserts).toHaveLength(1);
  });

  test('when Stripe answers for none of the profiles there is no heartbeat, and Sentry hears of it', async () => {
    retrieveMock.mockImplementation(async () => {
      throw new Error('stripe unreachable');
    });
    supa = fakeSupabase({ user_profiles: { rows: [profile] } });

    const res = await GET(req());

    expect(res.status).toBe(200);
    expect((await res.json() as { failures: number }).failures).toBe(1);
    expect(supa.upserts).toEqual([]);
    expect(captureException).toHaveBeenCalledTimes(1);
    expect(taggedAsThisJob()).toBe(true);
  });

  test('one failing row among others does not stop the heartbeat', async () => {
    retrieveMock
      .mockImplementationOnce(async () => {
        throw new Error('one bad row');
      })
      .mockImplementation(async () => activeSubscription());
    supa = fakeSupabase({ user_profiles: { rows: [profile, { ...profile, id: 'u2', stripe_subscription_id: 'sub_2' }] } });

    const body = await (await GET(req())).json() as { checked: number, failures: number };

    expect(body).toMatchObject({ checked: 2, failures: 1 });
    expect(supa.upserts).toHaveLength(1);
    expect(captureException).toHaveBeenCalledTimes(1);
  });

  test('no heartbeat and a Sentry event when user_profiles cannot be loaded', async () => {
    supa = fakeSupabase({ user_profiles: { rows: null, selectError: new Error('connection reset') } });

    const res = await GET(req());

    expect(res.status).toBe(500);
    expect(supa.upserts).toEqual([]);
    expect(captureException).toHaveBeenCalledTimes(1);
    expect(taggedAsThisJob()).toBe(true);
  });

  test('a missing CRON_SECRET answers 500, reports to Sentry and writes no heartbeat', async () => {
    delete process.env.CRON_SECRET;
    supa = fakeSupabase({ user_profiles: { rows: [] } });

    const res = await GET(req());

    expect(res.status).toBe(500);
    expect(supa.upserts).toEqual([]);
    expect(captureException).toHaveBeenCalledTimes(1);
  });

  test('a missing Pro price id answers 500, reports to Sentry and writes no heartbeat', async () => {
    delete process.env.STRIPE_PRICE_ID_PRO_MONTH;
    supa = fakeSupabase({ user_profiles: { rows: [] } });

    const res = await GET(req());

    expect(res.status).toBe(500);
    expect(supa.upserts).toEqual([]);
    expect(captureException).toHaveBeenCalledTimes(1);
  });

  test('a wrong secret answers 401 with no heartbeat and nothing in Sentry (a probe must not be able to flood it)', async () => {
    supa = fakeSupabase({ user_profiles: { rows: [] } });

    const res = await GET(req('Bearer wrong'));

    expect(res.status).toBe(401);
    expect(supa.upserts).toEqual([]);
    expect(captureException).not.toHaveBeenCalled();
  });

  test('a failed heartbeat write is reported but does not fail the pass', async () => {
    supa = fakeSupabase({ user_profiles: { rows: [] }, job_heartbeat: { upsertError: new Error('write denied') } });

    const res = await GET(req());

    expect(res.status).toBe(200);
    expect(captureException).toHaveBeenCalledTimes(1);
  });

  test('a paid-checkout sweep that cannot list sessions is reported to Sentry, and the heartbeat still lands', async () => {
    supa = fakeSupabase({ user_profiles: { rows: [] } });
    listSessionsMock.mockImplementationOnce(() => {
      throw new Error('stripe unreachable');
    });

    const res = await GET(req());

    expect(res.status).toBe(200);
    expect(captureException).toHaveBeenCalledTimes(1);
    expect(supa.upserts).toHaveLength(1);
  });
});

describe('GET /api/cron/stripe-reconcile — Stripe mode guard (FRESCO-1088)', () => {
  const OLD_ENV = { ...process.env };

  beforeEach(() => {
    process.env.CRON_SECRET = 'cron_test';
    process.env.STRIPE_PRICE_ID_PRO_MONTH = PRO_PRICE_ID;
    retrieveMock.mockReset();
    customerRetrieveMock.mockClear();
    captureException.mockClear();
  });
  afterEach(() => {
    process.env = { ...OLD_ENV };
  });

  const proRow = { id: 'u1', plan: 'pro', plan_expires_at: '2026-01-01T00:00:00Z', payment_failed_at: null, stripe_subscription_id: 'sub_live', stripe_customer_id: 'cus_live' };
  const run = async () => GET(new Request('https://test.fresco.local/api/cron/stripe-reconcile', { headers: { authorization: 'Bearer cron_test' } }));

  test.each([
    { key: 'sk_test_unit', database: true, label: 'test key against a live database' },
    { key: 'sk_live_unit', database: false, label: 'live key against a test database' },
  ])('$label: nobody is downgraded, Stripe is not even asked, Sentry hears of it', async ({ key, database }) => {
    process.env.STRIPE_SECRET_KEY = key;
    // A crossed key makes Stripe answer resource_missing for every subscription; the pass must not get that far.
    retrieveMock.mockImplementation(async () => {
      throw new Stripe.errors.StripeError({ code: 'resource_missing', message: 'No such subscription' });
    });
    supa = fakeSupabase({ billing_mode: { rows: { stripe_livemode: database } }, user_profiles: { rows: [proRow] } });

    const res = await run();

    expect(res.status).toBe(500);
    expect(retrieveMock).not.toHaveBeenCalled();
    expect(supa.updates).toEqual([]);
    expect(supa.upserts).toEqual([]);
    expect(captureException).toHaveBeenCalled();
  });

  test('a matching live key and live database reconciles normally', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_live_unit';
    retrieveMock.mockImplementation(async () => activeSubscription());
    supa = fakeSupabase({ billing_mode: { rows: { stripe_livemode: true } }, user_profiles: { rows: [{ ...proRow, plan: 'free', plan_expires_at: null, stripe_livemode: true }] } });

    const res = await run();

    expect(res.status).toBe(200);
    expect(retrieveMock).toHaveBeenCalledTimes(1);
  });

  test('an unrecognised key fails closed: 500, nothing written', async () => {
    process.env.STRIPE_SECRET_KEY = 'not-a-stripe-key';
    supa = fakeSupabase({ user_profiles: { rows: [proRow] } });

    const res = await run();

    expect(res.status).toBe(500);
    expect(retrieveMock).not.toHaveBeenCalled();
    expect(supa.updates).toEqual([]);
  });

  test('a missing billing_mode row fails closed too', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_unit';
    supa = fakeSupabase({ billing_mode: { rows: null }, user_profiles: { rows: [proRow] } });

    const res = await run();

    expect(res.status).toBe(500);
    expect(retrieveMock).not.toHaveBeenCalled();
  });
});

/**
 * FRESCO-1161: when `billing_mode` goes live, a profile that holds TEST Stripe ids can never be settled
 * with the live key (it answers `resource_missing`, and the customer is not found either). It used to
 * fail every pass and, if it was Pro, stay Pro for good (checkout 409, portal 500).
 */
describe('GET /api/cron/stripe-reconcile — profiles of the other Stripe mode (FRESCO-1161)', () => {
  const OLD_ENV = { ...process.env };

  beforeEach(() => {
    process.env.CRON_SECRET = 'cron_test';
    process.env.STRIPE_PRICE_ID_PRO_MONTH = PRO_PRICE_ID;
    retrieveMock.mockReset();
    customerRetrieveMock.mockClear();
    captureException.mockClear();
  });
  afterEach(() => {
    process.env = { ...OLD_ENV };
  });

  const run = async () => GET(new Request('https://test.fresco.local/api/cron/stripe-reconcile', { headers: { authorization: 'Bearer cron_test' } }));
  const goLive = () => {
    process.env.STRIPE_SECRET_KEY = 'sk_live_unit';
    // What the live key really answers for a test-mode subscription.
    retrieveMock.mockImplementation(async () => {
      throw new Stripe.errors.StripeError({ code: 'resource_missing', message: 'No such subscription' });
    });
    customerRetrieveMock.mockImplementation(async () => {
      throw new Error('No such customer');
    });
  };
  const testTrial = { id: 'u_trial', plan: 'pro', plan_expires_at: '2026-12-01T00:00:00Z', payment_failed_at: '2026-11-20T00:00:00Z', stripe_subscription_id: 'sub_test', stripe_customer_id: 'cus_test', stripe_livemode: false };
  const testFree = { id: 'u_free', plan: 'free', plan_expires_at: null, payment_failed_at: null, stripe_subscription_id: 'sub_test2', stripe_customer_id: 'cus_test2', stripe_livemode: false };
  const liveRow = { id: 'u_live', plan: 'free', plan_expires_at: null, payment_failed_at: null, stripe_subscription_id: 'sub_live', stripe_customer_id: 'cus_live', stripe_livemode: true };

  interface Body { checked: number, failures: number, reconciled: number, foreignMode: { downgraded: number, failed: number } }

  test('a Pro trial with test ids on a live database goes to free, keeps its ids, and is not a failure', async () => {
    goLive();
    supa = fakeSupabase({ billing_mode: { rows: { stripe_livemode: true } }, user_profiles: { rows: [testTrial] } });

    const res = await run();

    const body = await res.json() as Body;
    expect(res.status).toBe(200);
    expect(body.foreignMode).toEqual({ downgraded: 1, failed: 0 });
    expect(body.failures).toBe(0);
    expect(body.checked).toBe(0);
    // Only the plan and the aviso are written: the ids stay, so the trial still counts as used.
    // (The fake ignores filters, so its orphan sweep writes the same row after this one: look at the first write.)
    expect(supa.updates[0]?.payload).toEqual({ plan: 'free', payment_failed_at: null });
    expect(supa.updates.every(u => !('stripe_subscription_id' in u.payload) && !('stripe_customer_id' in u.payload))).toBe(true);
    expect(retrieveMock).not.toHaveBeenCalled();
    expect(customerRetrieveMock).not.toHaveBeenCalled();
    expect(captureException).not.toHaveBeenCalled();
  });

  test('a free profile with test ids is left alone: not counted, no Stripe call, no Sentry event', async () => {
    goLive();
    supa = fakeSupabase({ billing_mode: { rows: { stripe_livemode: true } }, user_profiles: { rows: [testFree] } });

    const res = await run();

    const body = await res.json() as Body;
    expect(body.foreignMode).toEqual({ downgraded: 0, failed: 0 });
    expect(body.failures).toBe(0);
    expect(retrieveMock).not.toHaveBeenCalled();
    expect(captureException).not.toHaveBeenCalled();
  });

  test('the heartbeat still lands when every subscribed profile holds test ids (no false alarm until the first real subscriber)', async () => {
    goLive();
    supa = fakeSupabase({ billing_mode: { rows: { stripe_livemode: true } }, user_profiles: { rows: [testTrial, testFree] } });

    await run();

    expect(supa.upserts).toHaveLength(1);
    expect(supa.upserts[0]?.payload.job).toBe('stripe-reconcile');
  });

  test('a live profile next to them is still reconciled against Stripe', async () => {
    goLive();
    retrieveMock.mockImplementation(async () => activeSubscription());
    supa = fakeSupabase({ billing_mode: { rows: { stripe_livemode: true } }, user_profiles: { rows: [testTrial, liveRow] } });

    const res = await run();

    const body = await res.json() as Body;
    expect(body.checked).toBe(1);
    expect(body.reconciled).toBe(1);
    expect(body.foreignMode.downgraded).toBe(1);
    expect(retrieveMock).toHaveBeenCalledTimes(1);
  });

  test('a failed write is counted apart, reported to Sentry, and does not stop the pass', async () => {
    goLive();
    supa = fakeSupabase({ billing_mode: { rows: { stripe_livemode: true } }, user_profiles: { rows: [testTrial], updateError: new Error('write conflict') } });

    const res = await run();

    const body = await res.json() as Body;
    expect(res.status).toBe(200);
    expect(body.foreignMode).toEqual({ downgraded: 0, failed: 1 });
    expect(captureException).toHaveBeenCalledTimes(1);
    expect(supa.upserts).toHaveLength(1);
  });

  test('the same holds the other way: live ids on a test database (the rollback) are taken off Pro, not asked about', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_unit';
    supa = fakeSupabase({ billing_mode: { rows: { stripe_livemode: false } }, user_profiles: { rows: [{ ...testTrial, stripe_livemode: true }] } });

    const res = await run();

    const body = await res.json() as Body;
    expect(body.foreignMode.downgraded).toBe(1);
    expect(retrieveMock).not.toHaveBeenCalled();
  });
});

/**
 * FRESCO-1162: the pass must finish inside the function's time limit and must not lose the
 * paid-checkout sweep (the only recovery of a lost purchase) when it is slow.
 */
describe('GET /api/cron/stripe-reconcile — time limit (FRESCO-1162)', () => {
  const OLD_ENV = { ...process.env };

  beforeEach(() => {
    process.env.CRON_SECRET = 'cron_test';
    process.env.STRIPE_SECRET_KEY = 'sk_test_unit';
    process.env.STRIPE_PRICE_ID_PRO_MONTH = PRO_PRICE_ID;
    retrieveMock.mockReset();
    listSessionsMock.mockClear();
    captureException.mockClear();
    captureMessage.mockClear();
  });
  afterEach(() => {
    process.env = { ...OLD_ENV };
  });

  const run = async () => GET(new Request('https://test.fresco.local/api/cron/stripe-reconcile', { headers: { authorization: 'Bearer cron_test' } }));
  const manyProfiles = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `u${i}`, plan: 'pro', plan_expires_at: new Date(1_700_003_600 * 1000).toISOString(), payment_failed_at: null, stripe_subscription_id: `sub_${i}`, stripe_customer_id: `cus_${i}`, stripe_livemode: false }));

  test('the function declares its own time limit instead of the platform default', () => {
    expect(maxDuration).toBe(60);
  });

  test('the paid-checkout sweep runs before the first profile is looked up', async () => {
    retrieveMock.mockImplementation(async () => activeSubscription());
    supa = fakeSupabase({ user_profiles: { rows: manyProfiles(3) } });

    await run();

    expect(listSessionsMock).toHaveBeenCalled();
    expect(listSessionsMock.mock.invocationCallOrder[0]).toBeLessThan(retrieveMock.mock.invocationCallOrder[0]);
  });

  test('60 profiles are all checked, several at a time but never more than the cap', async () => {
    let inFlight = 0;
    let peak = 0;
    retrieveMock.mockImplementation(async () => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise(resolve => setTimeout(resolve, 2));
      inFlight--;
      return activeSubscription();
    });
    supa = fakeSupabase({ user_profiles: { rows: manyProfiles(60) } });

    const res = await run();

    const body = await res.json() as { checked: number, skippedForTime: number, failures: number };
    expect(body.checked).toBe(60);
    expect(body.skippedForTime).toBe(0);
    expect(body.failures).toBe(0);
    expect(retrieveMock).toHaveBeenCalledTimes(60);
    expect(peak).toBeGreaterThan(1);
    expect(peak).toBeLessThanOrEqual(5);
    expect(captureMessage).not.toHaveBeenCalled();
  });

  test('past its budget the loop stops taking profiles, says so, and still runs the sweeps and writes the heartbeat', async () => {
    // A clock the Stripe calls push forward: each lookup "takes" 10 s.
    let clock = 1_000_000;
    const now = spyOn(Date, 'now').mockImplementation(() => clock);
    retrieveMock.mockImplementation(async () => {
      clock += 10_000;
      return activeSubscription();
    });
    supa = fakeSupabase({ user_profiles: { rows: manyProfiles(40) } });

    let res: Response;
    try {
      res = await run();
    }
    finally {
      now.mockRestore();
    }

    const body = await res.json() as { checked: number, skippedForTime: number };
    expect(body.skippedForTime).toBeGreaterThan(0);
    expect(body.checked + body.skippedForTime).toBe(40);
    expect(captureMessage).toHaveBeenCalledTimes(1);
    expect((captureMessage.mock.calls[0]?.[1] as { level: string }).level).toBe('warning');
    expect(listSessionsMock).toHaveBeenCalled();
    expect(supa.upserts).toHaveLength(1);
  });
});
