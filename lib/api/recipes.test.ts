import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import { describe, expect, test } from 'bun:test';
import { getAvailableRecipesCount, getLatestAvailableRecipes, RecipesError } from './recipes';

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

const SAMPLE_ROW = {
  id: 'recipe-1',
  nombre: 'Risotto de setas',
  slug: 'risotto-de-setas',
  descripcion_corta: null,
  foto_url: null,
  meta: null,
  clasificacion: null,
  dieta: null,
  alergenos: null,
  ingredientes_principales: null,
  ingredientes_que_puede_desagradar: null,
  temporada: null,
  pasos_resumen: null,
  rating_promedio: null,
  veces_cocinada: 0,
  veces_descartada: 0,
  ultima_vez_en_menu: null,
  created_at: '2026-08-01T00:00:00Z',
  updated_at: '2026-08-01T00:00:00Z',
};

/** Minimal mock client exposing `.rpc().order().limit()` — all `getLatestAvailableRecipes()` calls. */
function createLatestMockClient(options: { userId?: string, rows?: unknown[], dbErrorMessage?: string } = {}) {
  const getUserCalls: unknown[] = [];
  const rpcCalls: unknown[] = [];
  const orderCalls: unknown[] = [];
  const limitCalls: unknown[] = [];

  const mock = {
    auth: {
      getUser: async () => {
        getUserCalls.push(undefined);
        return options.userId
          ? { data: { user: { id: options.userId } }, error: null }
          : { data: { user: null }, error: null };
      },
    },
    rpc: (fn: string, args: unknown) => {
      rpcCalls.push({ fn, args });
      return {
        order: (column: string, orderOptions: unknown) => {
          orderCalls.push({ column, orderOptions });
          return {
            limit: async (limitValue: number) => {
              limitCalls.push(limitValue);
              return {
                data: options.dbErrorMessage ? null : (options.rows ?? []),
                error: options.dbErrorMessage ? { message: options.dbErrorMessage } : null,
              };
            },
          };
        },
      };
    },
  };

  return {
    client: mock as unknown as SupabaseClient<Database>,
    getUserCalls,
    rpcCalls,
    orderCalls,
    limitCalls,
  };
}

describe('getLatestAvailableRecipes', () => {
  test('maps each row to the @schemas Recipe shape', async () => {
    const { client } = createLatestMockClient({ userId: 'user-123', rows: [SAMPLE_ROW] });

    const result = await getLatestAvailableRecipes(client);

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('recipe-1');
    expect(result[0]?.nombre).toBe('Risotto de setas');
  });

  test('returns an empty array when there are no rows', async () => {
    const { client } = createLatestMockClient({ userId: 'user-123', rows: [] });

    const result = await getLatestAvailableRecipes(client);

    expect(result).toEqual([]);
  });

  test('throws RecipesError on a real database error', async () => {
    const { client } = createLatestMockClient({ userId: 'user-123', dbErrorMessage: 'connection reset' });

    await expectRejection(getLatestAvailableRecipes(client));
  });

  test('throws RecipesError when there is no authenticated session', async () => {
    const { client } = createLatestMockClient({});

    await expectRejection(getLatestAvailableRecipes(client));
  });

  test('orders by created_at descending and defaults the limit to 6', async () => {
    const { client, orderCalls, limitCalls } = createLatestMockClient({ userId: 'user-123', rows: [] });

    await getLatestAvailableRecipes(client);

    expect(orderCalls).toEqual([{ column: 'created_at', orderOptions: { ascending: false } }]);
    expect(limitCalls).toEqual([6]);
  });

  test('passes a custom limit through', async () => {
    const { client, limitCalls } = createLatestMockClient({ userId: 'user-123', rows: [] });

    await getLatestAvailableRecipes(client, undefined, 3);

    expect(limitCalls).toEqual([3]);
  });

  test('with a userId argument, skips the internal auth.getUser() call and queries by the given id', async () => {
    const { client, getUserCalls, rpcCalls } = createLatestMockClient({ rows: [] });

    await getLatestAvailableRecipes(client, 'user-456');

    expect(getUserCalls).toHaveLength(0);
    expect(rpcCalls).toEqual([{ fn: 'get_filtered_recipes', args: { p_user_id: 'user-456' } }]);
  });
});
