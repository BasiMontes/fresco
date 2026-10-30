import { describe, expect, test } from 'bun:test';
import { createMockClient } from '@/lib/fixtures/mock-supabase-client';
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

describe('getFavoriteRecipes', () => {
  test('reads the user\'s favorites newest first, embedding the recipe', async () => {
    const { client, callsOf } = createMockClient({ data: [] });

    await getFavoriteRecipes(client, 'user-1');

    expect(callsOf('select')).toEqual([['recipes(*)']]);
    expect(callsOf('eq')).toEqual([['user_id', 'user-1']]);
    expect(callsOf('order')).toEqual([['created_at', { ascending: false }]]);
  });

  test('skips a favorite whose recipe no longer exists', async () => {
    const { client } = createMockClient({ data: [{ recipes: null }, { recipes: null }] });

    expect(await getFavoriteRecipes(client, 'user-1')).toEqual([]);
  });

  test('is empty when the user has no favorites', async () => {
    expect(await getFavoriteRecipes(createMockClient({ data: null }).client, 'user-1')).toEqual([]);
  });

  test('a database error and a missing session are errors', async () => {
    const dbError = await rejectionOf(getFavoriteRecipes(createMockClient({ errorMessage: 'boom' }).client, 'user-1'));
    expect(dbError.name).toBe('FavoritesError');
    expect(dbError.message).toContain('boom');

    expect((await rejectionOf(getFavoriteRecipes(createMockClient({}).client))).name).toBe('FavoritesError');
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
