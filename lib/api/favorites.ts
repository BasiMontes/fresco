import type { Recipe } from '@schemas';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import { toRecipes } from '@/lib/api/recipes';

class FavoritesError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FavoritesError';
  }
}

/**
 * The CURRENTLY authenticated user's favorited recipe ids (FRESCO-77), for
 * wiring `RecipeCard`'s `isFavorite` prop across `/menu`, "Últimas recetas",
 * and the `/recipes` library without fetching full recipe rows.
 */
export async function getFavoriteRecipeIds(
  client: SupabaseClient<Database>,
  userId?: string,
): Promise<Set<string>> {
  let resolvedUserId = userId;

  if (!resolvedUserId) {
    const { data: { user }, error: userError } = await client.auth.getUser();

    if (userError || !user) {
      throw new FavoritesError('No hay una sesión autenticada para leer tus favoritos.');
    }

    resolvedUserId = user.id;
  }

  const { data, error } = await client
    .from('favorites')
    .select('recipe_id')
    .eq('user_id', resolvedUserId);

  if (error) {
    throw new FavoritesError(`No se pudieron leer tus favoritos: ${error.message}`);
  }

  return new Set((data ?? []).map(row => row.recipe_id));
}

/**
 * The CURRENTLY authenticated user's favorited recipes, full rows (FRESCO-71
 * `/favorites`). Embeds through the `favorites_recipe_id_fkey` relationship
 * rather than a separate `getFavoriteRecipeIds()` + `.in('id', ...)` round
 * trip — one request either way, PostgREST does the join.
 */
export async function getFavoriteRecipes(
  client: SupabaseClient<Database>,
  userId?: string,
): Promise<Recipe[]> {
  let resolvedUserId = userId;

  if (!resolvedUserId) {
    const { data: { user }, error: userError } = await client.auth.getUser();

    if (userError || !user) {
      throw new FavoritesError('No hay una sesión autenticada para leer tus favoritos.');
    }

    resolvedUserId = user.id;
  }

  const { data, error } = await client
    .from('favorites')
    .select('recipe_id, recipes(*)')
    .eq('user_id', resolvedUserId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new FavoritesError(`No se pudieron leer tus favoritos: ${error.message}`);
  }

  const favoritos = data ?? [];
  if (favoritos.length === 0) {
    return [];
  }

  // FRESCO-1153: a favorite is a recipe the person marked at some point, perhaps before declaring an
  // allergen, perhaps since retired. Only the ones that pass TODAY's profile are listed, asked to the same
  // filter the catalog uses (filter_allowed_recipe_ids -> get_filtered_recipes); the rest are hidden, not
  // deleted, so they come back if the profile changes. Fails closed: if the filter cannot answer, the page
  // errors instead of listing everything.
  const { data: permitidas, error: filterError } = await client.rpc('filter_allowed_recipe_ids', {
    p_recipe_ids: favoritos.map(row => row.recipe_id),
  });

  if (filterError) {
    throw new FavoritesError(`No se pudieron comprobar tus favoritos: ${filterError.message}`);
  }

  const permitidasSet = new Set(permitidas ?? []);
  return toRecipes(favoritos
    .filter(row => permitidasSet.has(row.recipe_id))
    .map(row => row.recipes)
    .filter(row => row !== null));
}

/**
 * Favorites a catalog recipe for the CURRENTLY authenticated user.
 * `user_id` set explicitly from the resolved session — RLS
 * `favorites_insert_own`'s `with check` requires it match `auth.uid()`.
 */
export async function addFavorite(
  client: SupabaseClient<Database>,
  { recipeId, userId }: { recipeId: string, userId?: string },
): Promise<void> {
  let resolvedUserId = userId;

  if (!resolvedUserId) {
    const { data: { user }, error: userError } = await client.auth.getUser();

    if (userError || !user) {
      throw new FavoritesError('No hay una sesión autenticada para guardar el favorito.');
    }

    resolvedUserId = user.id;
  }

  const { error } = await client
    .from('favorites')
    .insert({ user_id: resolvedUserId, recipe_id: recipeId });

  if (error) {
    throw new FavoritesError(`No se pudo guardar el favorito: ${error.message}`);
  }
}

/** Unfavorites a catalog recipe for the CURRENTLY authenticated user. */
export async function removeFavorite(
  client: SupabaseClient<Database>,
  { recipeId, userId }: { recipeId: string, userId?: string },
): Promise<void> {
  let resolvedUserId = userId;

  if (!resolvedUserId) {
    const { data: { user }, error: userError } = await client.auth.getUser();

    if (userError || !user) {
      throw new FavoritesError('No hay una sesión autenticada para quitar el favorito.');
    }

    resolvedUserId = user.id;
  }

  const { error } = await client
    .from('favorites')
    .delete()
    .eq('user_id', resolvedUserId)
    .eq('recipe_id', recipeId);

  if (error) {
    throw new FavoritesError(`No se pudo quitar el favorito: ${error.message}`);
  }
}
