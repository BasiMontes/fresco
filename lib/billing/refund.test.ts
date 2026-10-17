import type Stripe from 'stripe';
import { describe, expect, mock, test } from 'bun:test';
import { resolveChargeCustomerId, resolveChargeSubscriptionId, resolveRefundCancellation } from './refund';

const PRO_PRICE_ID = 'price_pro_month';

function fakeSubscription(overrides: Partial<Stripe.Subscription> = {}): Stripe.Subscription {
  return {
    id: 'sub_xyz',
    customer: 'cus_abc',
    status: 'active',
    items: { data: [{ price: { id: PRO_PRICE_ID }, current_period_end: 1_700_000_000 }] },
    ...overrides,
  } as unknown as Stripe.Subscription;
}

/**
 * FRESCO-900 — a charge refunded from the Stripe dashboard used to leave the
 * subscription active, so the account stayed Pro and the next cycle charged the
 * person again. A full refund of the current period's charge now cancels the
 * subscription; `customer.subscription.deleted` (already handled) does the
 * downgrade. Pure functions, same fixture style as above.
 */
const PERIOD_START = 1_700_000_000;

function fakeCharge(overrides: Partial<Stripe.Charge> = {}): Stripe.Charge {
  return {
    id: 'ch_1',
    customer: 'cus_abc',
    amount: 499,
    amount_refunded: 499,
    refunded: true,
    created: PERIOD_START + 60,
    ...overrides,
  } as unknown as Stripe.Charge;
}

function subscriptionWithPeriod(overrides: Partial<Stripe.Subscription> = {}): Stripe.Subscription {
  return fakeSubscription({
    items: { data: [{ price: { id: PRO_PRICE_ID }, current_period_start: PERIOD_START, current_period_end: PERIOD_START + 30 * 86_400 }] },
    ...overrides,
  } as Partial<Stripe.Subscription>);
}

describe('resolveRefundCancellation', () => {
  test('a full refund of a charge from the current period cancels the subscription', () => {
    expect(resolveRefundCancellation({ chargeSubscriptionId: 'sub_xyz', charge: fakeCharge(), subscription: subscriptionWithPeriod() }))
      .toEqual({ action: 'cancel', subscriptionId: 'sub_xyz' });
  });

  test('a charge created exactly when the period started still counts as the current one', () => {
    expect(resolveRefundCancellation({ chargeSubscriptionId: 'sub_xyz', charge: fakeCharge({ created: PERIOD_START }), subscription: subscriptionWithPeriod() }).action).toBe('cancel');
  });

  test('a partial refund (a goodwill gesture) changes nothing', () => {
    const decision = resolveRefundCancellation({ chargeSubscriptionId: 'sub_xyz', charge: fakeCharge({ refunded: false, amount_refunded: 100 }), subscription: subscriptionWithPeriod() });

    expect(decision).toEqual({ action: 'ignore', reason: 'partial_refund' });
  });

  test('a charge from an earlier period changes nothing', () => {
    const decision = resolveRefundCancellation({ chargeSubscriptionId: 'sub_xyz', charge: fakeCharge({ created: PERIOD_START - 1 }), subscription: subscriptionWithPeriod() });

    expect(decision).toEqual({ action: 'ignore', reason: 'not_current_period' });
  });

  test.each(['canceled', 'incomplete_expired'] as const)('a subscription that already ended (%s) is left alone', (status) => {
    const decision = resolveRefundCancellation({ chargeSubscriptionId: 'sub_xyz', charge: fakeCharge(), subscription: subscriptionWithPeriod({ status }) });

    expect(decision).toEqual({ action: 'ignore', reason: 'already_ended' });
  });

  test('when the period start cannot be read it does not cancel: no proof, no cancellation', () => {
    const noPeriod = fakeSubscription({ items: { data: [{ price: { id: PRO_PRICE_ID }, current_period_end: PERIOD_START }] } } as Partial<Stripe.Subscription>);

    expect(resolveRefundCancellation({ chargeSubscriptionId: 'sub_xyz', charge: fakeCharge(), subscription: noPeriod })).toEqual({ action: 'ignore', reason: 'unknown_period' });
  });
});

