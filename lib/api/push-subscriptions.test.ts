import { describe, expect, test } from 'bun:test';
import { createMockClient } from '@/lib/fixtures/mock-supabase-client';
import { deletePushSubscription, PushSubscriptionError, savePushSubscription } from './push-subscriptions';

const SAMPLE_SUBSCRIPTION = {
  endpoint: 'https://push.example.com/abc123',
  p256dh: 'p256dh-key',
  auth: 'auth-secret',
};

/**
 * bun-types' `.rejects.toThrow()` is typed as returning `void` (not a
 * `Promise`), so `await expect(promise).rejects.toThrow(...)` trips this
 * repo's `ts/await-thenable` lint rule — same workaround as
 * `user-profile.test.ts`.
 */
async function expectRejection(promise: Promise<unknown>): Promise<void> {
  let thrownError: unknown;
  try {
    await promise;
  }
  catch (error) {
    thrownError = error;
  }
  expect(thrownError).toBeInstanceOf(PushSubscriptionError);
}

describe('savePushSubscription', () => {
  test('inserts the subscription keyed by the authenticated user id', async () => {
    const { client, callsOf } = createMockClient({ userId: 'user-123' });

    await savePushSubscription(client, { subscription: SAMPLE_SUBSCRIPTION });

    expect(callsOf('insert')).toHaveLength(1);
    expect(callsOf('insert')[0]?.[0]).toEqual({ user_id: 'user-123', ...SAMPLE_SUBSCRIPTION });
  });

  test('throws PushSubscriptionError when there is no authenticated session', async () => {
    const { client } = createMockClient({});

    await expectRejection(savePushSubscription(client, { subscription: SAMPLE_SUBSCRIPTION }));
  });

  test('swallows a 23505 unique-violation (already subscribed) instead of throwing', async () => {
    const { client } = createMockClient({ userId: 'user-123', errorCode: '23505', errorMessage: 'duplicate key' });

    await savePushSubscription(client, { subscription: SAMPLE_SUBSCRIPTION });
  });

  test('throws PushSubscriptionError for any other insert failure', async () => {
    const { client } = createMockClient({ userId: 'user-123', errorMessage: 'connection reset' });

    await expectRejection(savePushSubscription(client, { subscription: SAMPLE_SUBSCRIPTION }));
  });
});

describe('deletePushSubscription', () => {
  test('deletes by endpoint only, never a blanket user_id delete', async () => {
    const { client, callsOf } = createMockClient({});

    await deletePushSubscription(client, SAMPLE_SUBSCRIPTION.endpoint);

    expect(callsOf('eq')).toEqual([['endpoint', SAMPLE_SUBSCRIPTION.endpoint]]);
  });

  test('throws PushSubscriptionError when the delete fails', async () => {
    const { client } = createMockClient({ errorMessage: 'row not found' });

    await expectRejection(deletePushSubscription(client, SAMPLE_SUBSCRIPTION.endpoint));
  });
});
