import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import { describe, expect, test } from 'bun:test';
import { createRecetaPropia, deleteRecetaPropia, getAvailableRecipesCount, getCatalogRecipes, getLatestAvailableRecipes, getRecetasPropias, getRecipeDetail, RecipesError, updateRecetaPropia } from './recipes';

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

/** Minimal mock client exposing a plain `.rpc()` — all `getCatalogRecipes()` calls. */
function createCatalogMockClient(options: { userId?: string, rows?: unknown[], dbErrorMessage?: string } = {}) {
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
    rpc: async (fn: string, args: unknown) => {
      rpcCalls.push({ fn, args });
      return {
        data: options.dbErrorMessage ? null : (options.rows ?? []),
        error: options.dbErrorMessage ? { message: options.dbErrorMessage } : null,
      };
    },
  };

  return { client: mock as unknown as SupabaseClient<Database>, getUserCalls, rpcCalls };
}

describe('getCatalogRecipes', () => {
  test('maps each row to the @schemas Recipe shape', async () => {
    const { client } = createCatalogMockClient({ userId: 'user-123', rows: [SAMPLE_ROW] });

    const result = await getCatalogRecipes(client);

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('recipe-1');
    expect(result[0]?.nombre).toBe('Risotto de setas');
  });

  test('returns an empty array when there are no rows', async () => {
    const { client } = createCatalogMockClient({ userId: 'user-123', rows: [] });

    const result = await getCatalogRecipes(client);

    expect(result).toEqual([]);
  });

  test('throws RecipesError on a real database error', async () => {
    const { client } = createCatalogMockClient({ userId: 'user-123', dbErrorMessage: 'connection reset' });

    await expectRejection(getCatalogRecipes(client));
  });

  test('throws RecipesError when there is no authenticated session', async () => {
    const { client } = createCatalogMockClient({});

    await expectRejection(getCatalogRecipes(client));
  });

  test('without a userId argument, resolves the user via an internal auth.getUser() call', async () => {
    const { client, getUserCalls, rpcCalls } = createCatalogMockClient({ userId: 'user-123', rows: [] });

    await getCatalogRecipes(client);

    expect(getUserCalls).toHaveLength(1);
    expect(rpcCalls).toEqual([{ fn: 'get_filtered_recipes', args: { p_user_id: 'user-123' } }]);
  });

  test('with a userId argument, skips the internal auth.getUser() call and queries by the given id', async () => {
    const { client, getUserCalls, rpcCalls } = createCatalogMockClient({ rows: [] });

    await getCatalogRecipes(client, 'user-456');

    expect(getUserCalls).toHaveLength(0);
    expect(rpcCalls).toEqual([{ fn: 'get_filtered_recipes', args: { p_user_id: 'user-456' } }]);
  });
});

const SAMPLE_RECETA_PROPIA = {
  id: 'receta-1',
  created_at: '2026-08-03T00:00:00Z',
  updated_at: '2026-08-03T00:00:00Z',
  user_id: 'user-123',
  nombre: 'Tortilla de mi abuela',
  ingredientes: ['huevo', 'patata'],
  pasos: ['pelar patatas', 'batir huevos'],
};

/** Minimal mock client exposing `.from('recetas_propias').select().eq()` — all `getRecetasPropias()` calls. */
function createRecetasPropiasMockClient(options: { userId?: string, rows?: unknown[], dbErrorMessage?: string } = {}) {
  const getUserCalls: unknown[] = [];
  const eqCalls: unknown[] = [];

  const mock = {
    auth: {
      getUser: async () => {
        getUserCalls.push(undefined);
        return options.userId
          ? { data: { user: { id: options.userId } }, error: null }
          : { data: { user: null }, error: null };
      },
    },
    from: (table: string) => ({
      select: () => ({
        eq: async (column: string, value: unknown) => {
          eqCalls.push({ table, column, value });
          return {
            data: options.dbErrorMessage ? null : (options.rows ?? []),
            error: options.dbErrorMessage ? { message: options.dbErrorMessage } : null,
          };
        },
      }),
    }),
  };

  return { client: mock as unknown as SupabaseClient<Database>, getUserCalls, eqCalls };
}

