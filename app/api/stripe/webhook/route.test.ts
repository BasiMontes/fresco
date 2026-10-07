import type { RecordedUpdate } from '@/tests/mocks/supabase-query-builder';
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
const captureServerEvent = mock(async (_e: unknown) => {});
const sendSubscriptionConfirmationEmail = mock(async (_p: unknown) => {});
const claimWebhookEvent = mock(async (_client: unknown, _event: unknown): Promise<boolean> => true);
const releaseWebhookEvent = mock(async (_client: unknown, _eventId: string) => {});

let supa = fakeSupabase();

void mock.module('@/lib/stripe', () => ({
  ...realStripe,
  stripe: { webhooks: { constructEvent }, subscriptions: { retrieve: subscriptionsRetrieve } },
  resolveWebhookSecret: () => 'whsec_test',
}));
void mock.module('@/lib/supabase/service', () => ({ createServiceClient: () => supa.client }));
void mock.module('@/lib/posthog/server', () => ({ ...realPosthog, captureServerEvent }));
void mock.module('@/lib/email/resend', () => ({ sendSubscriptionConfirmationEmail }));
void mock.module('@/lib/billing/webhook-events', () => ({ claimWebhookEvent, releaseWebhookEvent }));

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
  constructEvent.mockReset();
  subscriptionsRetrieve.mockReset();
  captureServerEvent.mockClear();
  sendSubscriptionConfirmationEmail.mockReset();
  claimWebhookEvent.mockReset();
  claimWebhookEvent.mockResolvedValue(true);
  releaseWebhookEvent.mockReset();
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
      data: { object: subscription({ cancellation_details: { reason: 'payment_failed' } }) },
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
      data: { object: subscription({ cancellation_details: { reason: 'payment_failed' } }) },
    });
    supa = fakeSupabase({ user_profiles: { rows: { id: 'user_1', plan: 'free', stripe_subscription_id: 'sub_1' } } });

    await POST(req({}));

    const events = captureServerEvent.mock.calls.map(c => (c[0] as { event: string }).event);
    expect(events).toEqual(['subscription_cancelled']);
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

  test('logs and still 200s when the send throws — the subscription write already succeeded', async () => {
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
    claimWebhookEvent.mockResolvedValue(false);
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
    expect(releaseWebhookEvent.mock.calls[0][1]).toBe('evt_c2');
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
    expect(releaseWebhookEvent.mock.calls[0][1]).toBe('evt_u1');
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
