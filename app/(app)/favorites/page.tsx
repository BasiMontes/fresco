import { ArrowLeft, Heart } from 'lucide-react';
import Link from 'next/link';
import { FavoriteRecipeCard } from '@/components/recipe/favorite-recipe-card';
import { buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { getFavoriteRecipes } from '@/lib/api/favorites';
import { createClient } from '@/lib/supabase/server';

/**
 * FRESCO-71 — mockup nav showed Despensa/Lista Compra, which don't exist
 * in this app (confirmed with the user before building); this page uses the
 * app's real 4-item nav via `AppShell`, not the mockup's.
 *
 * FRESCO-77 — now backed by real data (`favorites` table). Cards stay
 * favoritable here too (`FavoriteRecipeCard`), so unfavoriting from this
 * page removes the recipe on the next render, not just visually.
 */
export default async function FavoritesPage() {
  const supabase = await createClient();

  const recetas = await getFavoriteRecipes(supabase).catch((error) => {
    // Same fail-soft pattern as every other server-side read in the app: a
    // real read failure falls back to the empty state rather than crashing
    // the page, logged so a real outage stays visible in server logs.
    console.error('[/favorites] getFavoriteRecipes failed, falling back to empty state', error);
    return [];
  });

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center gap-3">
        <Link href="/menu" className={buttonVariants({ variant: 'icon', size: 'sm' })} aria-label="Volver" data-testid="favorites_back_link">
          <ArrowLeft className="size-[22px]" />
        </Link>
        <div>
          <h1 className="text-h2">Tus Favoritos</h1>
          <p className="text-body-sm uppercase text-tertiary">Tu biblioteca seleccionada</p>
        </div>
      </div>

      {recetas.length === 0
        ? (
            <EmptyState
              className="mt-6"
              data-testid="favorites_empty_state"
              icon={<Heart className="size-8 text-tertiary" aria-hidden="true" />}
              title="Lista vacía"
              description="Guarda recetas para verlas aquí."
            />
          )
        : (
            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4" data-testid="favorites_grid">
              {recetas.map(recipe => (
                <Link key={recipe.id} href={`/recipes/${recipe.id}`}>
                  <FavoriteRecipeCard recipe={recipe} initialIsFavorite />
                </Link>
              ))}
            </div>
          )}
    </div>
  );
}
