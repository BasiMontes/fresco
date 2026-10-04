import { describe, expect, test } from 'bun:test';
import { isTrialAvailable, PRO_TRIAL_DAYS } from './pro-terms';

describe('isTrialAvailable', () => {
  test('available for a user who never started a checkout', () => {
    expect(isTrialAvailable({ stripe_customer_id: null, stripe_subscription_id: null })).toBe(true);
  });

  test('available when there is no profile row yet', () => {
    expect(isTrialAvailable(null)).toBe(true);
    expect(isTrialAvailable(undefined)).toBe(true);
  });

  test('used up once a Stripe customer is on file', () => {
    expect(isTrialAvailable({ stripe_customer_id: 'cus_1', stripe_subscription_id: null })).toBe(false);
  });

  test('used up once a Stripe subscription is on file', () => {
    expect(isTrialAvailable({ stripe_customer_id: null, stripe_subscription_id: 'sub_1' })).toBe(false);
  });
});

describe('PRO_TRIAL_DAYS', () => {
  test('is the 7 days the product promises', () => {
    expect(PRO_TRIAL_DAYS).toBe(7);
  });
});