describe('resolveRefundCancellation — which subscription the charge paid for (FRESCO-1002, audit 7b A7-PAY-05)', () => {
  test('a refund of a charge that paid for a DIFFERENT subscription than the stored one does not cancel it', () => {
    const decision = resolveRefundCancellation({ charge: fakeCharge(), subscription: subscriptionWithPeriod({ id: 'sub_current' }), chargeSubscriptionId: 'sub_old' });

    expect(decision).toEqual({ action: 'ignore', reason: 'other_subscription' });
  });

  test('when the charge\'s subscription cannot be told it does not cancel: no proof, no cancellation', () => {
    const decision = resolveRefundCancellation({ charge: fakeCharge(), subscription: subscriptionWithPeriod(), chargeSubscriptionId: null });

    expect(decision).toEqual({ action: 'ignore', reason: 'unknown_charge_subscription' });
  });
});

describe('resolveChargeSubscriptionId', () => {
  function stripeWith({ payments = [{ invoice: 'in_1' }], invoice = { parent: { subscription_details: { subscription: 'sub_xyz' } } } }: { payments?: unknown[], invoice?: unknown } = {}) {
    const list = mock(async (_p: unknown) => ({ data: payments }));
    const retrieve = mock(async (_id: string) => invoice);
    return { list, retrieve, stripe: { invoicePayments: { list }, invoices: { retrieve } } as unknown as Parameters<typeof resolveChargeSubscriptionId>[0] };
  }
  const chargeWithIntent = (payment_intent: unknown = 'pi_1') => fakeCharge({ payment_intent } as Partial<Stripe.Charge>);

  test('charge, payment intent, invoice, subscription', async () => {
    const { stripe, list, retrieve } = stripeWith();

    expect(await resolveChargeSubscriptionId(stripe, chargeWithIntent())).toBe('sub_xyz');
    expect(list).toHaveBeenCalledWith({ payment: { type: 'payment_intent', payment_intent: 'pi_1' }, limit: 1 });
    expect(retrieve).toHaveBeenCalledWith('in_1');
  });

  test('reads an expanded payment intent and an expanded subscription', async () => {
    const { stripe } = stripeWith({ invoice: { parent: { subscription_details: { subscription: { id: 'sub_expanded' } } } } });

    expect(await resolveChargeSubscriptionId(stripe, chargeWithIntent({ id: 'pi_2' }))).toBe('sub_expanded');
  });

  test('null for a charge with no payment intent, without calling Stripe', async () => {
    const { stripe, list } = stripeWith();

    expect(await resolveChargeSubscriptionId(stripe, chargeWithIntent(null))).toBeNull();
    expect(list).not.toHaveBeenCalled();
  });

  test('null when the payment intent settled no invoice (a one-off charge)', async () => {
    expect(await resolveChargeSubscriptionId(stripeWith({ payments: [] }).stripe, chargeWithIntent())).toBeNull();
  });

  test('null when the invoice has no subscription behind it', async () => {
    expect(await resolveChargeSubscriptionId(stripeWith({ invoice: { parent: null } }).stripe, chargeWithIntent())).toBeNull();
  });
});

describe('resolveChargeCustomerId', () => {
  test('returns the customer id off a charge, bare string or expanded object', () => {
    expect(resolveChargeCustomerId(fakeCharge())).toBe('cus_abc');
    expect(resolveChargeCustomerId(fakeCharge({ customer: { id: 'cus_expanded' } as Stripe.Customer }))).toBe('cus_expanded');
  });

  test('is null when the charge has no customer, so the caller can skip it', () => {
    expect(resolveChargeCustomerId(fakeCharge({ customer: null }))).toBeNull();
  });
});