describe('getRecetasPropias', () => {
  test('returns the personal recipe rows as-is', async () => {
    const { client } = createRecetasPropiasMockClient({ userId: 'user-123', rows: [SAMPLE_RECETA_PROPIA] });

    const result = await getRecetasPropias(client);

    expect(result).toEqual([SAMPLE_RECETA_PROPIA]);
  });

  test('returns an empty array when there are no rows', async () => {
    const { client } = createRecetasPropiasMockClient({ userId: 'user-123', rows: [] });

    const result = await getRecetasPropias(client);

    expect(result).toEqual([]);
  });

  test('throws RecipesError on a real database error', async () => {
    const { client } = createRecetasPropiasMockClient({ userId: 'user-123', dbErrorMessage: 'connection reset' });

    await expectRejection(getRecetasPropias(client));
  });

  test('throws RecipesError when there is no authenticated session', async () => {
    const { client } = createRecetasPropiasMockClient({});

    await expectRejection(getRecetasPropias(client));
  });

  test('with a userId argument, skips the internal auth.getUser() call and queries by the given id', async () => {
    const { client, getUserCalls, eqCalls } = createRecetasPropiasMockClient({ rows: [] });

    await getRecetasPropias(client, 'user-456');

    expect(getUserCalls).toHaveLength(0);
    expect(eqCalls).toEqual([{ table: 'recetas_propias', column: 'user_id', value: 'user-456' }]);
  });
});

/** Minimal mock client exposing `.from('recetas_propias').insert().select().single()` — all `createRecetaPropia()` calls. */
function createInsertMockClient(options: { userId?: string, row?: unknown, dbErrorMessage?: string } = {}) {
  const getUserCalls: unknown[] = [];
  const insertCalls: unknown[] = [];

  const mock = {
    auth: {
      getUser: async () => {
        getUserCalls.push(undefined);
        return options.userId
          ? { data: { user: { id: options.userId } }, error: null }
          : { data: { user: null }, error: null };
      },
    },
    from: (table: string) => ({
      insert: (payload: unknown) => {
        insertCalls.push({ table, payload });
        return {
          select: () => ({
            single: async () => ({
              data: options.dbErrorMessage ? null : (options.row ?? null),
              error: options.dbErrorMessage ? { message: options.dbErrorMessage } : null,
            }),
          }),
        };
      },
    }),
  };

  return { client: mock as unknown as SupabaseClient<Database>, getUserCalls, insertCalls };
}

describe('createRecetaPropia', () => {
  test('inserts with the resolved user_id and returns the created row', async () => {
    const { client, insertCalls } = createInsertMockClient({ userId: 'user-123', row: SAMPLE_RECETA_PROPIA });

    const result = await createRecetaPropia(client, {
      nombre: 'Tortilla de mi abuela',
      ingredientes: ['huevo', 'patata'],
      pasos: ['pelar patatas', 'batir huevos'],
    });

    expect(result).toEqual(SAMPLE_RECETA_PROPIA);
    expect(insertCalls).toEqual([{
      table: 'recetas_propias',
      payload: { user_id: 'user-123', nombre: 'Tortilla de mi abuela', ingredientes: ['huevo', 'patata'], pasos: ['pelar patatas', 'batir huevos'] },
    }]);
  });

  test('throws RecipesError on a real database error', async () => {
    const { client } = createInsertMockClient({ userId: 'user-123', dbErrorMessage: 'connection reset' });

    await expectRejection(createRecetaPropia(client, { nombre: 'x', ingredientes: [], pasos: [] }));
  });

  test('throws RecipesError when there is no authenticated session', async () => {
    const { client } = createInsertMockClient({});

    await expectRejection(createRecetaPropia(client, { nombre: 'x', ingredientes: [], pasos: [] }));
  });
});

