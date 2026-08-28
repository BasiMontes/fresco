import type Stripe from 'stripe';
import { describe, expect, test } from 'bun:test';
import { resolveCancellationCustomerId, resolvePaymentStatusUpdate, resolveProUpdateFromSession, resolveReconciledState, resolveRenewalUpdate } from './stripe';

/**
 * `resolveProUpdateFromSession` is a pure function — no network, no Stripe
 * SDK calls — so these fixtures only need the fields the function actually
 * reads. Cast via `as unknown as Stripe.X` (same pattern as
 * `lib/api/meal-plan.test.ts`/`lib/api/user-profile.test.ts` for their
 * Supabase client fixtures) rather than filling out the SDK's full, deeply
 * nested response shape.
 */
function fakeSession(overrides: Partial<Stripe.Checkout.Session> = {}): Stripe.Checkout.Session {
  return {
    client_reference_id: 'user-123',
    customer: 'cus_abc',
    ...overrides,
  } as unknown as Stripe.Checkout.Session;
}

const PRO_PRICE_ID = 'price_pro_test';

function fakeSubscription(overrides: Partial<Stripe.Subscription> = {}): Stripe.Subscription {
  return {
    id: 'sub_xyz',
    customer: 'cus_abc',
    status: 'active',
    trial_end: 1_700_000_000, // 2023-11-14T22:13:20.000Z
    items: { data: [{ price: { id: PRO_PRICE_ID }, current_period_end: 1_700_000_000 }] }, // 2023-11-14T22:13:20.000Z
    ...overrides,
  } as unknown as Stripe.Subscription;
}

describe('resolveProUpdateFromSession', () => {
  test('maps a completed session + subscription to the expected user_profiles update', () => {
    const result = resolveProUpdateFromSession(fakeSession(), fakeSubscription(), PRO_PRICE_ID);

    expect(result).toEqual({
      userId: 'user-123',
      stripeCustomerId: 'cus_abc',
      stripeSubscriptionId: 'sub_xyz',
      planExpiresAt: '2023-11-14T22:13:20.000Z',
    });
  });

  test('reads the customer id off an expanded customer object, not just a bare string', () => {
    const result = resolveProUpdateFromSession(
      fakeSession({ customer: { id: 'cus_expanded' } as Stripe.Customer }),
      fakeSubscription(),
      PRO_PRICE_ID,
    );

    expect(result.stripeCustomerId).toBe('cus_expanded');
  });

  test('throws when client_reference_id is missing', () => {
    expect(() => resolveProUpdateFromSession(fakeSession({ client_reference_id: null }), fakeSubscription(), PRO_PRICE_ID))
      .toThrow('client_reference_id');
  });

  test('throws when the session has no Stripe customer', () => {
    expect(() => resolveProUpdateFromSession(fakeSession({ customer: null }), fakeSubscription(), PRO_PRICE_ID))
      .toThrow('Stripe customer id');
  });

  test('throws when the subscription has no trial_end', () => {
    expect(() => resolveProUpdateFromSession(fakeSession(), fakeSubscription({ trial_end: null }), PRO_PRICE_ID))
      .toThrow('trial_end');
  });

  test('throws when the subscription price does not match the expected Pro price', () => {
    expect(() => resolveProUpdateFromSession(
      fakeSession(),
      fakeSubscription({ items: { data: [{ price: { id: 'price_some_other_product' } }] } as unknown as Stripe.Subscription['items'] }),
      PRO_PRICE_ID,
    )).toThrow('does not match expected Pro price');
  });
});

describe('resolveRenewalUpdate', () => {
  test('maps an active subscription to a Pro-preserving plan_expires_at refresh', () => {
    const result = resolveRenewalUpdate(fakeSubscription(), PRO_PRICE_ID);

    expect(result).toEqual({
      stripeCustomerId: 'cus_abc',
      planExpiresAt: '2023-11-14T22:13:20.000Z',
    });
  });

  test('reads the customer id off an expanded customer object, not just a bare string', () => {
    const result = resolveRenewalUpdate(fakeSubscription({ customer: { id: 'cus_expanded' } as Stripe.Customer }), PRO_PRICE_ID);

    expect(result.stripeCustomerId).toBe('cus_expanded');
  });

  test('throws when the subscription is not active (e.g. a mid-cycle cancel request)', () => {
    expect(() => resolveRenewalUpdate(fakeSubscription({ status: 'canceled' }), PRO_PRICE_ID))
      .toThrow('is not active');
  });

  test('throws when the subscription has no Stripe customer', () => {
    expect(() => resolveRenewalUpdate(fakeSubscription({ customer: null as unknown as Stripe.Subscription['customer'] }), PRO_PRICE_ID))
      .toThrow('Stripe customer id');
  });

  test('throws when the subscription item has no current_period_end', () => {
    expect(() => resolveRenewalUpdate(fakeSubscription({ items: { data: [{ price: { id: PRO_PRICE_ID }, current_period_end: undefined }] } as unknown as Stripe.Subscription['items'] }), PRO_PRICE_ID))
      .toThrow('current_period_end');
  });

  test('throws when the subscription price does not match the expected Pro price', () => {
    expect(() => resolveRenewalUpdate(
      fakeSubscription({ items: { data: [{ price: { id: 'price_some_other_product' }, current_period_end: 1_700_000_000 }] } as unknown as Stripe.Subscription['items'] }),
      PRO_PRICE_ID,
    )).toThrow('does not match expected Pro price');
  });
});

