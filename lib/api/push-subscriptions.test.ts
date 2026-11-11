import { describe, expect, test } from 'bun:test';
import { createMockClient } from '@/lib/fixtures/mock-supabase-client';
import { deletePushSubscription, hasPushSubscription, PushSubscriptionError, savePushSubscription } from './push-subscriptions';

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

  test('says "saved" for a new row', async () => {
    const { client } = createMockClient({ userId: 'user-123' });

    expect(await savePushSubscription(client, { subscription: SAMPLE_SUBSCRIPTION })).toBe('saved');
  });

  /**
   * FRESCO-1182: a unique violation on `endpoint` is two different things. The same user's own row is a
   * no-op; a row of ANOTHER user (the previous person on a shared browser) must not read as success.
   */
  describe('a unique violation on the endpoint (FRESCO-1182)', () => {
    /** Insert always collides; the ownership read answers with `ownRow`. */
    function conflictClient(ownRow: { id: string } | null, readError?: string) {
      const reads: Array<[string, unknown]> = [];
      const chain = {
        eq(column: string, value: unknown) {
          reads.push([column, value]);
          return chain;
        },
        maybeSingle: async () => (readError ? { data: null, error: { message: readError } } : { data: ownRow, error: null }),
      };
      const client = {
        auth: { getUser: async () => ({ data: { user: { id: 'user-b' } }, error: null }) },
        from: () => ({
          insert: async () => ({ error: { code: '23505', message: 'duplicate key' } }),
          select: () => chain,
        }),
      } as unknown as Parameters<typeof savePushSubscription>[0];
      return { client, reads };
    }

    test('the endpoint is already stored for this user: "owned", nothing to do', async () => {
      const { client, reads } = conflictClient({ id: 'row-1' });

      expect(await savePushSubscription(client, { subscription: SAMPLE_SUBSCRIPTION })).toBe('owned');
      expect(reads).toContainEqual(['endpoint', SAMPLE_SUBSCRIPTION.endpoint]);
      expect(reads).toContainEqual(['user_id', 'user-b']);
    });

    test('the endpoint belongs to somebody else (RLS shows this user no such row): "taken", never a silent success', async () => {
      const { client } = conflictClient(null);

      expect(await savePushSubscription(client, { subscription: SAMPLE_SUBSCRIPTION })).toBe('taken');
    });

    test('a failed ownership read is an error, not a guess', async () => {
      const { client } = conflictClient(null, 'connection reset');

      await expectRejection(savePushSubscription(client, { subscription: SAMPLE_SUBSCRIPTION }));
    });
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

describe('hasPushSubscription', () => {
  test('is true when this user has a row for the endpoint', async () => {
    const { client, callsOf } = createMockClient({ data: { id: 'row-1' } });

    expect(await hasPushSubscription(client, { endpoint: SAMPLE_SUBSCRIPTION.endpoint, userId: 'user-123' })).toBe(true);
    expect(callsOf('eq')).toEqual([['endpoint', SAMPLE_SUBSCRIPTION.endpoint], ['user_id', 'user-123']]);
  });

  test('is false when there is none', async () => {
    const { client } = createMockClient({});

    expect(await hasPushSubscription(client, { endpoint: SAMPLE_SUBSCRIPTION.endpoint, userId: 'user-123' })).toBe(false);
  });

  test('throws PushSubscriptionError when the read fails', async () => {
    const { client } = createMockClient({ errorMessage: 'connection reset' });

    await expectRejection(hasPushSubscription(client, { endpoint: SAMPLE_SUBSCRIPTION.endpoint, userId: 'user-123' }));
  });
});