/** Minimal mock client exposing `.from('recetas_propias').update().eq().eq().select().single()` — all `updateRecetaPropia()` calls. */
function createUpdateMockClient(options: { userId?: string, row?: unknown, dbErrorMessage?: string } = {}) {
  const getUserCalls: unknown[] = [];
  const updateCalls: unknown[] = [];
  const eqCalls: unknown[] = [];

  const mock = {
    auth: {
      getUser: async () => {
        getUserCalls.push(undefined);
        return options.userId
          ? { data: { user: { id: options.userId } }, error: null }
          : { data: { user: null }, error: null };
      },
    },
    from: (table: string) => ({
      update: (payload: unknown) => {
        updateCalls.push({ table, payload });
        return {
          eq: (column: string, value: unknown) => {
            eqCalls.push({ column, value });
            return {
              eq: (column2: string, value2: unknown) => {
                eqCalls.push({ column: column2, value: value2 });
                return {
                  select: () => ({
                    single: async () => ({
                      data: options.dbErrorMessage ? null : (options.row ?? null),
                      error: options.dbErrorMessage ? { message: options.dbErrorMessage } : null,
                    }),
                  }),
                };
              },
            };
          },
        };
      },
    }),
  };

  return { client: mock as unknown as SupabaseClient<Database>, getUserCalls, updateCalls, eqCalls };
}

describe('updateRecetaPropia', () => {
  test('updates by id and user_id and returns the updated row', async () => {
    const updatedReceta = { ...SAMPLE_RECETA_PROPIA, nombre: 'Tortilla mejorada' };
    const { client, updateCalls, eqCalls } = createUpdateMockClient({ userId: 'user-123', row: updatedReceta });

    const result = await updateRecetaPropia(client, 'receta-1', {
      nombre: 'Tortilla mejorada',
      ingredientes: ['huevo', 'patata'],
      pasos: ['pelar patatas', 'batir huevos'],
    });

    expect(result).toEqual(updatedReceta);
    expect(updateCalls).toEqual([{
      table: 'recetas_propias',
      payload: { nombre: 'Tortilla mejorada', ingredientes: ['huevo', 'patata'], pasos: ['pelar patatas', 'batir huevos'] },
    }]);
    expect(eqCalls).toEqual([
      { column: 'id', value: 'receta-1' },
      { column: 'user_id', value: 'user-123' },
    ]);
  });

  test('throws RecipesError on a real database error', async () => {
    const { client } = createUpdateMockClient({ userId: 'user-123', dbErrorMessage: 'connection reset' });

    await expectRejection(updateRecetaPropia(client, 'receta-1', { nombre: 'x', ingredientes: [], pasos: [] }));
  });

  test('throws RecipesError when there is no authenticated session', async () => {
    const { client } = createUpdateMockClient({});

    await expectRejection(updateRecetaPropia(client, 'receta-1', { nombre: 'x', ingredientes: [], pasos: [] }));
  });
});

/** Minimal mock client exposing `.from('recetas_propias').delete().eq().eq()` — all `deleteRecetaPropia()` calls. */
function createDeleteMockClient(options: { userId?: string, dbErrorMessage?: string } = {}) {
  const getUserCalls: unknown[] = [];
  const deleteCalls: unknown[] = [];
  const eqCalls: unknown[] = [];

  const mock = {
    auth: {
      getUser: async () => {
        getUserCalls.push(undefined);
        return options.userId
          ? { data: { user: { id: options.userId } }, error: null }
          : { data: { user: null }, error: null };
      },
    },
    from: (table: string) => ({
      delete: () => {
        deleteCalls.push({ table });
        return {
          eq: (column: string, value: unknown) => {
            eqCalls.push({ column, value });
            return {
              eq: async (column2: string, value2: unknown) => {
                eqCalls.push({ column: column2, value: value2 });
                return {
                  error: options.dbErrorMessage ? { message: options.dbErrorMessage } : null,
                };
              },
            };
          },
        };
      },
    }),
  };

  return { client: mock as unknown as SupabaseClient<Database>, getUserCalls, deleteCalls, eqCalls };
}

describe('deleteRecetaPropia', () => {
  test('deletes by id and user_id', async () => {
    const { client, deleteCalls, eqCalls } = createDeleteMockClient({ userId: 'user-123' });

    await deleteRecetaPropia(client, 'receta-1');

    expect(deleteCalls).toEqual([{ table: 'recetas_propias' }]);
    expect(eqCalls).toEqual([
      { column: 'id', value: 'receta-1' },
      { column: 'user_id', value: 'user-123' },
    ]);
  });

  test('throws RecipesError on a real database error', async () => {
    const { client } = createDeleteMockClient({ userId: 'user-123', dbErrorMessage: 'connection reset' });

    await expectRejection(deleteRecetaPropia(client, 'receta-1'));
  });

  test('throws RecipesError when there is no authenticated session', async () => {
    const { client } = createDeleteMockClient({});

    await expectRejection(deleteRecetaPropia(client, 'receta-1'));
  });
});

