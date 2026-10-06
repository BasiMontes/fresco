import { describe, expect, test } from 'bun:test';
import { activateProPlan, applyRenewal, downgradeToFree, findProfileByStripeCustomer, getStoredSubscriptionId, markPaymentFailed } from '@/lib/billing/subscription';
import { createMockClient } from '@/lib/fixtures/mock-supabase-client';

/**
 * FRESCO-810: the Stripe webhook had no test at all, so moving its queries to
 * `lib/billing` is pinned here instead: table, columns, exact payload and
 * filter of every read and write, plus "throws the Supabase error as-is" (the
 * webhook relies on that to log it with the event id).
 */

async function thrown(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  }
  catch (error) {
    return error;
  }
  return undefined;
}

describe('getStoredSubscriptionId', () => {
  test('reads stripe_subscription_id of that user and returns it', async () => {
    const { client, callsOf } = createMockClient({ data: { stripe_subscription_id: 'sub_1' } });

    expect(await getStoredSubscriptionId(client, 'user-1')).toBe('sub_1');
    expect(callsOf('from')).toEqual([['user_profiles']]);
    expect(callsOf('select')).toEqual([['stripe_subscription_id']]);
    expect(callsOf('eq')).toEqual([['id', 'user-1']]);
  });

  test('returns null when there is no row or no subscription on file', async () => {
    expect(await getStoredSubscriptionId(createMockClient({ data: null }).client, 'user-1')).toBeNull();
    expect(await getStoredSubscriptionId(createMockClient({ data: { stripe_subscription_id: null } }).client, 'user-1')).toBeNull();
  });

  test('throws the Supabase error on a read failure', async () => {
    const error = await thrown(getStoredSubscriptionId(createMockClient({ errorMessage: 'boom' }).client, 'user-1'));

    expect(error).toEqual({ message: 'boom', code: undefined });
  });
});

describe('activateProPlan', () => {
  test('writes the Pro plan, the Stripe ids and clears the failed-payment aviso, for that user only', async () => {
    const { client, callsOf } = createMockClient();

    await activateProPlan(client, { userId: 'user-1', stripeCustomerId: 'cus_1', stripeSubscriptionId: 'sub_1', planExpiresAt: '2026-11-01T00:00:00.000Z' });

    expect(callsOf('from')).toEqual([['user_profiles']]);
    expect(callsOf('update')).toEqual([[{
      plan: 'pro',
      stripe_customer_id: 'cus_1',
      stripe_subscription_id: 'sub_1',
      plan_expires_at: '2026-11-01T00:00:00.000Z',
      payment_failed_at: null,
    }]]);
    expect(callsOf('eq')).toEqual([['id', 'user-1']]);
  });

  test('throws on a write failure', async () => {
    const error = await thrown(activateProPlan(createMockClient({ errorMessage: 'denied' }).client, { userId: 'u', stripeCustomerId: 'c', stripeSubscriptionId: 's', planExpiresAt: 't' }));

    expect(error).toBeDefined();
  });
});

describe('findProfileByStripeCustomer', () => {
  test('looks the profile up by stripe_customer_id with the columns the webhook decides on', async () => {
    const row = { id: 'user-1', plan: 'pro', payment_failed_at: null, stripe_subscription_id: 'sub_1' };
    const { client, callsOf } = createMockClient({ data: row });

    expect(await findProfileByStripeCustomer(client, 'cus_1')).toEqual(row);
    expect(callsOf('select')).toEqual([['id, plan, payment_failed_at, stripe_subscription_id']]);
    expect(callsOf('eq')).toEqual([['stripe_customer_id', 'cus_1']]);
  });

  test('returns null when no profile matches, and throws on a read failure', async () => {
    expect(await findProfileByStripeCustomer(createMockClient({ data: null }).client, 'cus_x')).toBeNull();
    expect(await thrown(findProfileByStripeCustomer(createMockClient({ errorMessage: 'boom' }).client, 'cus_x'))).toBeDefined();
  });
});

describe('markPaymentFailed', () => {
  test('stamps payment_failed_at with the current instant and leaves plan alone', async () => {
    const { client, callsOf } = createMockClient();
    const before = Date.now();

    await markPaymentFailed(client, 'user-1');

    const [[payload]] = callsOf('update') as [[{ payment_failed_at: string }]];
    expect(Object.keys(payload)).toEqual(['payment_failed_at']);
    expect(new Date(payload.payment_failed_at).getTime()).toBeGreaterThanOrEqual(before);
    expect(callsOf('eq')).toEqual([['id', 'user-1']]);
  });
});

describe('downgradeToFree', () => {
  test('flips the plan to free and clears the aviso without touching plan_expires_at or the Stripe ids', async () => {
    const { client, callsOf } = createMockClient();

    await downgradeToFree(client, 'user-1');

    expect(callsOf('update')).toEqual([[{ plan: 'free', payment_failed_at: null }]]);
    expect(callsOf('eq')).toEqual([['id', 'user-1']]);
  });

  test('throws on a write failure', async () => {
    expect(await thrown(downgradeToFree(createMockClient({ errorMessage: 'denied' }).client, 'user-1'))).toBeDefined();
  });
});

describe('applyRenewal', () => {
  test('keeps Pro, refreshes plan_expires_at and clears the aviso in the same write', async () => {
    const { client, callsOf } = createMockClient();

    await applyRenewal(client, { profileId: 'user-1', planExpiresAt: '2026-12-01T00:00:00.000Z' });

    expect(callsOf('update')).toEqual([[{ plan: 'pro', plan_expires_at: '2026-12-01T00:00:00.000Z', payment_failed_at: null }]]);
    expect(callsOf('eq')).toEqual([['id', 'user-1']]);
  });
});
