import type { RecordedUpdate } from '@/tests/mocks/supabase-query-builder';
import * as realSentry from '@sentry/nextjs';
import { beforeEach, describe, expect, mock, test } from 'bun:test';
import * as realPosthog from '@/lib/posthog/server';
import * as realStripe from '@/lib/stripe';
import { fakeSupabase } from '@/tests/mocks/supabase-query-builder';

/**
 * FRESCO-410 — orchestration coverage for `POST /api/stripe/webhook`, the
 * sole writer of subscription state (ADR-0007). The pure resolvers
 * (`resolveProUpdateFromSession`, `resolvePaymentStatusUpdate`, …) already
 * have their own tests in `lib/stripe.test.ts`; this pins the handler wiring
 * around them: signature gate, the four state-machine paths, the
 * out-of-order-delivery guard, and the "log + still 200" contract.
 */

const constructEvent = mock((..._a: unknown[]): unknown => ({}));
const subscriptionsRetrieve = mock(async (_id: string): Promise<unknown> => ({}));
const subscriptionsCancel = mock(async (_id: string, _params?: unknown): Promise<unknown> => ({}));
const invoicePaymentsList = mock(async (_p: unknown): Promise<unknown> => ({ data: [] }));
const invoicesRetrieve = mock(async (_id: string): Promise<unknown> => ({}));
const captureServerEvent = mock(async (_e: unknown) => {});
const sendSubscriptionConfirmationEmail = mock(async (_p: unknown) => {});
const CLAIMED_AT = '2026-10-12T10:00:00.123456+00:00';
const claimWebhookEvent = mock(async (_client: unknown, _event: unknown): Promise<unknown> => ({ state: 'claimed', claimedAt: CLAIMED_AT }));
const completeWebhookEvent = mock(async (_client: unknown, _eventId: string) => {});
const releaseWebhookEvent = mock(async (_client: unknown, _eventId: string) => {});
const captureException = mock((_error: unknown, _hint?: unknown) => 'id');
const captureMessage = mock((_message: string, _hint?: unknown) => 'id');

let supa = fakeSupabase();
/** FRESCO-1001: the Stripe mode the fake `billing_mode` row says the shared database serves. */
let databaseLivemode = false;

/**
 * FRESCO-1001: real Stripe events and the objects inside them carry `livemode`. The fixtures of
 * this file predate the guard and leave it out, so a fixture that does not say gets the mode the
 * test deploy runs in (test), and the nested object inherits the event's own mode.
 */
function withLivemode(event: unknown): unknown {
  const e = event as { livemode?: boolean, data?: { object?: { livemode?: boolean } } } | null;
  if (!e || typeof e !== 'object' || !('type' in e)) { return event; }
  const livemode = e.livemode ?? false;
  const object = e.data?.object;
  return { ...e, livemode, ...(object ? { data: { ...e.data, object: { ...object, livemode: object.livemode ?? livemode } } } : {}) };
}

void mock.module('@/lib/stripe', () => ({
  ...realStripe,
  stripe: { webhooks: { constructEvent: (...a: unknown[]) => withLivemode(constructEvent(...a)) }, subscriptions: { retrieve: subscriptionsRetrieve, cancel: subscriptionsCancel }, invoicePayments: { list: invoicePaymentsList }, invoices: { retrieve: invoicesRetrieve } },
  resolveWebhookSecret: () => 'whsec_test',
}));
void mock.module('@/lib/supabase/service', () => ({
  createServiceClient: () => ({
    ...supa.client,
    from: (table: string) => (table === 'billing_mode'
      ? { select: () => ({ maybeSingle: async () => ({ data: { stripe_livemode: databaseLivemode }, error: null }) }) }
      : supa.client.from(table)),
  }),
}));
void mock.module('@/lib/posthog/server', () => ({ ...realPosthog, captureServerEvent }));
void mock.module('@/lib/email/resend', () => ({ sendSubscriptionConfirmationEmail }));
void mock.module('@/lib/billing/webhook-events', () => ({ claimWebhookEvent, completeWebhookEvent, releaseWebhookEvent }));
void mock.module('@sentry/nextjs', () => ({ ...realSentry, captureException, captureMessage }));

const { POST } = await import('./route');

const PRICE = 'price_pro_month';
const NOW_S = Math.floor(Date.now() / 1000);