/** Minimal mock client covering both `getRecipeDetail()` lookup paths: `.from('recetas_propias').select().eq().maybeSingle()` and `.rpc(..., { p_recipe_id }).maybeSingle()`. */
function createDetailMockClient(options: {
  userId?: string
  propiaRow?: unknown | null
  propiaErrorMessage?: string
  catalogoRow?: unknown | null
  catalogoErrorMessage?: string
} = {}) {
  const getUserCalls: unknown[] = [];
  const propiaEqCalls: unknown[] = [];
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
    from: (table: string) => ({
      select: () => ({
        eq: (column: string, value: unknown) => ({
          maybeSingle: async () => {
            propiaEqCalls.push({ table, column, value });
            return {
              data: options.propiaErrorMessage ? null : (options.propiaRow ?? null),
              error: options.propiaErrorMessage ? { message: options.propiaErrorMessage } : null,
            };
          },
        }),
      }),
    }),
    rpc: (fn: string, args: unknown) => ({
      maybeSingle: async () => {
        rpcCalls.push({ fn, args });
        return {
          data: options.catalogoErrorMessage ? null : (options.catalogoRow ?? null),
          error: options.catalogoErrorMessage ? { message: options.catalogoErrorMessage } : null,
        };
      },
    }),
  };

  return { client: mock as unknown as SupabaseClient<Database>, getUserCalls, propiaEqCalls, rpcCalls };
}

describe('getRecipeDetail', () => {
  test('returns the personal recipe when the id matches recetas_propias, without querying the catalog', async () => {
    const { client, rpcCalls } = createDetailMockClient({ userId: 'user-123', propiaRow: SAMPLE_RECETA_PROPIA });

    const result = await getRecipeDetail(client, 'receta-1');

    expect(result).toEqual({ kind: 'propia', receta: SAMPLE_RECETA_PROPIA });
    expect(rpcCalls).toHaveLength(0);
  });

  test('falls back to the catalog when the id does not match a personal recipe, passing p_recipe_id to narrow the RPC', async () => {
    const { client, rpcCalls } = createDetailMockClient({ userId: 'user-123', propiaRow: null, catalogoRow: SAMPLE_ROW });

    const result = await getRecipeDetail(client, 'recipe-1');

    expect(result).toEqual({ kind: 'catalogo', receta: expect.objectContaining({ id: 'recipe-1', nombre: 'Risotto de setas' }) });
    expect(rpcCalls).toEqual([{ fn: 'get_filtered_recipes', args: { p_user_id: 'user-123', p_recipe_id: 'recipe-1' } }]);
  });

  test('returns null when the id matches neither table', async () => {
    const { client } = createDetailMockClient({ userId: 'user-123', propiaRow: null, catalogoRow: null });

    const result = await getRecipeDetail(client, 'unknown-id');

    expect(result).toBeNull();
  });

  test('throws RecipesError on a recetas_propias lookup error', async () => {
    const { client } = createDetailMockClient({ userId: 'user-123', propiaErrorMessage: 'connection reset' });

    await expectRejection(getRecipeDetail(client, 'receta-1'));
  });

  test('throws RecipesError on a catalog lookup error', async () => {
    const { client } = createDetailMockClient({ userId: 'user-123', propiaRow: null, catalogoErrorMessage: 'connection reset' });

    await expectRejection(getRecipeDetail(client, 'recipe-1'));
  });

  test('throws RecipesError when there is no authenticated session', async () => {
    const { client } = createDetailMockClient({});

    await expectRejection(getRecipeDetail(client, 'recipe-1'));
  });

  test('with a userId argument, skips the internal auth.getUser() call', async () => {
    const { client, getUserCalls } = createDetailMockClient({ propiaRow: null, catalogoRow: null });

    await getRecipeDetail(client, 'recipe-1', 'user-456');

    expect(getUserCalls).toHaveLength(0);
  });
});
