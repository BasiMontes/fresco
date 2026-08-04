import { EmptyCatalogState, RecipeLibrary } from '@/components/recipes/recipe-library';
import { getFavoriteRecipeIds } from '@/lib/api/favorites';
import { getCatalogRecipes, getRecetasPropias } from '@/lib/api/recipes';
import { createClient } from '@/lib/supabase/server';

/**
 * `/recipes` — nav item 3, "Biblioteca" (EPIC-FRESCO-64, FRESCO-65). Reframed
 * from "recipes Fresco has served this household" (`getUserRecipes()`, the
 * original scaffold) to the full catalog available to Laura's own
 * food-safety profile, via the same `get_filtered_recipes()` pre-filter
 * FRESCO-9/ADR-0001 already applies before generating a menu — a household
 * should be able to discover recipes before ever cooking them, not only
 * browse what they've already been served.
 *
 * Two distinct empty states: the catalog itself coming back empty (a very
 * restrictive profile — rare) vs. a search matching nothing (common, and a
 * completely different fix — clear the search, not the profile). See
 * `components/recipes/recipe-library.tsx`.
 */
export default async function RecipesPage() {
  const supabase = await createClient();

  // The two reads below are mutually independent — run them concurrently
  // rather than paying for 2 sequential round trips. Each keeps its own
  // fallback via `.catch()` (same judgment calls as before) so one call's
  // rejection can't take the other down with it.
  const [recipes, recetasPropias, favoriteIds] = await Promise.all([
    getCatalogRecipes(supabase).catch((error) => {
      // Same judgment call as every other read on this page family: a real
      // read failure falls back to the empty state rather than crashing the
      // page — logged so a real outage stays visible in server logs instead
      // of looking like a profile with zero eligible recipes.
      console.error('[/recipes] getCatalogRecipes failed, falling back to empty state', error);
      return [] as Awaited<ReturnType<typeof getCatalogRecipes>>;
    }),
    getRecetasPropias(supabase).catch((error) => {
      console.error('[/recipes] getRecetasPropias failed, falling back to empty list', error);
      return [] as Awaited<ReturnType<typeof getRecetasPropias>>;
    }),
    getFavoriteRecipeIds(supabase).catch((error) => {
      console.error('[/recipes] getFavoriteRecipeIds failed, defaulting to none favorited', error);
      return new Set<string>();
    }),
  ]);

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-h2">Biblioteca</h1>
      <p className="mt-1 text-body-md text-tertiary">
        Descubre recetas de tu catálogo, dentro de tu perfil de seguridad alimentaria.
      </p>

      <h2 className="sr-only">Recetas del catálogo</h2>
      {recipes.length === 0
        ? <EmptyCatalogState />
        : <RecipeLibrary recipes={recipes} recetasPropias={recetasPropias} favoriteRecipeIds={favoriteIds} />}
    </div>
  );
}
