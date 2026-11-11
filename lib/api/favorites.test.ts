import { describe, expect, test } from 'bun:test';
import { createMockClient } from '@/lib/fixtures/mock-supabase-client';
import { makeFixtureRecipe } from '@/lib/fixtures/recipe';
import { addFavorite, getFavoriteRecipeIds, getFavoriteRecipes, removeFavorite } from './favorites';

/**
 * FRESCO-1072 (coverage tranche 4) — `lib/api/favorites.ts`. The write paths had a thin test through the
 * client wrapper; the reads had none. Each function is scoped to one user, and a failure is an error with
 * its own message, never an empty list that would look like "no favorites".
 */

async function rejectionOf(promise: Promise<unknown>): Promise<Error> {
  try {
    await promise;
  }
  catch (error) {
    return error as Error;
  }
  throw new Error('expected a rejection');
}

describe('getFavoriteRecipeIds', () => {
  test('returns the ids of the given user as a set, without resolving the session', async () => {
    const { client, callsOf } = createMockClient({ data: [{ recipe_id: 'r1' }, { recipe_id: 'r2' }, { recipe_id: 'r1' }] });

    expect(await getFavoriteRecipeIds(client, 'user-1')).toEqual(new Set(['r1', 'r2']));
    expect(callsOf('from')).toEqual([['favorites']]);
    expect(callsOf('eq')).toEqual([['user_id', 'user-1']]);
    expect(callsOf('auth.getUser')).toEqual([]);
  });

  test('is an empty set when the user has none', async () => {
    expect(await getFavoriteRecipeIds(createMockClient({ data: [] }).client, 'user-1')).toEqual(new Set());
    expect(await getFavoriteRecipeIds(createMockClient({ data: null }).client, 'user-1')).toEqual(new Set());
  });

  test('without a userId it reads for the signed-in user', async () => {
    const { client, callsOf } = createMockClient({ userId: 'user-4', data: [] });

    await getFavoriteRecipeIds(client);

    expect(callsOf('eq')).toEqual([['user_id', 'user-4']]);
  });

  test('a database error and a missing session are errors, not an empty set', async () => {
    const dbError = await rejectionOf(getFavoriteRecipeIds(createMockClient({ errorMessage: 'rls' }).client, 'user-1'));
    expect(dbError.name).toBe('FavoritesError');
    expect(dbError.message).toContain('rls');

    const noSession = await rejectionOf(getFavoriteRecipeIds(createMockClient({}).client));
    expect(noSession.name).toBe('FavoritesError');
  });
});

/**
 * `getFavoriteRecipes` makes two calls with different answers (the favorites, then the filter), which the
 * single-result `createMockClient` cannot express, so this fake resolves each one on its own.
 */
function favoritesClient(options: { favorites?: unknown, favoritesError?: string, allowed?: unknown, filterError?: string }) {
  const calls: { method: string, args: unknown[] }[] = [];
  const builder: object = new Proxy({}, {
    get(_target, property) {
      if (property === 'then') {
        return async (onFulfilled: (value: unknown) => unknown) =>
          Promise.resolve(options.favoritesError
            ? { data: null, error: { message: options.favoritesError } }
            : { data: options.favorites ?? null, error: null }).then(onFulfilled);
      }
      if (typeof property === 'symbol') { return undefined; }
      return (...args: unknown[]) => {
        calls.push({ method: property, args });
        return builder;
      };
    },
  });
  const client = {
    auth: { getUser: async () => ({ data: { user: null }, error: null }) },
    from: (table: string) => {
      calls.push({ method: 'from', args: [table] });
      return builder;
    },
    rpc: async (name: string, args: unknown) => {
      calls.push({ method: 'rpc', args: [name, args] });
      return options.filterError
        ? { data: null, error: { message: options.filterError } }
        : { data: options.allowed ?? [], error: null };
    },
  };
  return {
    client: client as unknown as Parameters<typeof getFavoriteRecipes>[0],
    callsOf: (method: string) => calls.filter(call => call.method === method).map(call => call.args),
  };
}

const recipeRow = (id: string) => makeFixtureRecipe({ id });

