import type Stripe from 'stripe';
import { describe, expect, test } from 'bun:test';
import { resolveDisputeCancellation, resolveDisputeChargeId } from './dispute';

/**
 * FRESCO-1003 (audit 7b A7-PAY-04) — a dispute cancels the subscription its charge paid for, and
 * only that one.
 */

const subscription = (overrides: Record<string, unknown> = {}) => ({ id: 'sub_1', status: 'active', ...overrides }) as unknown as Stripe.Subscription;

describe('resolveDisputeCancellation', () => {
  test('cancels the subscription the disputed charge paid for', () => {
    expect(resolveDisputeCancellation({ subscription: subscription(), chargeSubscriptionId: 'sub_1' })).toEqual({ action: 'cancel', subscriptionId: 'sub_1' });
  });

  test.each(['active', 'trialing', 'past_due', 'unpaid'])('still cancels a %s subscription', (status) => {
    expect(resolveDisputeCancellation({ subscription: subscription({ status }), chargeSubscriptionId: 'sub_1' }).action).toBe('cancel');
  });

  test('ignores a charge that paid for another subscription of the same customer', () => {
    expect(resolveDisputeCancellation({ subscription: subscription(), chargeSubscriptionId: 'sub_old' })).toEqual({ action: 'ignore', reason: 'other_subscription' });
  });

  test('ignores a charge whose subscription cannot be told: no proof, no cancellation', () => {
    expect(resolveDisputeCancellation({ subscription: subscription(), chargeSubscriptionId: null })).toEqual({ action: 'ignore', reason: 'unknown_charge_subscription' });
  });

  test.each(['canceled', 'incomplete_expired'])('ignores a %s subscription: there is nothing left to cancel', (status) => {
    expect(resolveDisputeCancellation({ subscription: subscription({ status }), chargeSubscriptionId: 'sub_1' })).toEqual({ action: 'ignore', reason: 'already_ended' });
  });

  test('does not look at the period: a dispute about an older charge of the same subscription still cancels', () => {
    const old = subscription({ items: { data: [{ current_period_start: Math.floor(Date.now() / 1000) }] } });

    expect(resolveDisputeCancellation({ subscription: old, chargeSubscriptionId: 'sub_1' }).action).toBe('cancel');
  });
});

describe('resolveDisputeChargeId', () => {
  test('reads a bare id and an expanded charge alike', () => {
    expect(resolveDisputeChargeId({ charge: 'ch_1' } as unknown as Stripe.Dispute)).toBe('ch_1');
    expect(resolveDisputeChargeId({ charge: { id: 'ch_2' } } as unknown as Stripe.Dispute)).toBe('ch_2');
  });
});
