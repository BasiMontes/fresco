import { describe, expect, test } from 'bun:test';
import { previousSubscriptionStatus, resolveActiveUpdateFunnelEvent, resolveCheckoutFunnelEvent } from './stripe-funnel-events';

describe('resolveCheckoutFunnelEvent', () => {
  test('trialing checkout → trial_started', () => {
    expect(resolveCheckoutFunnelEvent('trialing')).toBe('trial_started');
  });

  test('non-trialing checkout → trial_converted_to_paid', () => {
    expect(resolveCheckoutFunnelEvent('active')).toBe('trial_converted_to_paid');
  });
});

describe('resolveActiveUpdateFunnelEvent', () => {
  test('previous status trialing → trial_converted_to_paid', () => {
    expect(resolveActiveUpdateFunnelEvent('trialing')).toBe('trial_converted_to_paid');
  });

  test('previous status active (period roll) → subscription_renewed', () => {
    expect(resolveActiveUpdateFunnelEvent('active')).toBe('subscription_renewed');
  });

  test('previous status past_due (recovery) → null (no funnel event)', () => {
    expect(resolveActiveUpdateFunnelEvent('past_due')).toBeNull();
  });

  test('previous status unknown → subscription_renewed', () => {
    expect(resolveActiveUpdateFunnelEvent(undefined)).toBe('subscription_renewed');
  });
});

describe('previousSubscriptionStatus', () => {
  test('reads status from the previous_attributes bag', () => {
    expect(previousSubscriptionStatus({ status: 'trialing' })).toBe('trialing');
  });

  test('missing / malformed bag → undefined', () => {
    expect(previousSubscriptionStatus(undefined)).toBeUndefined();
    expect(previousSubscriptionStatus({})).toBeUndefined();
    expect(previousSubscriptionStatus({ status: 42 })).toBeUndefined();
  });
});
