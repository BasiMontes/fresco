import { RecipeDetailView, RecipeNotFoundState } from '@/components/recipes/recipe-detail';
import { getFavoriteRecipeIds } from '@/lib/api/favorites';
import { getRecipeDetail } from '@/lib/api/recipes';
import { getAuthUser } from '@/lib/auth/current-user';
import { getSlotSubstitutionContext } from '@/lib/ingredients/get-slot-substitution-context';
import { createClient } from '@/lib/supabase/server';

/**
 * `/recipes/[id]` — recipe detail (FRESCO-69). Handles both catalog recipes
 * (rich metadata, food-safety-scoped) and personal recipes (name/ingredients/
 * steps only) — see `getRecipeDetail()` for how `id` resolves to one or the
 * other.
 *
 * FRESCO-534: an optional `?slot=<meal_plan_recipe_id>` (set only by
 * `calendar-grid.tsx`'s navigation) scopes the ingredient-substitution UI to
 * that specific planned meal. `getSlotSubstitutionContext()` degrades to
 * `null` on any mismatch (wrong recipe, not the caller's slot, or absent) —
 * a Biblioteca-browse open of the same recipe never carries it.
 */
export default async function RecipeDetailPage({ params, searchParams }: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ from?: string, slot?: string }>
}) {
  const { id } = await params;
  const { from, slot } = await searchParams;
  const supabase = await createClient();
  // FRESCO-483: resolve the session once for both reads below.
  const { data: { user } } = await getAuthUser();

  let detail: Awaited<ReturnType<typeof getRecipeDetail>>;
  try {
    detail = await getRecipeDetail(supabase, id, user?.id);
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
    isFavorite = (await getFavoriteRecipeIds(supabase, user?.id)).has(id);
  }
  catch (error) {
    console.error('[/recipes/[id]] getFavoriteRecipeIds failed, defaulting to not-favorited', error);
  }

  const substitutionContext = detail ? await getSlotSubstitutionContext(supabase, slot, id) : null;

  return (
    <div className="mx-auto max-w-2xl">
      {detail
        ? (
            <RecipeDetailView
              detail={detail}
              initialIsFavorite={isFavorite}
              from={from}
              slotId={substitutionContext?.slotId}
              sustitucionIngrediente={substitutionContext?.sustitucionIngrediente}
            />
          )
        : (
            <RecipeNotFoundState from={from} />
          )}
    </div>
  );
}