describe('getFavoriteRecipes', () => {
  test('reads the user\'s favorites newest first, embedding the recipe', async () => {
    const { client, callsOf } = favoritesClient({ favorites: [] });

    await getFavoriteRecipes(client, 'user-1');

    expect(callsOf('select')).toEqual([['recipe_id, recipes(*)']]);
    expect(callsOf('eq')).toEqual([['user_id', 'user-1']]);
    expect(callsOf('order')).toEqual([['created_at', { ascending: false }]]);
  });

  test('is empty when the user has no favorites, and does not ask the filter', async () => {
    const none = favoritesClient({ favorites: [] });
    expect(await getFavoriteRecipes(none.client, 'user-1')).toEqual([]);
    expect(none.callsOf('rpc')).toEqual([]);

    expect(await getFavoriteRecipes(favoritesClient({ favorites: null }).client, 'user-1')).toEqual([]);
  });

  test('skips a favorite whose recipe no longer exists', async () => {
    const { client } = favoritesClient({ favorites: [{ recipe_id: 'r1', recipes: null }], allowed: ['r1'] });

    expect(await getFavoriteRecipes(client, 'user-1')).toEqual([]);
  });

  // FRESCO-1153: the finding. A favorite the profile now rules out, or a retired recipe, is hidden.
  test('hides the favorites the profile rules out and keeps the rest, in order', async () => {
    const { client, callsOf } = favoritesClient({
      favorites: [
        { recipe_id: 'r1', recipes: recipeRow('r1') },
        { recipe_id: 'r2', recipes: recipeRow('r2') },
        { recipe_id: 'r3', recipes: recipeRow('r3') },
      ],
      allowed: ['r3', 'r1'],
    });

    const recipes = await getFavoriteRecipes(client, 'user-1');

    expect(recipes.map(recipe => recipe.id)).toEqual(['r1', 'r3']);
    expect(callsOf('rpc')).toEqual([['filter_allowed_recipe_ids', { p_recipe_ids: ['r1', 'r2', 'r3'] }]]);
  });

  test('lists nothing when every favorite is ruled out', async () => {
    const { client } = favoritesClient({ favorites: [{ recipe_id: 'r1', recipes: recipeRow('r1') }], allowed: [] });

    expect(await getFavoriteRecipes(client, 'user-1')).toEqual([]);
  });

  test('fails closed: a filter that errors is an error, never the unfiltered list', async () => {
    const { client } = favoritesClient({ favorites: [{ recipe_id: 'r1', recipes: recipeRow('r1') }], filterError: 'down' });

    const error = await rejectionOf(getFavoriteRecipes(client, 'user-1'));

    expect(error.name).toBe('FavoritesError');
    expect(error.message).toContain('down');
  });

  test('a database error and a missing session are errors', async () => {
    const dbError = await rejectionOf(getFavoriteRecipes(favoritesClient({ favoritesError: 'boom' }).client, 'user-1'));
    expect(dbError.name).toBe('FavoritesError');
    expect(dbError.message).toContain('boom');

    expect((await rejectionOf(getFavoriteRecipes(favoritesClient({}).client))).name).toBe('FavoritesError');
  });
});

describe('addFavorite', () => {
  test('inserts the favorite with the user id set explicitly (RLS needs it to match the session)', async () => {
    const { client, callsOf } = createMockClient({});

    await addFavorite(client, { recipeId: 'r1', userId: 'user-1' });

    expect(callsOf('insert')).toEqual([[{ user_id: 'user-1', recipe_id: 'r1' }]]);
    expect(callsOf('auth.getUser')).toEqual([]);
  });

  test('without a userId it uses the signed-in user', async () => {
    const { client, callsOf } = createMockClient({ userId: 'user-2' });

    await addFavorite(client, { recipeId: 'r1' });

    expect(callsOf('insert')).toEqual([[{ user_id: 'user-2', recipe_id: 'r1' }]]);
  });

  test('a database error and a missing session fail without writing', async () => {
    const dbError = await rejectionOf(addFavorite(createMockClient({ errorMessage: 'duplicate key' }).client, { recipeId: 'r1', userId: 'user-1' }));
    expect(dbError.message).toContain('duplicate key');

    const noSession = createMockClient({});
    expect((await rejectionOf(addFavorite(noSession.client, { recipeId: 'r1' }))).name).toBe('FavoritesError');
    expect(noSession.callsOf('insert')).toEqual([]);
  });
});

describe('removeFavorite', () => {
  test('deletes only that user\'s row for that recipe', async () => {
    const { client, callsOf } = createMockClient({});

    await removeFavorite(client, { recipeId: 'r1', userId: 'user-1' });

    expect(callsOf('delete')).toHaveLength(1);
    expect(callsOf('eq')).toEqual([['user_id', 'user-1'], ['recipe_id', 'r1']]);
  });

  test('without a userId it uses the signed-in user', async () => {
    const { client, callsOf } = createMockClient({ userId: 'user-3' });

    await removeFavorite(client, { recipeId: 'r2' });

    expect(callsOf('eq')).toEqual([['user_id', 'user-3'], ['recipe_id', 'r2']]);
  });

  test('a database error and a missing session fail without deleting', async () => {
    const dbError = await rejectionOf(removeFavorite(createMockClient({ errorMessage: 'rls' }).client, { recipeId: 'r1', userId: 'user-1' }));
    expect(dbError.message).toContain('rls');

    const noSession = createMockClient({});
    expect((await rejectionOf(removeFavorite(noSession.client, { recipeId: 'r1' }))).name).toBe('FavoritesError');
    expect(noSession.callsOf('delete')).toEqual([]);
  });
});
