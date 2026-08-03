import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import { describe, expect, test } from 'bun:test';
import { getAvailableRecipesCount, RecipesError } from './recipes';

async function expectRejection(promise: Promise<unknown>): Promise<void> {
  let thrownError: unknown;
  try {
    await promise;
  }
  catch (error) {
    thrownError = error;
  }
  expect(thrownError).toBeInstanceOf(RecipesError);
}

/** Minimal mock client exposing `.rpc()` — all `getAvailableRecipesCount()` calls. */
function createMockClient(options: { userId?: string, count?: number | null, dbErrorMessage?: string } = {}) {
  const getUserCalls: unknown[] = [];
  const rpcCalls: unknown[] = [];

  const mock = {
    auth: {
      getUser: async () => {
        getUserCalls.push(undefined);
        return options.userId
          ? { data: { user: { id: options.userId } }, error: null }
          : { data: { user: null }, error: null };
      },
    },
    rpc: async (fn: string, args: unknown, rpcOptions: unknown) => {
      rpcCalls.push({ fn, args, rpcOptions });
      return {
        count: options.dbErrorMessage ? null : (options.count ?? null),
        error: options.dbErrorMessage ? { message: options.dbErrorMessage } : null,
      };
    },
  };

  return { client: mock as unknown as SupabaseClient<Database>, getUserCalls, rpcCalls };
}

describe('getAvailableRecipesCount', () => {
  test('returns the exact count from get_filtered_recipes', async () => {
    const { client } = createMockClient({ userId: 'user-123', count: 42 });

    const result = await getAvailableRecipesCount(client);

    expect(result).toBe(42);
  });

  test('defaults to 0 when the count comes back null', async () => {
    const { client } = createMockClient({ userId: 'user-123', count: null });

    const result = await getAvailableRecipesCount(client);

    expect(result).toBe(0);
  });

  test('throws RecipesError on a real database error', async () => {
    const { client } = createMockClient({ userId: 'user-123', dbErrorMessage: 'connection reset' });

    await expectRejection(getAvailableRecipesCount(client));
  });

  test('throws RecipesError when there is no authenticated session', async () => {
    const { client } = createMockClient({});

    await expectRejection(getAvailableRecipesCount(client));
  });

  test('without a userId argument, resolves the user via an internal auth.getUser() call', async () => {
    const { client, getUserCalls, rpcCalls } = createMockClient({ userId: 'user-123', count: 5 });

    await getAvailableRecipesCount(client);

    expect(getUserCalls).toHaveLength(1);
    expect(rpcCalls).toEqual([{
      fn: 'get_filtered_recipes',
      args: { p_user_id: 'user-123' },
      rpcOptions: { head: true, count: 'exact' },
    }]);
  });

  test('with a userId argument, skips the internal auth.getUser() call and queries by the given id', async () => {
    const { client, getUserCalls, rpcCalls } = createMockClient({ count: 5 });

    await getAvailableRecipesCount(client, 'user-456');

    expect(getUserCalls).toHaveLength(0);
    expect(rpcCalls).toEqual([{
      fn: 'get_filtered_recipes',
      args: { p_user_id: 'user-456' },
      rpcOptions: { head: true, count: 'exact' },
    }]);
  });
});