describe('resolvePaymentStatusUpdate', () => {
  test('returns kind: retrying for a past_due subscription', () => {
    expect(resolvePaymentStatusUpdate(fakeSubscription({ status: 'past_due' })))
      .toEqual({ stripeCustomerId: 'cus_abc', kind: 'retrying' });
  });

  test('returns kind: exhausted for an unpaid subscription (Stripe gave up retrying)', () => {
    expect(resolvePaymentStatusUpdate(fakeSubscription({ status: 'unpaid' })))
      .toEqual({ stripeCustomerId: 'cus_abc', kind: 'exhausted' });
  });

  test('returns kind: recovered for an active subscription', () => {
    expect(resolvePaymentStatusUpdate(fakeSubscription({ status: 'active' })))
      .toEqual({ stripeCustomerId: 'cus_abc', kind: 'recovered' });
  });

  test('returns null for a status out of scope for this signal (e.g. canceled)', () => {
    expect(resolvePaymentStatusUpdate(fakeSubscription({ status: 'canceled' }))).toBeNull();
  });

  test('reads the customer id off an expanded customer object, not just a bare string', () => {
    const result = resolvePaymentStatusUpdate(fakeSubscription({ status: 'past_due', customer: { id: 'cus_expanded' } as Stripe.Customer }));
    expect(result?.stripeCustomerId).toBe('cus_expanded');
  });

  test('throws when the subscription has no Stripe customer', () => {
    expect(() => resolvePaymentStatusUpdate(fakeSubscription({ status: 'past_due', customer: null as unknown as Stripe.Subscription['customer'] })))
      .toThrow('Stripe customer id');
  });
});

describe('resolveReconciledState', () => {
  test('active subscription on the Pro price → pro, expiry from current_period_end, no aviso', () => {
    expect(resolveReconciledState(fakeSubscription({ status: 'active' }), PRO_PRICE_ID)).toEqual({
      action: 'pro',
      planExpiresAt: '2023-11-14T22:13:20.000Z',
      paymentFailed: false,
    });
  });

  test('trialing subscription → pro, expiry from trial_end', () => {
    const sub = fakeSubscription({
      status: 'trialing',
      trial_end: 1_700_500_000,
      items: { data: [{ price: { id: PRO_PRICE_ID }, current_period_end: 1_700_000_000 }] } as unknown as Stripe.Subscription['items'],
    });
    expect(resolveReconciledState(sub, PRO_PRICE_ID)).toEqual({
      action: 'pro',
      planExpiresAt: new Date(1_700_500_000 * 1000).toISOString(),
      paymentFailed: false,
    });
  });

  test('past_due subscription → still pro, but paymentFailed flag set', () => {
    expect(resolveReconciledState(fakeSubscription({ status: 'past_due' }), PRO_PRICE_ID)).toEqual({
      action: 'pro',
      planExpiresAt: '2023-11-14T22:13:20.000Z',
      paymentFailed: true,
    });
  });

  test.each(['canceled', 'unpaid', 'incomplete_expired'] as const)('%s subscription → downgrade', (status) => {
    expect(resolveReconciledState(fakeSubscription({ status }), PRO_PRICE_ID)).toEqual({ action: 'downgrade' });
  });

  test.each(['incomplete', 'paused'] as const)('%s subscription → skip (out-of-scope status)', (status) => {
    const result = resolveReconciledState(fakeSubscription({ status }), PRO_PRICE_ID);
    expect(result.action).toBe('skip');
  });

  test('active subscription on a non-Pro price → skip, never downgrades on the caller side', () => {
    const sub = fakeSubscription({
      status: 'active',
      items: { data: [{ price: { id: 'price_other' }, current_period_end: 1_700_000_000 }] } as unknown as Stripe.Subscription['items'],
    });
    const result = resolveReconciledState(sub, PRO_PRICE_ID);
    expect(result.action).toBe('skip');
    if (result.action === 'skip') { expect(result.reason).toContain('is not the Pro price'); }
  });

  test('active subscription missing current_period_end → skip', () => {
    const sub = fakeSubscription({
      status: 'active',
      items: { data: [{ price: { id: PRO_PRICE_ID }, current_period_end: undefined }] } as unknown as Stripe.Subscription['items'],
    });
    const result = resolveReconciledState(sub, PRO_PRICE_ID);
    expect(result.action).toBe('skip');
  });
});

describe('resolveCancellationCustomerId', () => {
  test('returns the Stripe customer id off an ended subscription', () => {
    expect(resolveCancellationCustomerId(fakeSubscription())).toBe('cus_abc');
  });

  test('reads the customer id off an expanded customer object, not just a bare string', () => {
    expect(resolveCancellationCustomerId(fakeSubscription({ customer: { id: 'cus_expanded' } as Stripe.Customer }))).toBe('cus_expanded');
  });

  test('throws when the subscription has no Stripe customer', () => {
    expect(() => resolveCancellationCustomerId(fakeSubscription({ customer: null as unknown as Stripe.Subscription['customer'] })))
      .toThrow('Stripe customer id');
  });
});
