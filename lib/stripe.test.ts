import type Stripe from 'stripe';
import { afterEach, describe, expect, test } from 'bun:test';
import { getProPriceIds, parseProInterval, resolveAppUrl, resolveCancellationCustomerId, resolvePaymentStatusUpdate, resolveProUpdateFromSession, resolveReconciledState, resolveRenewalUpdate, resolveWebhookSecret } from './stripe';

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
    payment_status: 'no_payment_required',
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
    const result = resolveProUpdateFromSession({ session: fakeSession(), subscription: fakeSubscription(), expectedPriceId: PRO_PRICE_ID });

    expect(result).toEqual({
      userId: 'user-123',
      stripeCustomerId: 'cus_abc',
      stripeSubscriptionId: 'sub_xyz',
      planExpiresAt: '2023-11-14T22:13:20.000Z',
    });
  });

  test('reads the customer id off an expanded customer object, not just a bare string', () => {
    const result = resolveProUpdateFromSession({
      session: fakeSession({ customer: { id: 'cus_expanded' } as Stripe.Customer }),
      subscription: fakeSubscription(),
      expectedPriceId: PRO_PRICE_ID,
    });

    expect(result.stripeCustomerId).toBe('cus_expanded');
  });

  test('grants Pro for a paid session and for one that needed no payment (the trial), A6-S10', () => {
    for (const payment_status of ['paid', 'no_payment_required'] as const) {
      expect(resolveProUpdateFromSession({ session: fakeSession({ payment_status }), subscription: fakeSubscription(), expectedPriceId: PRO_PRICE_ID }).userId).toBe('user-123');
    }
  });

  test('refuses an unpaid session, so a delayed payment method grants nothing until the money arrives (A6-S10)', () => {
    expect(() => resolveProUpdateFromSession({ session: fakeSession({ payment_status: 'unpaid' }), subscription: fakeSubscription(), expectedPriceId: PRO_PRICE_ID }))
      .toThrow('payment_status is unpaid');
  });

  test('grants Pro for a trialing or active subscription only (A6-S10)', () => {
    for (const status of ['trialing', 'active'] as const) {
      expect(resolveProUpdateFromSession({ session: fakeSession(), subscription: fakeSubscription({ status }), expectedPriceId: PRO_PRICE_ID }).stripeSubscriptionId).toBe('sub_xyz');
    }
    for (const status of ['canceled', 'incomplete', 'incomplete_expired', 'unpaid', 'past_due'] as const) {
      expect(() => resolveProUpdateFromSession({ session: fakeSession(), subscription: fakeSubscription({ status }), expectedPriceId: PRO_PRICE_ID }))
        .toThrow(`is ${status}, not trialing or active`);
    }
  });

  test('refuses a session with no payment_status at all (fail closed)', () => {
    expect(() => resolveProUpdateFromSession({ session: fakeSession({ payment_status: undefined }), subscription: fakeSubscription(), expectedPriceId: PRO_PRICE_ID }))
      .toThrow('not settled');
  });

  test('throws when client_reference_id is missing', () => {
    expect(() => resolveProUpdateFromSession({ session: fakeSession({ client_reference_id: null }), subscription: fakeSubscription(), expectedPriceId: PRO_PRICE_ID }))
      .toThrow('client_reference_id');
  });

  test('throws when the session has no Stripe customer', () => {
    expect(() => resolveProUpdateFromSession({ session: fakeSession({ customer: null }), subscription: fakeSubscription(), expectedPriceId: PRO_PRICE_ID }))
      .toThrow('Stripe customer id');
  });

  test('throws when the subscription has no trial_end', () => {
    expect(() => resolveProUpdateFromSession({ session: fakeSession(), subscription: fakeSubscription({ trial_end: null }), expectedPriceId: PRO_PRICE_ID }))
      .toThrow('trial_end');
  });

  test('throws when the subscription price does not match the expected Pro price', () => {
    expect(() => resolveProUpdateFromSession({
      session: fakeSession(),
      subscription: fakeSubscription({ items: { data: [{ price: { id: 'price_some_other_product' } }] } as unknown as Stripe.Subscription['items'] }),
      expectedPriceId: PRO_PRICE_ID,
    })).toThrow('does not match expected Pro price');
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

/**
 * `resolveWebhookSecret` / `resolveAppUrl` branch on `VERCEL_ENV` /
 * `VERCEL_GIT_COMMIT_REF` — pure env-var reads, previously untested. Each
 * test clears the whole var set first so a leftover from a prior test (or
 * the real `.env`) can't leak into the branch under test.
 */
const ENV_VARS = [
  'VERCEL_ENV',
  'VERCEL_GIT_COMMIT_REF',
  'STRIPE_WEBHOOK_SECRET_PROD',
  'STRIPE_WEBHOOK_SECRET_PRE',
  'STRIPE_WEBHOOK_SECRET_DEV',
  'STRIPE_WEBHOOK_SECRET',
] as const;
const OLD_ENV = { ...process.env };

function clearEnv() {
  for (const key of ENV_VARS) { delete process.env[key]; }
}

describe('resolveWebhookSecret', () => {
  afterEach(() => {
    process.env = { ...OLD_ENV };
  });

  test('production reads the scoped PROD secret', () => {
    clearEnv();
    process.env.VERCEL_ENV = 'production';
    process.env.STRIPE_WEBHOOK_SECRET_PROD = 'whsec_prod';
    expect(resolveWebhookSecret()).toBe('whsec_prod');
  });

  test('production falls back to the legacy unscoped secret when PROD is unset', () => {
    clearEnv();
    process.env.VERCEL_ENV = 'production';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_legacy';
    expect(resolveWebhookSecret()).toBe('whsec_legacy');
  });

  test('preview on the dev branch reads the DEV secret', () => {
    clearEnv();
    process.env.VERCEL_ENV = 'preview';
    process.env.VERCEL_GIT_COMMIT_REF = 'dev';
    process.env.STRIPE_WEBHOOK_SECRET_DEV = 'whsec_dev';
    expect(resolveWebhookSecret()).toBe('whsec_dev');
  });

  test('preview on any other branch reads the PRE secret', () => {
    clearEnv();
    process.env.VERCEL_ENV = 'preview';
    process.env.VERCEL_GIT_COMMIT_REF = 'feature/some-branch';
    process.env.STRIPE_WEBHOOK_SECRET_PRE = 'whsec_pre';
    expect(resolveWebhookSecret()).toBe('whsec_pre');
  });

  test('local (no VERCEL_ENV) reads the DEV secret', () => {
    clearEnv();
    process.env.STRIPE_WEBHOOK_SECRET_DEV = 'whsec_local';
    expect(resolveWebhookSecret()).toBe('whsec_local');
  });

  test('local falls back to the legacy secret when DEV is unset', () => {
    clearEnv();
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_legacy_local';
    expect(resolveWebhookSecret()).toBe('whsec_legacy_local');
  });
});

describe('resolveAppUrl', () => {
  afterEach(() => {
    process.env = { ...OLD_ENV };
  });

  test('production → fresco-pro.vercel.app', () => {
    clearEnv();
    process.env.VERCEL_ENV = 'production';
    expect(resolveAppUrl()).toBe('https://fresco-pro.vercel.app');
  });

  test('preview on the dev branch → fresco-dev.vercel.app', () => {
    clearEnv();
    process.env.VERCEL_ENV = 'preview';
    process.env.VERCEL_GIT_COMMIT_REF = 'dev';
    expect(resolveAppUrl()).toBe('https://fresco-dev.vercel.app');
  });

  test('preview on any other branch → fresco-pre.vercel.app', () => {
    clearEnv();
    process.env.VERCEL_ENV = 'preview';
    process.env.VERCEL_GIT_COMMIT_REF = 'feature/some-branch';
    expect(resolveAppUrl()).toBe('https://fresco-pre.vercel.app');
  });

  test('local (no VERCEL_ENV) → localhost:3000', () => {
    clearEnv();
    expect(resolveAppUrl()).toBe('http://localhost:3000');
  });
});

describe('FRESCO-844 — monthly and annual Pro prices', () => {
  const ANNUAL = 'price_pro_annual';
  const annualSubscription = () => fakeSubscription({ items: { data: [{ price: { id: ANNUAL }, current_period_end: 1_700_000_000 }] } as unknown as Stripe.Subscription['items'] });

  const saved = { month: process.env.STRIPE_PRICE_ID_PRO_MONTH, year: process.env.STRIPE_PRICE_ID_PRO_ANUAL };
  const restore = (key: string, value: string | undefined) => value === undefined ? delete process.env[key] : (process.env[key] = value);

  afterEach(() => {
    restore('STRIPE_PRICE_ID_PRO_MONTH', saved.month);
    restore('STRIPE_PRICE_ID_PRO_ANUAL', saved.year);
  });

  test('getProPriceIds lists monthly then annual, and is empty without the monthly baseline', () => {
    delete process.env.STRIPE_PRICE_ID_PRO_MONTH;
    process.env.STRIPE_PRICE_ID_PRO_ANUAL = ANNUAL;
    expect(getProPriceIds()).toEqual([]);

    process.env.STRIPE_PRICE_ID_PRO_MONTH = PRO_PRICE_ID;
    expect(getProPriceIds()).toEqual([PRO_PRICE_ID, ANNUAL]);

    delete process.env.STRIPE_PRICE_ID_PRO_ANUAL;
    expect(getProPriceIds()).toEqual([PRO_PRICE_ID]);
  });

  test('parseProInterval only trusts an explicit year', () => {
    expect([parseProInterval('year'), parseProInterval('month'), parseProInterval('week'), parseProInterval(undefined)]).toEqual(['year', 'month', 'month', 'month']);
  });

  test('an annual subscription is granted, renewed and kept by the reconcile when its price is in the set', () => {
    const ids = [PRO_PRICE_ID, ANNUAL];
    expect(resolveProUpdateFromSession({ session: fakeSession(), subscription: annualSubscription(), expectedPriceId: ids }).stripeSubscriptionId).toBe('sub_xyz');
    expect(resolveRenewalUpdate(annualSubscription(), ids).stripeCustomerId).toBe('cus_abc');
    expect(resolveReconciledState(annualSubscription(), ids).action).toBe('pro');
  });

  test('a price outside the set is still refused', () => {
    expect(() => resolveRenewalUpdate(annualSubscription(), [PRO_PRICE_ID])).toThrow('does not match expected Pro price');
    expect(resolveReconciledState(annualSubscription(), [PRO_PRICE_ID]).action).toBe('skip');
  });
});