function req(body: unknown, headers: Record<string, string> = { 'stripe-signature': 'sig' }) {
  return new Request('https://test.fresco.local/api/stripe/webhook', {
    method: 'POST',
    headers,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

function subscription(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sub_1',
    status: 'trialing',
    customer: 'cus_1',
    trial_end: NOW_S + 7 * 86_400,
    cancellation_details: { reason: 'cancellation_requested' },
    items: { data: [{ price: { id: PRICE }, current_period_end: NOW_S + 30 * 86_400 }] },
    ...overrides,
  };
}

function updateFor(table: string): RecordedUpdate | undefined {
  return supa.updates.find(u => u.table === table);
}

function authWithEmail(email: string | null) {
  return {
    admin: {
      getUserById: mock(async (_id: string) => (
        email ? { data: { user: { email } }, error: null } : { data: { user: null }, error: new Error('user not found') }
      )),
    },
  };
}

beforeEach(() => {
  process.env.STRIPE_PRICE_ID_PRO_MONTH = PRICE;
  process.env.STRIPE_SECRET_KEY = 'sk_test_unit';
  databaseLivemode = false;
  constructEvent.mockReset();
  subscriptionsRetrieve.mockReset();
  // FRESCO-1002: updated/deleted re-read the subscription from Stripe; by default Stripe agrees with the event.
  subscriptionsRetrieve.mockImplementation(async () => (constructEvent.mock.results.at(-1)?.value as { data?: { object?: unknown } } | undefined)?.data?.object);
  invoicePaymentsList.mockReset();
  invoicesRetrieve.mockReset();
  subscriptionsCancel.mockReset();
  subscriptionsCancel.mockResolvedValue({});
  captureServerEvent.mockClear();
  sendSubscriptionConfirmationEmail.mockReset();
  claimWebhookEvent.mockReset();
  claimWebhookEvent.mockResolvedValue({ state: 'claimed', claimedAt: CLAIMED_AT });
  completeWebhookEvent.mockReset();
  releaseWebhookEvent.mockReset();
  captureException.mockClear();
  captureMessage.mockClear();
  supa = fakeSupabase();
});

describe('POST /api/stripe/webhook — signature gate', () => {
  test('400 when the stripe-signature header is missing', async () => {
    const res = await POST(req({}, {}));
    expect(res.status).toBe(400);
    expect(constructEvent).not.toHaveBeenCalled();
  });

  test('400 when signature verification throws', async () => {
    constructEvent.mockImplementation(() => { throw new Error('bad sig'); });
    const res = await POST(req('raw'));
    expect(res.status).toBe(400);
  });
});

describe('POST /api/stripe/webhook — checkout.session.completed', () => {
  test('grants Pro and fires trial_started for a new subscription', async () => {
    const sub = subscription({ status: 'trialing' });
    constructEvent.mockReturnValue({
      id: 'evt_1',
      type: 'checkout.session.completed',
      data: { object: { subscription: 'sub_1', client_reference_id: 'user_1', customer: 'cus_1', payment_status: 'no_payment_required' } },
    });
    subscriptionsRetrieve.mockResolvedValue(sub);
    supa = fakeSupabase({ user_profiles: { rows: { stripe_subscription_id: null } } });

    const res = await POST(req({}));

    expect(res.status).toBe(200);
    const write = updateFor('user_profiles');
    expect(write?.payload).toMatchObject({ plan: 'pro', stripe_subscription_id: 'sub_1', payment_failed_at: null });
    expect(write?.filters).toEqual([{ column: 'id', value: 'user_1' }]);
    expect(captureServerEvent).toHaveBeenCalledTimes(1);
    expect((captureServerEvent.mock.calls[0][0] as { event: string }).event).toBe('trial_started');
  });

  test('trial_started carries the email domain and alias flag, never the address (FRESCO-923)', async () => {
    constructEvent.mockReturnValue({
      id: 'evt_1',
      type: 'checkout.session.completed',
      data: { object: { subscription: 'sub_1', client_reference_id: 'user_1', customer: 'cus_1', payment_status: 'no_payment_required' } },
    });
    subscriptionsRetrieve.mockResolvedValue(subscription({ status: 'trialing' }));
    supa = fakeSupabase({ user_profiles: { rows: { stripe_subscription_id: null } } }, authWithEmail('ana+prueba7@gmail.com'));

    await POST(req({}));

    const { properties } = captureServerEvent.mock.calls[0][0] as { properties: Record<string, unknown> };
    expect(properties).toMatchObject({ email_domain: 'gmail.com', email_plus_alias: true });
    expect(JSON.stringify(properties)).not.toContain('ana');
  });

  test('trial_started still fires, without the signals, when the user lookup fails (FRESCO-923)', async () => {
    constructEvent.mockReturnValue({
      id: 'evt_1',
      type: 'checkout.session.completed',
      data: { object: { subscription: 'sub_1', client_reference_id: 'user_1', customer: 'cus_1', payment_status: 'no_payment_required' } },
    });
    subscriptionsRetrieve.mockResolvedValue(subscription({ status: 'trialing' }));
    supa = fakeSupabase({ user_profiles: { rows: { stripe_subscription_id: null } } }, authWithEmail(null));

    const res = await POST(req({}));

    expect(res.status).toBe(200);
    const call = captureServerEvent.mock.calls[0][0] as { event: string, properties: Record<string, unknown> };
    expect(call.event).toBe('trial_started');
    expect(call.properties).not.toHaveProperty('email_domain');
  });

  test('does not re-fire the funnel event on a retry of an already-processed delivery', async () => {
    constructEvent.mockReturnValue({
      id: 'evt_1',
      type: 'checkout.session.completed',
      data: { object: { subscription: 'sub_1', client_reference_id: 'user_1', customer: 'cus_1', payment_status: 'no_payment_required' } },
    });
    subscriptionsRetrieve.mockResolvedValue(subscription());
    supa = fakeSupabase({ user_profiles: { rows: { stripe_subscription_id: 'sub_1' } } });

    await POST(req({}));

    expect(updateFor('user_profiles')?.payload).toMatchObject({ plan: 'pro' });
    expect(captureServerEvent).not.toHaveBeenCalled();
  });
});

describe('POST /api/stripe/webhook — customer.subscription.updated', () => {
  function updatedEvent(sub: unknown, previousAttributes: unknown = {}) {
    return { id: 'evt_2', type: 'customer.subscription.updated', data: { object: sub, previous_attributes: previousAttributes } };
  }

  test('past_due sets payment_failed_at and leaves plan untouched', async () => {
    constructEvent.mockReturnValue(updatedEvent(subscription({ status: 'past_due' })));
    supa = fakeSupabase({ user_profiles: { rows: { id: 'user_1', stripe_subscription_id: 'sub_1' } } });

    await POST(req({}));

    const write = updateFor('user_profiles');
    expect(Object.keys(write!.payload)).toEqual(['payment_failed_at']);
    expect(write!.payload.payment_failed_at).toBeString();
  });

  test('past_due fires payment_failed once per retry cycle (FRESCO-793)', async () => {
    constructEvent.mockReturnValue(updatedEvent(subscription({ status: 'past_due' })));
    supa = fakeSupabase({ user_profiles: { rows: { id: 'user_1', plan: 'pro', payment_failed_at: null, stripe_subscription_id: 'sub_1' } } });

    await POST(req({}));

    const call = captureServerEvent.mock.calls[0][0] as { event: string, distinctId: string };
    expect(call.event).toBe('payment_failed');
    expect(call.distinctId).toBe('user_1');
  });

  test('past_due does not re-fire payment_failed while the aviso is already set (FRESCO-793)', async () => {
    constructEvent.mockReturnValue(updatedEvent(subscription({ status: 'past_due' })));
    supa = fakeSupabase({ user_profiles: { rows: { id: 'user_1', plan: 'pro', payment_failed_at: '2026-10-01T00:00:00Z', stripe_subscription_id: 'sub_1' } } });

    await POST(req({}));

    expect(captureServerEvent).not.toHaveBeenCalled();
  });

  test('recovered active clears payment_failed_at and keeps Pro', async () => {
    constructEvent.mockReturnValue(updatedEvent(subscription({ status: 'active' }), { status: 'past_due' }));
    supa = fakeSupabase({ user_profiles: { rows: { id: 'user_1', stripe_subscription_id: 'sub_1' } } });

    await POST(req({}));

    expect(updateFor('user_profiles')?.payload).toMatchObject({ plan: 'pro', payment_failed_at: null });
    // past_due -> active recovery is not a funnel event
    expect(captureServerEvent).not.toHaveBeenCalled();
  });

  test('unpaid downgrades to Free', async () => {
    constructEvent.mockReturnValue(updatedEvent(subscription({ status: 'unpaid' })));
    supa = fakeSupabase({ user_profiles: { rows: { id: 'user_1', stripe_subscription_id: 'sub_1' } } });

    await POST(req({}));

    expect(updateFor('user_profiles')?.payload).toMatchObject({ plan: 'free', payment_failed_at: null });
    expect((captureServerEvent.mock.calls[0][0] as { event: string }).event).toBe('plan_downgraded');
  });

  test('trial converting to paid fires trial_converted_to_paid', async () => {
    constructEvent.mockReturnValue(updatedEvent(subscription({ status: 'active' }), { status: 'trialing' }));
    supa = fakeSupabase({ user_profiles: { rows: { id: 'user_1', stripe_subscription_id: 'sub_1' } } });

    await POST(req({}));

    expect((captureServerEvent.mock.calls[0]?.[0] as { event: string })?.event).toBe('trial_converted_to_paid');
  });

  test('ignores an out-of-order event whose subscription id does not match the row', async () => {
    constructEvent.mockReturnValue(updatedEvent(subscription({ id: 'sub_OLD', status: 'active' })));
    supa = fakeSupabase({ user_profiles: { rows: { id: 'user_1', stripe_subscription_id: 'sub_NEW' } } });

    await POST(req({}));

    expect(supa.updates).toHaveLength(0);
  });
});

describe('POST /api/stripe/webhook — customer.subscription.deleted', () => {
  test('downgrades to Free and fires subscription_cancelled with the reason', async () => {
    constructEvent.mockReturnValue({
      id: 'evt_3',
      type: 'customer.subscription.deleted',
      data: { object: subscription({ status: 'canceled', cancellation_details: { reason: 'payment_failed' } }) },
    });
    supa = fakeSupabase({ user_profiles: { rows: { id: 'user_1', stripe_subscription_id: 'sub_1' } } });

    await POST(req({}));

    expect(updateFor('user_profiles')?.payload).toMatchObject({ plan: 'free', payment_failed_at: null });
    const call = captureServerEvent.mock.calls[0][0] as { event: string, properties: { reason: string } };
    expect(call.event).toBe('subscription_cancelled');
    expect(call.properties.reason).toBe('payment_failed');
    expect((captureServerEvent.mock.calls[1][0] as { event: string }).event).toBe('plan_downgraded');
  });

  test('does not count plan_downgraded twice when the unpaid branch already downgraded (FRESCO-793)', async () => {
    constructEvent.mockReturnValue({
      id: 'evt_3b',
      type: 'customer.subscription.deleted',
      data: { object: subscription({ status: 'canceled', cancellation_details: { reason: 'payment_failed' } }) },
    });
    supa = fakeSupabase({ user_profiles: { rows: { id: 'user_1', plan: 'free', stripe_subscription_id: 'sub_1' } } });

    await POST(req({}));

    const events = captureServerEvent.mock.calls.map(c => (c[0] as { event: string }).event);
    expect(events).toEqual(['subscription_cancelled']);
  });
});

describe('POST /api/stripe/webhook — charge.refunded (FRESCO-900)', () => {
  const PERIOD_START = NOW_S - 10 * 86_400;

  function refundEvent(charge: Record<string, unknown> = {}) {
    return {
      id: 'evt_r1',
      type: 'charge.refunded',
      data: { object: { id: 'ch_1', customer: 'cus_1', payment_intent: 'pi_1', refunded: true, amount: 499, amount_refunded: 499, created: NOW_S - 60, ...charge } },
    };
  }

  function activeSubscription(overrides: Record<string, unknown> = {}) {
    return subscription({
      status: 'active',
      items: { data: [{ price: { id: PRICE }, current_period_start: PERIOD_START, current_period_end: PERIOD_START + 30 * 86_400 }] },
      ...overrides,
    });
  }

  beforeEach(() => {
    supa = fakeSupabase({ user_profiles: { rows: { id: 'user_1', plan: 'pro', stripe_subscription_id: 'sub_1' } } });
    subscriptionsRetrieve.mockResolvedValue(activeSubscription());
    chargePaidForSubscription('sub_1');
  });

  /** FRESCO-1002: charge -> payment intent -> invoice -> subscription, as Stripe reports it. */
  function chargePaidForSubscription(subscriptionId: string | null) {
    invoicePaymentsList.mockResolvedValue({ data: [{ invoice: 'in_1' }] });
    invoicesRetrieve.mockResolvedValue({ parent: subscriptionId ? { subscription_details: { subscription: subscriptionId } } : null });
  }

  test('a full refund of this period\'s charge cancels the subscription without prorating or invoicing', async () => {
    constructEvent.mockReturnValue(refundEvent());

    const res = await POST(req({}));

    expect(res.status).toBe(200);
    expect(subscriptionsRetrieve).toHaveBeenCalledWith('sub_1');
    expect(subscriptionsCancel).toHaveBeenCalledTimes(1);
    expect(subscriptionsCancel).toHaveBeenCalledWith('sub_1', {
      cancellation_details: { comment: 'refund:ch_1' },
      prorate: false,
      invoice_now: false,
    });
  });

  test('it does not touch the profile: the downgrade comes from customer.subscription.deleted', async () => {
    constructEvent.mockReturnValue(refundEvent());

    await POST(req({}));

    expect(supa.updates).toHaveLength(0);
  });

  test('the event is claimed by its id and completed, like every other handled event', async () => {
    constructEvent.mockReturnValue(refundEvent());

    await POST(req({}));

    expect(claimWebhookEvent).toHaveBeenCalledTimes(1);
    expect((claimWebhookEvent.mock.calls[0][1] as { eventId: string, eventType: string })).toEqual({ eventId: 'evt_r1', eventType: 'charge.refunded' });
    expect(completeWebhookEvent).toHaveBeenCalledTimes(1);
  });

  test('a partial refund does nothing, and does not even look the subscription up', async () => {
    constructEvent.mockReturnValue(refundEvent({ refunded: false, amount_refunded: 100 }));

    await POST(req({}));

    expect(subscriptionsRetrieve).not.toHaveBeenCalled();
    expect(subscriptionsCancel).not.toHaveBeenCalled();
  });

  test('a refund of a charge from an earlier period does nothing', async () => {
    constructEvent.mockReturnValue(refundEvent({ created: PERIOD_START - 86_400 }));

    await POST(req({}));

    expect(subscriptionsCancel).not.toHaveBeenCalled();
  });

  test('a subscription that already ended is left alone (the account deletion refund lands here)', async () => {
    constructEvent.mockReturnValue(refundEvent());
    subscriptionsRetrieve.mockResolvedValue(activeSubscription({ status: 'canceled' }));

    await POST(req({}));

    expect(subscriptionsCancel).not.toHaveBeenCalled();
  });

  test('a customer with no profile is ignored', async () => {
    constructEvent.mockReturnValue(refundEvent());
    supa = fakeSupabase({ user_profiles: { rows: null } });

    const res = await POST(req({}));

    expect(res.status).toBe(200);
    expect(subscriptionsRetrieve).not.toHaveBeenCalled();
    expect(subscriptionsCancel).not.toHaveBeenCalled();
  });

  test('a profile with no subscription on file is ignored', async () => {
    constructEvent.mockReturnValue(refundEvent());
    supa = fakeSupabase({ user_profiles: { rows: { id: 'user_1', plan: 'free', stripe_subscription_id: null } } });

    await POST(req({}));

    expect(subscriptionsRetrieve).not.toHaveBeenCalled();
    expect(subscriptionsCancel).not.toHaveBeenCalled();
  });

  test('a charge with no customer is ignored', async () => {
    constructEvent.mockReturnValue(refundEvent({ customer: null }));

    await POST(req({}));

    expect(subscriptionsRetrieve).not.toHaveBeenCalled();
    expect(subscriptionsCancel).not.toHaveBeenCalled();
  });

  test('when Stripe refuses the cancellation it logs, gives the claim back and still answers 200', async () => {
    constructEvent.mockReturnValue(refundEvent());
    subscriptionsCancel.mockRejectedValue(new Error('stripe down'));

    const res = await POST(req({}));

    expect(res.status).toBe(200);
    expect(captureException).toHaveBeenCalledTimes(1);
    expect(releaseWebhookEvent).toHaveBeenCalledTimes(1);
    expect(completeWebhookEvent).not.toHaveBeenCalled();
  });
});

describe('POST /api/stripe/webhook — FRESCO-1002 refund of another subscription (audit 7b: A7-PAY-05)', () => {
  const PERIOD_START = NOW_S - 10 * 86_400;
  const refund = { id: 'evt_r2', type: 'charge.refunded', data: { object: { id: 'ch_old', customer: 'cus_1', payment_intent: 'pi_old', refunded: true, created: NOW_S - 60 } } };

  beforeEach(() => {
    supa = fakeSupabase({ user_profiles: { rows: { id: 'user_1', plan: 'pro', stripe_subscription_id: 'sub_current' } } });
    subscriptionsRetrieve.mockResolvedValue(subscription({ id: 'sub_current', status: 'active', items: { data: [{ price: { id: PRICE }, current_period_start: PERIOD_START, current_period_end: PERIOD_START + 30 * 86_400 }] } }));
    constructEvent.mockReturnValue(refund);
  });

  test('refunding the OLD subscription\'s charge leaves the current subscription alone', async () => {
    invoicePaymentsList.mockResolvedValue({ data: [{ invoice: 'in_old' }] });
    invoicesRetrieve.mockResolvedValue({ parent: { subscription_details: { subscription: 'sub_old' } } });

    const res = await POST(req({}));

    expect(res.status).toBe(200);
    expect(subscriptionsCancel).not.toHaveBeenCalled();
    expect(completeWebhookEvent).toHaveBeenCalledTimes(1);
  });

  test('a charge whose subscription cannot be told cancels nothing', async () => {
    invoicePaymentsList.mockResolvedValue({ data: [] });

    await POST(req({}));

    expect(subscriptionsCancel).not.toHaveBeenCalled();
  });

  test('a Stripe outage while looking the charge up answers 500 and gives the claim back, so Stripe retries', async () => {
    invoicePaymentsList.mockRejectedValue(Object.assign(new Error('stripe 503'), { type: 'StripeAPIError', statusCode: 503 }));

    const res = await POST(req({}));

    expect(res.status).toBe(500);
    expect(releaseWebhookEvent).toHaveBeenCalledTimes(1);
    expect(completeWebhookEvent).not.toHaveBeenCalled();
  });
});

describe('POST /api/stripe/webhook — FRESCO-1002 decide from the live subscription (audit 7b: A7-PAY-09)', () => {
  const updated = (sub: unknown) => ({ id: 'evt_u', type: 'customer.subscription.updated', data: { object: sub, previous_attributes: {} } });
  const deleted = (sub: unknown) => ({ id: 'evt_d', type: 'customer.subscription.deleted', data: { object: sub } });
  const proProfile = () => fakeSupabase({ user_profiles: { rows: { id: 'user_1', plan: 'pro', stripe_subscription_id: 'sub_1' } } });
  const stripeSays = (overrides: Record<string, unknown>) => subscriptionsRetrieve.mockResolvedValue(subscription({ ...overrides }));

  test('a late `active` update after the subscription was deleted writes nothing', async () => {
    constructEvent.mockReturnValue(updated(subscription({ status: 'active' })));
    supa = proProfile();
    stripeSays({ status: 'canceled' });

    const res = await POST(req({}));

    expect(res.status).toBe(200);
    expect(supa.updates).toHaveLength(0);
    expect(captureServerEvent).not.toHaveBeenCalled();
    expect(completeWebhookEvent).toHaveBeenCalledTimes(1);
  });

  test('an update for a subscription Stripe no longer has writes nothing', async () => {
    constructEvent.mockReturnValue(updated(subscription({ status: 'active' })));
    supa = proProfile();
    subscriptionsRetrieve.mockRejectedValue(Object.assign(new Error('No such subscription'), { type: 'StripeInvalidRequestError', code: 'resource_missing', statusCode: 404 }));

    expect((await POST(req({}))).status).toBe(200);
    expect(supa.updates).toHaveLength(0);
  });

  test('what Stripe says now wins over the event: an `active` event for a subscription that is `unpaid` now downgrades', async () => {
    constructEvent.mockReturnValue(updated(subscription({ status: 'active' })));
    supa = proProfile();
    stripeSays({ status: 'unpaid' });

    await POST(req({}));

    expect(supa.updates.find(u => u.table === 'user_profiles')?.payload).toMatchObject({ plan: 'free' });
  });

  test('the renewal date comes from the live subscription, not from the event', async () => {
    constructEvent.mockReturnValue(updated(subscription({ status: 'active', items: { data: [{ price: { id: PRICE }, current_period_end: NOW_S + 1_000 }] } })));
    supa = proProfile();
    stripeSays({ status: 'active', items: { data: [{ price: { id: PRICE }, current_period_end: NOW_S + 30 * 86_400 }] } });

    await POST(req({}));

    const expires = supa.updates.find(u => u.table === 'user_profiles')?.payload.plan_expires_at as string;
    expect(new Date(expires).getTime() / 1000).toBeCloseTo(NOW_S + 30 * 86_400, -1);
  });

  test('a `deleted` for a subscription Stripe still holds live is the stale half of an out-of-order pair: no downgrade', async () => {
    constructEvent.mockReturnValue(deleted(subscription({ status: 'canceled' })));
    supa = proProfile();
    stripeSays({ status: 'active' });

    await POST(req({}));

    expect(supa.updates).toHaveLength(0);
    expect(captureServerEvent).not.toHaveBeenCalled();
  });

  test('a `deleted` for a subscription Stripe no longer has still downgrades', async () => {
    constructEvent.mockReturnValue(deleted(subscription({ status: 'canceled' })));
    supa = proProfile();
    subscriptionsRetrieve.mockRejectedValue(Object.assign(new Error('No such subscription'), { code: 'resource_missing', statusCode: 404 }));

    await POST(req({}));

    expect(supa.updates.find(u => u.table === 'user_profiles')?.payload).toMatchObject({ plan: 'free' });
  });

  test.each([
    ['a Stripe 5xx', { type: 'StripeAPIError', statusCode: 503 }],
    ['a dropped connection', { type: 'StripeConnectionError' }],
    ['a rate limit', { type: 'StripeRateLimitError', statusCode: 429 }],
  ])('%s while reading the subscription answers 500 and gives the claim back', async (_name, stripeError) => {
    constructEvent.mockReturnValue(updated(subscription({ status: 'active' })));
    supa = proProfile();
    subscriptionsRetrieve.mockRejectedValue(Object.assign(new Error('stripe'), stripeError));

    const res = await POST(req({}));

    expect(res.status).toBe(500);
    expect(releaseWebhookEvent).toHaveBeenCalledTimes(1);
    expect(completeWebhookEvent).not.toHaveBeenCalled();
    expect(supa.updates).toHaveLength(0);
  });

  test('a non-transient failure (a bug, a bad request) stays a logged 200: retrying would repeat it', async () => {
    constructEvent.mockReturnValue(updated(subscription({ status: 'active' })));
    supa = proProfile();
    subscriptionsRetrieve.mockRejectedValue(Object.assign(new Error('bad request'), { type: 'StripeInvalidRequestError', statusCode: 400 }));

    const res = await POST(req({}));

    expect(res.status).toBe(200);
    expect(releaseWebhookEvent).toHaveBeenCalledTimes(1);
  });
});

describe('POST /api/stripe/webhook — failure handling', () => {
  test('logs and still returns 200 when the Supabase write errors', async () => {
    constructEvent.mockReturnValue({
      id: 'evt_4',
      type: 'customer.subscription.deleted',
      data: { object: subscription() },
    });
    supa = fakeSupabase({ user_profiles: { rows: { id: 'user_1', stripe_subscription_id: 'sub_1' }, updateError: new Error('db down') } });

    const res = await POST(req({}));

    expect(res.status).toBe(200);
  });

  test('an unrecognised event type is a 200 no-op', async () => {
    constructEvent.mockReturnValue({ id: 'evt_5', type: 'invoice.paid', data: { object: {} } });

    const res = await POST(req({}));

    expect(res.status).toBe(200);
    expect(supa.updates).toHaveLength(0);
  });
});

describe('POST /api/stripe/webhook — FRESCO-429 subscription confirmation email', () => {
  test('sends the confirmation email for a new subscription', async () => {
    const sub = subscription({ status: 'trialing' });
    constructEvent.mockReturnValue({
      id: 'evt_6',
      type: 'checkout.session.completed',
      data: { object: { subscription: 'sub_1', client_reference_id: 'user_1', customer: 'cus_1', payment_status: 'no_payment_required' } },
    });
    subscriptionsRetrieve.mockResolvedValue(sub);
    supa = fakeSupabase({ user_profiles: { rows: { stripe_subscription_id: null } } }, authWithEmail('pro@example.com'));

    const res = await POST(req({}));

    expect(res.status).toBe(200);
    expect(sendSubscriptionConfirmationEmail).toHaveBeenCalledTimes(1);
    const call = sendSubscriptionConfirmationEmail.mock.calls[0][0] as Record<string, unknown>;
    expect(call.to).toBe('pro@example.com');
    expect(call.priceFormatted).toBeString();
    expect(call.nextRenewalDateFormatted).toBeString();
    expect(call.manageSubscriptionUrl).toContain('/profile');
  });

  test('does not send when the subscription already existed (not a new grant)', async () => {
    constructEvent.mockReturnValue({
      id: 'evt_7',
      type: 'checkout.session.completed',
      data: { object: { subscription: 'sub_1', client_reference_id: 'user_1', customer: 'cus_1', payment_status: 'no_payment_required' } },
    });
    subscriptionsRetrieve.mockResolvedValue(subscription());
    supa = fakeSupabase({ user_profiles: { rows: { stripe_subscription_id: 'sub_1' } } }, authWithEmail('pro@example.com'));

    await POST(req({}));

    expect(sendSubscriptionConfirmationEmail).not.toHaveBeenCalled();
  });

  /** FRESCO-1005: a rejected send is no longer only a console line. */
  const emailFailureTags = () => captureException.mock.calls
    .map(call => (call[1] as { tags?: Record<string, string> } | undefined)?.tags)
    .filter(tags => tags?.email === 'subscription-confirmation');

  test('still 200s when the send throws — the subscription write already succeeded — and reports it to Sentry and leaves a pending row (FRESCO-1005)', async () => {
    constructEvent.mockReturnValue({
      id: 'evt_8',
      type: 'checkout.session.completed',
      data: { object: { subscription: 'sub_1', client_reference_id: 'user_1', customer: 'cus_1', payment_status: 'no_payment_required' } },
    });
    subscriptionsRetrieve.mockResolvedValue(subscription({ status: 'trialing' }));
    supa = fakeSupabase({ user_profiles: { rows: { stripe_subscription_id: null } } }, authWithEmail('pro@example.com'));
    sendSubscriptionConfirmationEmail.mockImplementation(async () => { throw new Error('resend down'); });

    const res = await POST(req({}));

    expect(res.status).toBe(200);
    expect(updateFor('user_profiles')?.payload).toMatchObject({ plan: 'pro' });
    expect(emailFailureTags()).toHaveLength(1);
    expect(supa.upserts).toEqual([{
      table: 'pending_confirmation_emails',
      payload: { subscription_id: 'sub_1', user_id: 'user_1', last_error: 'resend down' },
      options: { onConflict: 'subscription_id', ignoreDuplicates: true },
    }]);
  });

  test('a pending row that cannot be written is reported too, and the webhook still answers 200 (FRESCO-1005)', async () => {
    constructEvent.mockReturnValue({
      id: 'evt_8b',
      type: 'checkout.session.completed',
      data: { object: { subscription: 'sub_1', client_reference_id: 'user_1', customer: 'cus_1', payment_status: 'no_payment_required' } },
    });
    subscriptionsRetrieve.mockResolvedValue(subscription({ status: 'trialing' }));
    supa = fakeSupabase({ user_profiles: { rows: { stripe_subscription_id: null } }, pending_confirmation_emails: { upsertError: new Error('db down') } }, authWithEmail('pro@example.com'));
    sendSubscriptionConfirmationEmail.mockImplementation(async () => { throw new Error('resend down'); });

    const res = await POST(req({}));

    expect(res.status).toBe(200);
    expect(emailFailureTags()).toHaveLength(2);
  });

  test('the email says the plan period and, in the trial, that nothing is charged today (FRESCO-1005)', async () => {
    constructEvent.mockReturnValue({
      id: 'evt_8c',
      type: 'checkout.session.completed',
      data: { object: { subscription: 'sub_1', client_reference_id: 'user_1', customer: 'cus_1', payment_status: 'no_payment_required' } },
    });
    subscriptionsRetrieve.mockResolvedValue(subscription({
      status: 'trialing',
      items: { data: [{ price: { id: PRICE, unit_amount: 499, currency: 'eur', recurring: { interval: 'year' } }, current_period_end: NOW_S + 30 * 86_400 }] },
    }));
    supa = fakeSupabase({ user_profiles: { rows: { stripe_subscription_id: null } } }, authWithEmail('pro@example.com'));

    await POST(req({}));

    const sent = sendSubscriptionConfirmationEmail.mock.calls[0][0] as { interval: string, trialDays?: number, priceFormatted: string };
    expect(sent.interval).toBe('year');
    expect(sent.trialDays).toBe(7);
    expect(sent.priceFormatted).toContain('4,99');
  });

  test('logs and still 200s when the account has no email on file', async () => {
    constructEvent.mockReturnValue({
      id: 'evt_9',
      type: 'checkout.session.completed',
      data: { object: { subscription: 'sub_1', client_reference_id: 'user_1', customer: 'cus_1', payment_status: 'no_payment_required' } },
    });
    subscriptionsRetrieve.mockResolvedValue(subscription({ status: 'trialing' }));
    supa = fakeSupabase({ user_profiles: { rows: { stripe_subscription_id: null } } }, authWithEmail(null));

    const res = await POST(req({}));

    expect(res.status).toBe(200);
    expect(sendSubscriptionConfirmationEmail).not.toHaveBeenCalled();
    expect(emailFailureTags()).toHaveLength(1);
    expect(supa.upserts.map(u => u.table)).toEqual(['pending_confirmation_emails']);
  });
});

describe('POST /api/stripe/webhook — idempotency by event.id and payment_status (FRESCO-816, A6-S10)', () => {
  function checkoutEvent(id: string, type: string, paymentStatus: string) {
    return {
      id,
      type,
      data: { object: { subscription: 'sub_1', client_reference_id: 'user_1', customer: 'cus_1', payment_status: paymentStatus } },
    };
  }

  test('claims the event by id and type before it runs', async () => {
    constructEvent.mockReturnValue(checkoutEvent('evt_c1', 'checkout.session.completed', 'no_payment_required'));
    subscriptionsRetrieve.mockResolvedValue(subscription());
    supa = fakeSupabase({ user_profiles: { rows: { stripe_subscription_id: null } } });

    await POST(req({}));

    expect(claimWebhookEvent).toHaveBeenCalledTimes(1);
    expect(claimWebhookEvent.mock.calls[0][1]).toEqual({ eventId: 'evt_c1', eventType: 'checkout.session.completed' });
  });

  test('a re-delivery of an event already claimed answers 200 and runs nothing', async () => {
    claimWebhookEvent.mockResolvedValue({ state: 'already_done' });
    constructEvent.mockReturnValue(checkoutEvent('evt_c1', 'checkout.session.completed', 'no_payment_required'));
    subscriptionsRetrieve.mockResolvedValue(subscription());

    const res = await POST(req({}));

    expect(res.status).toBe(200);
    expect(subscriptionsRetrieve).not.toHaveBeenCalled();
    expect(supa.updates).toEqual([]);
    expect(captureServerEvent).not.toHaveBeenCalled();
    expect(releaseWebhookEvent).not.toHaveBeenCalled();
  });

  test('answers 500 and processes nothing when the claim cannot be recorded, so Stripe retries', async () => {
    claimWebhookEvent.mockRejectedValue(new Error('db down'));
    constructEvent.mockReturnValue(checkoutEvent('evt_c1', 'checkout.session.completed', 'no_payment_required'));

    const res = await POST(req({}));

    expect(res.status).toBe(500);
    expect(subscriptionsRetrieve).not.toHaveBeenCalled();
    expect(supa.updates).toEqual([]);
  });

  test('gives the claim back when the handler throws, so a resend of the failed event still runs', async () => {
    constructEvent.mockReturnValue(checkoutEvent('evt_c2', 'checkout.session.completed', 'no_payment_required'));
    subscriptionsRetrieve.mockRejectedValue(new Error('stripe down'));

    const res = await POST(req({}));

    expect(res.status).toBe(200);
    expect(releaseWebhookEvent.mock.calls[0][1]).toEqual({ eventId: 'evt_c2', claimedAt: CLAIMED_AT });
  });

  test('an event type the route does not act on is not claimed', async () => {
    constructEvent.mockReturnValue({ id: 'evt_x', type: 'invoice.created', data: { object: {} } });

    const res = await POST(req({}));

    expect(res.status).toBe(200);
    expect(claimWebhookEvent).not.toHaveBeenCalled();
  });

  test('an unpaid checkout (delayed payment method) grants no Pro and gives the claim back', async () => {
    constructEvent.mockReturnValue(checkoutEvent('evt_u1', 'checkout.session.completed', 'unpaid'));
    subscriptionsRetrieve.mockResolvedValue(subscription({ status: 'incomplete' }));
    supa = fakeSupabase({ user_profiles: { rows: { stripe_subscription_id: null } } });

    const res = await POST(req({}));

    expect(res.status).toBe(200);
    expect(updateFor('user_profiles')).toBeUndefined();
    expect(captureServerEvent).not.toHaveBeenCalled();
    expect(releaseWebhookEvent.mock.calls[0][1]).toEqual({ eventId: 'evt_u1', claimedAt: CLAIMED_AT });
  });

  test('checkout.session.async_payment_succeeded grants Pro once the money arrives', async () => {
    constructEvent.mockReturnValue(checkoutEvent('evt_a1', 'checkout.session.async_payment_succeeded', 'paid'));
    subscriptionsRetrieve.mockResolvedValue(subscription({ status: 'active', trial_end: NOW_S + 7 * 86_400 }));
    supa = fakeSupabase({ user_profiles: { rows: { stripe_subscription_id: null } } });

    const res = await POST(req({}));

    expect(res.status).toBe(200);
    expect(updateFor('user_profiles')?.payload).toMatchObject({ plan: 'pro', stripe_subscription_id: 'sub_1' });
  });

  test('a replayed checkout whose subscription has since been canceled re-grants nothing, even with no claim on file', async () => {
    constructEvent.mockReturnValue(checkoutEvent('evt_old', 'checkout.session.completed', 'no_payment_required'));
    subscriptionsRetrieve.mockResolvedValue(subscription({ status: 'canceled' }));
    supa = fakeSupabase({ user_profiles: { rows: { stripe_subscription_id: 'sub_1' } } });

    const res = await POST(req({}));

    expect(res.status).toBe(200);
    expect(updateFor('user_profiles')).toBeUndefined();
    expect(captureServerEvent).not.toHaveBeenCalled();
  });
});

describe('POST /api/stripe/webhook — expirable claim and completed state (FRESCO-909, C-03)', () => {
  function checkoutEvent(id: string) {
    return {
      id,
      type: 'checkout.session.completed',
      data: { object: { subscription: 'sub_1', client_reference_id: 'user_1', customer: 'cus_1', payment_status: 'paid' } },
    };
  }

  function arrange(id: string) {
    constructEvent.mockReturnValue(checkoutEvent(id));
    subscriptionsRetrieve.mockResolvedValue(subscription({ status: 'active' }));
    supa = fakeSupabase({ user_profiles: { rows: { stripe_subscription_id: null } } }, authWithEmail('pro@example.com'));
  }

  test('a claim left by a crashed run, past the TTL, is retaken: Pro is granted and the event is completed', async () => {
    arrange('evt_crash');
    claimWebhookEvent.mockResolvedValue({ state: 'taken_over', claimAgeSeconds: 900, claimedAt: CLAIMED_AT });

    const res = await POST(req({}));

    expect(res.status).toBe(200);
    expect(updateFor('user_profiles')?.payload).toMatchObject({ plan: 'pro', stripe_subscription_id: 'sub_1' });
    expect(completeWebhookEvent.mock.calls[0][1]).toEqual({ eventId: 'evt_crash', claimedAt: CLAIMED_AT });
    expect(releaseWebhookEvent).not.toHaveBeenCalled();
  });

  test('the takeover of an expired claim is reported to Sentry as a warning with the claim age and the event tags', async () => {
    arrange('evt_crash');
    claimWebhookEvent.mockResolvedValue({ state: 'taken_over', claimAgeSeconds: 900, claimedAt: CLAIMED_AT });

    await POST(req({}));

    const [message, hint] = captureMessage.mock.calls[0] as [string, { level: string, tags: Record<string, string>, extra: Record<string, unknown> }];
    expect(message).toContain('expired');
    expect(hint.level).toBe('warning');
    expect(hint.tags).toEqual({ stripe_event_id: 'evt_crash', stripe_event_type: 'checkout.session.completed' });
    expect(hint.extra).toEqual({ claim_age_seconds: 900 });
  });

  test('a fresh claim held by another worker is not retaken: 409 so Stripe retries later, nothing runs', async () => {
    // A 2xx would tell Stripe the event was delivered and stop its retries while the claim
    // may be dead for up to the TTL; 409 keeps Stripe's backoff going until it completes or expires.
    arrange('evt_busy');
    claimWebhookEvent.mockResolvedValue({ state: 'in_flight' });

    const res = await POST(req({}));

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'Evento en proceso.' });
    expect(subscriptionsRetrieve).not.toHaveBeenCalled();
    expect(supa.updates).toEqual([]);
    expect(completeWebhookEvent).not.toHaveBeenCalled();
    expect(releaseWebhookEvent).not.toHaveBeenCalled();
  });

  test('a failure reporting the takeover to Sentry never leaves the claim open: the event still runs and completes', async () => {
    arrange('evt_sentry');
    claimWebhookEvent.mockResolvedValue({ state: 'taken_over', claimAgeSeconds: 900, claimedAt: CLAIMED_AT });
    captureMessage.mockImplementationOnce(() => { throw new Error('sentry down'); });

    const res = await POST(req({}));

    expect(res.status).toBe(200);
    expect(completeWebhookEvent).toHaveBeenCalledTimes(1);
    expect(releaseWebhookEvent).not.toHaveBeenCalled();
  });

  test('a completed event is not repeated and is not completed again', async () => {
    arrange('evt_done');
    claimWebhookEvent.mockResolvedValue({ state: 'already_done' });

    const res = await POST(req({}));

    expect(res.status).toBe(200);
    expect(subscriptionsRetrieve).not.toHaveBeenCalled();
    expect(completeWebhookEvent).not.toHaveBeenCalled();
  });

  test('a freshly claimed event is completed after the handler succeeds', async () => {
    arrange('evt_ok');

    await POST(req({}));

    expect(completeWebhookEvent.mock.calls[0][1]).toEqual({ eventId: 'evt_ok', claimedAt: CLAIMED_AT });
  });

  test('when completing the event fails the route still answers 200 and reports it', async () => {
    arrange('evt_nocomplete');
    completeWebhookEvent.mockRejectedValue(new Error('db down'));

    const res = await POST(req({}));

    expect(res.status).toBe(200);
    const [, hint] = captureException.mock.calls[0] as [unknown, { tags: Record<string, string> }];
    expect(hint.tags).toEqual({ stripe_event_id: 'evt_nocomplete', stripe_event_type: 'checkout.session.completed' });
  });

  test('a handler failure releases the claim, does not complete it, and is reported with the event tags', async () => {
    constructEvent.mockReturnValue(checkoutEvent('evt_fail'));
    subscriptionsRetrieve.mockRejectedValue(new Error('stripe down'));

    const res = await POST(req({}));

    expect(res.status).toBe(200);
    expect(releaseWebhookEvent.mock.calls[0][1]).toEqual({ eventId: 'evt_fail', claimedAt: CLAIMED_AT });
    expect(completeWebhookEvent).not.toHaveBeenCalled();
    const [, hint] = captureException.mock.calls[0] as [unknown, { tags: Record<string, string> }];
    expect(hint.tags).toEqual({ stripe_event_id: 'evt_fail', stripe_event_type: 'checkout.session.completed' });
  });

  test('a failed release is reported too, and the route still answers 200', async () => {
    constructEvent.mockReturnValue(checkoutEvent('evt_norelease'));
    subscriptionsRetrieve.mockRejectedValue(new Error('stripe down'));
    releaseWebhookEvent.mockRejectedValue(new Error('db down'));

    const res = await POST(req({}));

    expect(res.status).toBe(200);
    expect(captureException).toHaveBeenCalledTimes(2);
  });
});

