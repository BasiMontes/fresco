import { RecipeDetailView, RecipeNotFoundState } from '@/components/recipes/recipe-detail';
import { getFavoriteRecipeIds } from '@/lib/api/favorites';
import { getRecipeDetail } from '@/lib/api/recipes';
import { createClient } from '@/lib/supabase/server';

/**
 * `/recipes/[id]` — recipe detail (FRESCO-69). Handles both catalog recipes
 * (rich metadata, food-safety-scoped) and personal recipes (name/ingredients/
 * steps only) — see `getRecipeDetail()` for how `id` resolves to one or the
 * other.
 */
export default async function RecipeDetailPage({ params, searchParams }: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ from?: string }>
}) {
  const { id } = await params;
  const { from } = await searchParams;
  const supabase = await createClient();

  let detail: Awaited<ReturnType<typeof getRecipeDetail>>;
  try {
    detail = await getRecipeDetail(supabase, id);
  }
  catch (error) {
    console.error('[/recipes/[id]] getRecipeDetail failed, falling back to not-found state', error);
    detail = null;
  }

  // FRESCO-108: only the catalog branch renders the favorite toggle (a
  // RecetaPropia can't be favorited — `favorites.recipe_id` FK only points
  // at `public.recipes`), but computing it here (not blocking) keeps the
  // detail fetch above as the only hard failure path for this page.
  let isFavorite = false;
  try {
    isFavorite = (await getFavoriteRecipeIds(supabase)).has(id);
  }
  catch (error) {
    console.error('[/recipes/[id]] getFavoriteRecipeIds failed, defaulting to not-favorited', error);
  }

  return (
    <div className="mx-auto max-w-2xl">
      {detail ? <RecipeDetailView detail={detail} initialIsFavorite={isFavorite} from={from} /> : <RecipeNotFoundState from={from} />}
    </div>
  );
}
