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

let supa = fakeSupabase();

void mock.module('@/lib/stripe', () => ({
  ...realStripe,
  stripe: { webhooks: { constructEvent }, subscriptions: { retrieve: subscriptionsRetrieve } },
  resolveWebhookSecret: () => 'whsec_test',
}));
void mock.module('@/lib/supabase/service', () => ({ createServiceClient: () => supa.client }));
void mock.module('@/lib/posthog/server', () => ({ ...realPosthog, captureServerEvent }));

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

beforeEach(() => {
  process.env.STRIPE_PRICE_ID_PRO_MONTH = PRICE;
  constructEvent.mockReset();
  subscriptionsRetrieve.mockReset();
  captureServerEvent.mockClear();
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
      data: { object: { subscription: 'sub_1', client_reference_id: 'user_1', customer: 'cus_1' } },
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
      data: { object: { subscription: 'sub_1', client_reference_id: 'user_1', customer: 'cus_1' } },
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
