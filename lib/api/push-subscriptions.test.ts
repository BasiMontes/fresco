import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import { describe, expect, test } from 'bun:test';
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

function createMockClient(options: { userId?: string, insertErrorCode?: string, insertErrorMessage?: string, deleteErrorMessage?: string } = {}) {
  const insertCalls: unknown[] = [];
  const deleteEqCalls: [string, string][] = [];

  const mock = {
    auth: {
      getUser: async () => (
        options.userId
          ? { data: { user: { id: options.userId } }, error: null }
          : { data: { user: null }, error: null }
      ),
    },
    from: () => ({
      insert: async (payload: unknown) => {
        insertCalls.push(payload);
        return {
          error: options.insertErrorMessage
            ? { message: options.insertErrorMessage, code: options.insertErrorCode }
            : null,
        };
      },
      delete: () => ({
        eq: async (column: string, value: string) => {
          deleteEqCalls.push([column, value]);
          return {
            error: options.deleteErrorMessage ? { message: options.deleteErrorMessage } : null,
          };
        },
      }),
    }),
  };

  return { client: mock as unknown as SupabaseClient<Database>, insertCalls, deleteEqCalls };
}

describe('savePushSubscription', () => {
  test('inserts the subscription keyed by the authenticated user id', async () => {
    const { client, insertCalls } = createMockClient({ userId: 'user-123' });

    await savePushSubscription(client, SAMPLE_SUBSCRIPTION);

    expect(insertCalls).toHaveLength(1);
    expect(insertCalls[0]).toEqual({ user_id: 'user-123', ...SAMPLE_SUBSCRIPTION });
  });

  test('throws PushSubscriptionError when there is no authenticated session', async () => {
    const { client } = createMockClient({});

    await expectRejection(savePushSubscription(client, SAMPLE_SUBSCRIPTION));
  });

  test('swallows a 23505 unique-violation (already subscribed) instead of throwing', async () => {
    const { client } = createMockClient({ userId: 'user-123', insertErrorCode: '23505', insertErrorMessage: 'duplicate key' });

    await savePushSubscription(client, SAMPLE_SUBSCRIPTION);
  });

  test('throws PushSubscriptionError for any other insert failure', async () => {
    const { client } = createMockClient({ userId: 'user-123', insertErrorMessage: 'connection reset' });

    await expectRejection(savePushSubscription(client, SAMPLE_SUBSCRIPTION));
  });
});

describe('deletePushSubscription', () => {
  test('deletes by endpoint only, never a blanket user_id delete', async () => {
    const { client, deleteEqCalls } = createMockClient({});

    await deletePushSubscription(client, SAMPLE_SUBSCRIPTION.endpoint);

    expect(deleteEqCalls).toEqual([['endpoint', SAMPLE_SUBSCRIPTION.endpoint]]);
  });

  test('throws PushSubscriptionError when the delete fails', async () => {
    const { client } = createMockClient({ deleteErrorMessage: 'row not found' });

    await expectRejection(deletePushSubscription(client, SAMPLE_SUBSCRIPTION.endpoint));
  });
});
