import type { RecetaPropia, Recipe } from '@schemas';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

/** Raw `public.recipes` row shape — jsonb columns typed as `Json`, per `lib/supabase/types.ts`. */
export type RecipeRow = Database['public']['Tables']['recipes']['Row'];

export class RecipesError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RecipesError';
  }
}

/**
 * Reshapes a raw `recipes` row (jsonb columns typed as `Json`) into the
 * strongly-typed `@schemas` `Recipe` shape. A cast, not a runtime validation
 * — mirrors the same trust boundary `generate-meal-plan/index.ts` already
 * takes on the backend (`.returns<Recipe[]>()` on the same table). Shared
 * with `lib/api/meal-plan.ts` — one place for this mapping instead of two
 * copies that could silently drift.
 */
export function toRecipe(row: RecipeRow): Recipe {
  return {
    ...row,
    meta: row.meta as unknown as Recipe['meta'],
    clasificacion: row.clasificacion as unknown as Recipe['clasificacion'],
    dieta: row.dieta as unknown as Recipe['dieta'],
    alergenos: row.alergenos as unknown as Recipe['alergenos'],
    ingredientes_principales: row.ingredientes_principales as unknown as Recipe['ingredientes_principales'],
    ingredientes_que_puede_desagradar: row.ingredientes_que_puede_desagradar as unknown as Recipe['ingredientes_que_puede_desagradar'],
    temporada: row.temporada as unknown as Recipe['temporada'],
    pasos_resumen: row.pasos_resumen as unknown as Recipe['pasos_resumen'],
  };
}

/**
 * Counts recipes available to the CURRENTLY authenticated user's profile
 * (FRESCO-57, `/menu` "recetas disponibles" card). Reuses
 * `get_filtered_recipes()` — the same food-safety pre-filter FRESCO-9/
 * ADR-0001 already applies before generating a menu — so this count can
 * never overstate what the user could actually be served.
 *
 * `{ head: true, count: 'exact' }` asks PostgREST for the row count via the
 * `Content-Range` response header only; it never transfers the full
 * filtered recipe set just to measure its length.
 *
 * `userId` is the same optional escape hatch as `getUserNombre` — pages
 * that already resolved `auth.getUser()` can skip the redundant round trip.
 */
export async function getAvailableRecipesCount(
  client: SupabaseClient<Database>,
  userId?: string,
): Promise<number> {
  let resolvedUserId = userId;

  if (!resolvedUserId) {
    const { data: { user }, error: userError } = await client.auth.getUser();

    if (userError || !user) {
      throw new RecipesError('No hay una sesión autenticada para contar las recetas disponibles.');
    }

    resolvedUserId = user.id;
  }

  const { count, error } = await client
    .rpc('get_filtered_recipes', { p_user_id: resolvedUserId }, { head: true, count: 'exact' });

  if (error) {
    throw new RecipesError(`No se pudo contar las recetas disponibles: ${error.message}`);
  }

  return count ?? 0;
}

/**
 * Most recently added recipes the CURRENTLY authenticated user could
 * actually be served (FRESCO-59, `/menu` "últimas recetas" section). Same
 * `get_filtered_recipes()` safety pre-filter as `getAvailableRecipesCount`
 * — per the epic's own noted assumption (confirmed in the story's AC:
 * "dentro de las que puede comer según su perfil"), this section must never
 * surface a recipe outside the user's allergen/diet profile just because it
 * was added recently.
 *
 * `.order()`/`.limit()` chain directly onto the RPC call — PostgREST
 * supports ordering and limiting the result set of a function that returns
 * `setof`, exactly like a table query, so no change to the SQL function
 * itself (still 1 request, still safety-filtered first).
 */
export async function getLatestAvailableRecipes(
  client: SupabaseClient<Database>,
  userId?: string,
  limit = 6,
): Promise<Recipe[]> {
  let resolvedUserId = userId;

  if (!resolvedUserId) {
    const { data: { user }, error: userError } = await client.auth.getUser();

    if (userError || !user) {
      throw new RecipesError('No hay una sesión autenticada para leer las últimas recetas.');
    }

    resolvedUserId = user.id;
  }

  const { data, error } = await client
    .rpc('get_filtered_recipes', { p_user_id: resolvedUserId })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new RecipesError(`No se pudieron leer las últimas recetas: ${error.message}`);
  }

  return (data ?? []).map(toRecipe);
}

/**
 * The full catalog available to the CURRENTLY authenticated user's profile
 * (FRESCO-65, `/recipes` "Biblioteca" browse grid). Same `get_filtered_recipes()`
 * safety pre-filter as its siblings — no `.order()`/`.limit()` here: unlike
 * `getLatestAvailableRecipes()`, this is meant to be the whole browsable set,
 * not a recency-biased slice.
 */
