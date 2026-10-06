import { describe, expect, test } from 'bun:test';
import { getBillingState } from '@/lib/billing/billing-state';
import { createMockClient } from '@/lib/fixtures/mock-supabase-client';

describe('getBillingState', () => {
  test('reads plan and both Stripe ids of that user', async () => {
    const row = { plan: 'pro', stripe_customer_id: 'cus_1', stripe_subscription_id: 'sub_1' };
    const { client, callsOf } = createMockClient({ data: row });

    expect(await getBillingState(client, 'user-1')).toEqual(row);
    expect(callsOf('from')).toEqual([['user_profiles']]);
    expect(callsOf('select')).toEqual([['plan, stripe_customer_id, stripe_subscription_id']]);
    expect(callsOf('eq')).toEqual([['id', 'user-1']]);
  });

  test('returns null when the user has no profile row yet', async () => {
    expect(await getBillingState(createMockClient({ data: null }).client, 'user-1')).toBeNull();
  });

  test('throws on a read failure so each route can answer with its own message', async () => {
    let error: unknown;
    try {
      await getBillingState(createMockClient({ errorMessage: 'boom' }).client, 'user-1');
    }
    catch (caught) {
      error = caught;
    }

    expect(error).toBeDefined();
  });
});
