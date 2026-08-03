import { RecipeDetailView, RecipeNotFoundState } from '@/components/recipes/recipe-detail';
import { getRecipeDetail } from '@/lib/api/recipes';
import { createClient } from '@/lib/supabase/server';

/**
 * `/recipes/[id]` — recipe detail (FRESCO-69). Handles both catalog recipes
 * (rich metadata, food-safety-scoped) and personal recipes (name/ingredients/
 * steps only) — see `getRecipeDetail()` for how `id` resolves to one or the
 * other.
 */
export default async function RecipeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  let detail: Awaited<ReturnType<typeof getRecipeDetail>>;
  try {
    detail = await getRecipeDetail(supabase, id);
  }
  catch (error) {
    console.error('[/recipes/[id]] getRecipeDetail failed, falling back to not-found state', error);
    detail = null;
  }

  return (
    <div className="mx-auto max-w-2xl">
      {detail ? <RecipeDetailView detail={detail} /> : <RecipeNotFoundState />}
    </div>
  );
}