export async function getCatalogRecipes(
  client: SupabaseClient<Database>,
  userId?: string,
): Promise<Recipe[]> {
  let resolvedUserId = userId;

  if (!resolvedUserId) {
    const { data: { user }, error: userError } = await client.auth.getUser();

    if (userError || !user) {
      throw new RecipesError('No hay una sesión autenticada para leer el catálogo.');
    }

    resolvedUserId = user.id;
  }

  const { data, error } = await client
    .rpc('get_filtered_recipes', { p_user_id: resolvedUserId });

  if (error) {
    throw new RecipesError(`No se pudo leer el catálogo de recetas: ${error.message}`);
  }

  return (data ?? []).map(toRecipe);
}

/**
 * The CURRENTLY authenticated user's personal recipes (FRESCO-68, `/recipes`
 * "Biblioteca"). Reads `public.recetas_propias` directly (not a `get_filtered_recipes()`-style
 * RPC) — RLS `recetas_propias_select_own` already scopes rows to `auth.uid()`,
 * so this is a plain table select, not a security-relevant filter like its
 * catalog siblings above.
 */
export async function getRecetasPropias(
  client: SupabaseClient<Database>,
  userId?: string,
): Promise<RecetaPropia[]> {
  let resolvedUserId = userId;

  if (!resolvedUserId) {
    const { data: { user }, error: userError } = await client.auth.getUser();

    if (userError || !user) {
      throw new RecipesError('No hay una sesión autenticada para leer tus recetas propias.');
    }

    resolvedUserId = user.id;
  }

  const { data, error } = await client
    .from('recetas_propias')
    .select('*')
    .eq('user_id', resolvedUserId);

  if (error) {
    throw new RecipesError(`No se pudieron leer tus recetas propias: ${error.message}`);
  }

  return data ?? [];
}

export interface CreateRecetaPropiaInput {
  nombre: string
  ingredientes: string[]
  pasos: string[]
}

/**
 * Creates a personal recipe for the CURRENTLY authenticated user (FRESCO-68).
 * `user_id` is set explicitly from the resolved session — RLS `recetas_propias_insert_own`'s
 * `with check` requires it match `auth.uid()`, so this can't be left implicit.
 */
export async function createRecetaPropia(
  client: SupabaseClient<Database>,
  input: CreateRecetaPropiaInput,
): Promise<RecetaPropia> {
  const { data: { user }, error: userError } = await client.auth.getUser();

  if (userError || !user) {
    throw new RecipesError('No hay una sesión autenticada para crear una receta propia.');
  }

  const { data, error } = await client
    .from('recetas_propias')
    .insert({ user_id: user.id, ...input })
    .select('*')
    .single();

  if (error) {
    throw new RecipesError(`No se pudo guardar tu receta: ${error.message}`);
  }

  return data;
}

export type RecipeDetail
  = | { kind: 'catalogo', receta: Recipe }
    | { kind: 'propia', receta: RecetaPropia };

/**
 * A single recipe's detail by id (FRESCO-69), for whichever recipe type
 * `id` belongs to. Tries `recetas_propias` first (cheap PK lookup, RLS
 * already scopes it to the caller) before the catalog, since a personal
 * recipe never shows up in `get_filtered_recipes()` and checking it first
 * avoids a wasted RPC call on the common "it's mine" case.
 *
 * The catalog lookup passes `id` as `get_filtered_recipes()`'s `p_recipe_id`
 * parameter, letting Postgres use the `recipes` primary-key index instead of
 * filtering the whole catalog client-side for one row — so a recipe outside
 * Laura's food-safety profile returns no row here, the same as it never
 * appearing in the Biblioteca grid, rather than needing a second, separate
 * safety check.
 *
 * Returns `null` when `id` matches neither table (deleted, wrong id, or a
 * catalog recipe excluded by the caller's profile) — the page renders a
 * not-found state rather than throwing, since "recipe doesn't exist for you"
 * is an expected outcome, not a system error.
 */
export async function getRecipeDetail(
  client: SupabaseClient<Database>,
  id: string,
  userId?: string,
): Promise<RecipeDetail | null> {
  let resolvedUserId = userId;

  if (!resolvedUserId) {
    const { data: { user }, error: userError } = await client.auth.getUser();

    if (userError || !user) {
      throw new RecipesError('No hay una sesión autenticada para leer esta receta.');
    }

    resolvedUserId = user.id;
  }

  const { data: propia, error: propiaError } = await client
    .from('recetas_propias')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (propiaError) {
    throw new RecipesError(`No se pudo leer la receta: ${propiaError.message}`);
  }
  if (propia) {
    return { kind: 'propia', receta: propia };
  }

  const { data: catalogo, error: catalogoError } = await client
    .rpc('get_filtered_recipes', { p_user_id: resolvedUserId, p_recipe_id: id })
    .maybeSingle();

  if (catalogoError) {
    throw new RecipesError(`No se pudo leer la receta: ${catalogoError.message}`);
  }
  if (catalogo) {
    return { kind: 'catalogo', receta: toRecipe(catalogo) };
  }

  return null;
}
