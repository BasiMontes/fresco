import type { RecipeDieta } from '@schemas';
import type { RecipeFilterState } from '@/lib/recipes/recipe-filters';
import { RecipeLibrary } from '@/components/recipes/recipe-library';
import { getFavoriteRecipeIds } from '@/lib/api/favorites';
import { getCatalog, getRecetasPropias } from '@/lib/api/recipes';
import { RECIPE_PAGE_SIZE } from '@/lib/recipes/recipe-filters';
import { createClient } from '@/lib/supabase/server';

/**
 * `/recipes` — nav item 3, "Biblioteca" (EPIC-FRESCO-64, FRESCO-65). The full
 * catalog available to Laura's own food-safety profile, via the same
 * `get_filtered_recipes()` pre-filter FRESCO-9/ADR-0001 applies before
 * generating a menu.
 *
 * FRESCO-384 (audit-4 A4-M7): search, four-section filtering, facet counts,
 * and pagination are all server-side now (`get_catalog` RPC). The page is
 * driven entirely by the URL — `?q=`, `?page=`, `?meal=`, `?cocina=`,
 * `?dieta=`, `?alergeno=` — so a filtered view is shareable and the back
 * button works. `?page=N` returns the first N pages' worth of rows, so the
 * client's "Ver más" stays an append.
 */

function parseList(value: string | string[] | undefined): string[] {
  const raw = Array.isArray(value) ? value.join(',') : (value ?? '');
  return raw.split(',').map(item => item.trim()).filter(Boolean);
}

function parsePage(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(raw ?? '1', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export default async function RecipesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const query = (Array.isArray(params.q) ? params.q[0] : params.q ?? '').trim();
  const page = parsePage(params.page);
  const appliedFilters: RecipeFilterState = {
    mealTypes: parseList(params.meal) as RecipeFilterState['mealTypes'],
    cocinas: parseList(params.cocina),
    dietas: parseList(params.dieta) as (keyof RecipeDieta)[],
    alergenos: parseList(params.alergeno),
  };

  // The three reads below are mutually independent — run them concurrently.
  // Each keeps its own fallback via `.catch()` so one call's rejection can't
  // take the others down with it.
  const [catalog, recetasPropias, favoriteIds] = await Promise.all([
    getCatalog(supabase, {
      search: query || undefined,
      mealTypes: appliedFilters.mealTypes,
      cocinas: appliedFilters.cocinas,
      dietas: appliedFilters.dietas,
      alergenos: appliedFilters.alergenos,
      limit: page * RECIPE_PAGE_SIZE,
      offset: 0,
    }).catch((error) => {
      console.error('[/recipes] getCatalog failed, falling back to empty state', error);
      return { recipes: [], total: 0, facets: { mealTypes: {}, cocinas: {}, dietas: {}, alergenos: {} } };
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
      <RecipeLibrary
        recipes={catalog.recipes}
        total={catalog.total}
        page={page}
        facets={catalog.facets}
        appliedFilters={appliedFilters}
        query={query}
        recetasPropias={recetasPropias}
        favoriteRecipeIds={favoriteIds}
      />
    </div>
  );
}