/**
 * FRESCO-1001 (audit 7b: A7-PAY-01, ADR-0061): the Stripe mode guard. Every environment shares
 * one database, so an event is accepted only when its `livemode` equals the mode of this deploy's
 * `STRIPE_SECRET_KEY` AND the mode the shared database serves (`billing_mode`).
 */
describe('POST /api/stripe/webhook — Stripe mode guard (FRESCO-1001)', () => {
  const checkoutCompleted = (livemode: boolean) => ({
    id: 'evt_mode',
    type: 'checkout.session.completed',
    livemode,
    data: { object: { subscription: 'sub_1', client_reference_id: 'user_1', customer: 'cus_1', payment_status: 'no_payment_required' } },
  });

  function expectNothingWritten() {
    expect(supa.updates).toEqual([]);
    expect(claimWebhookEvent).not.toHaveBeenCalled();
    expect(subscriptionsRetrieve).not.toHaveBeenCalled();
    expect(captureServerEvent).not.toHaveBeenCalled();
  }

  test('a test-mode checkout.session.completed on a LIVE deploy writes nothing and is refused', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_live_unit';
    databaseLivemode = true;
    constructEvent.mockReturnValue(checkoutCompleted(false));

    const res = await POST(req({}));

    expect(res.status).toBe(400);
    expectNothingWritten();
    expect(captureMessage).toHaveBeenCalledTimes(1);
    expect((captureMessage.mock.calls[0][1] as { tags: Record<string, string> }).tags.stripe_mode_layer).toBe('environment');
  });

  test('the inverse: a live-mode checkout.session.completed on a TEST deploy writes nothing and is refused', async () => {
    constructEvent.mockReturnValue(checkoutCompleted(true));

    const res = await POST(req({}));

    expect(res.status).toBe(400);
    expectNothingWritten();
  });

  test('fresco-pre (A7-PAY-01): a test deploy receiving a test event is refused once the DATABASE is live', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_unit';
    databaseLivemode = true;
    constructEvent.mockReturnValue(checkoutCompleted(false));

    const res = await POST(req({}));

    expect(res.status).toBe(400);
    expectNothingWritten();
    expect((captureMessage.mock.calls[0][1] as { tags: Record<string, string> }).tags.stripe_mode_layer).toBe('database');
  });

  test('a live event on a live deploy with a live database is granted, and the mode is stored next to the ids', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_live_unit';
    databaseLivemode = true;
    constructEvent.mockReturnValue(checkoutCompleted(true));
    subscriptionsRetrieve.mockResolvedValue(subscription({ status: 'trialing' }));
    supa = fakeSupabase({ user_profiles: { rows: { stripe_subscription_id: null } } }, authWithEmail('ana@gmail.com'));

    const res = await POST(req({}));

    expect(res.status).toBe(200);
    expect(updateFor('user_profiles')?.payload).toMatchObject({ plan: 'pro', stripe_customer_id: 'cus_1', stripe_subscription_id: 'sub_1', stripe_livemode: true });
  });

  test('a test event on a test deploy with a test database stores stripe_livemode false', async () => {
    constructEvent.mockReturnValue(checkoutCompleted(false));
    subscriptionsRetrieve.mockResolvedValue(subscription({ status: 'trialing' }));
    supa = fakeSupabase({ user_profiles: { rows: { stripe_subscription_id: null } } }, authWithEmail('ana@gmail.com'));

    expect((await POST(req({}))).status).toBe(200);
    expect(updateFor('user_profiles')?.payload).toMatchObject({ stripe_livemode: false });
  });

  test('fails closed: a deploy whose key has no known mode answers 500 (Stripe retries) and writes nothing', async () => {
    process.env.STRIPE_SECRET_KEY = 'whsec_not_a_key';
    constructEvent.mockReturnValue(checkoutCompleted(false));

    const res = await POST(req({}));

    expect(res.status).toBe(500);
    expectNothingWritten();
    expect(captureException).toHaveBeenCalledTimes(1);
  });

  test('an event type this route does not handle is not checked: 200, nothing written', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_live_unit';
    databaseLivemode = true;
    constructEvent.mockReturnValue({ id: 'evt_other', type: 'customer.created', livemode: false, data: { object: {} } });

    expect((await POST(req({}))).status).toBe(200);
    expect(supa.updates).toEqual([]);
  });

  test('a subscription update whose profile holds ids of the OTHER mode is ignored', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_live_unit';
    databaseLivemode = true;
    constructEvent.mockReturnValue({
      id: 'evt_sub',
      type: 'customer.subscription.updated',
      livemode: true,
      data: { object: subscription({ status: 'active' }), previous_attributes: {} },
    });
    supa = fakeSupabase({ user_profiles: { rows: { id: 'user_1', plan: 'pro', payment_failed_at: null, stripe_subscription_id: 'sub_1', stripe_livemode: false } } });

    expect((await POST(req({}))).status).toBe(200);
    expect(supa.updates).toEqual([]);
  });

  test('a cancellation whose profile holds ids of the OTHER mode does not downgrade it', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_live_unit';
    databaseLivemode = true;
    constructEvent.mockReturnValue({ id: 'evt_del', type: 'customer.subscription.deleted', livemode: true, data: { object: subscription({ status: 'canceled' }) } });
    supa = fakeSupabase({ user_profiles: { rows: { id: 'user_1', plan: 'pro', payment_failed_at: null, stripe_subscription_id: 'sub_1', stripe_livemode: false } } });

    expect((await POST(req({}))).status).toBe(200);
    expect(supa.updates).toEqual([]);
  });
});
