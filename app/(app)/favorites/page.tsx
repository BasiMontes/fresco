import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { FavoritesGrid } from '@/components/recipe/favorites-grid';
import { buttonVariants } from '@/components/ui/button';
import { getFavoriteRecipes } from '@/lib/api/favorites';
import { createClient } from '@/lib/supabase/server';
import { cn } from '@/lib/utils';

/**
 * FRESCO-71 — mockup nav showed Despensa/Lista Compra, which don't exist
 * in this app (confirmed with the user before building); this page uses the
 * app's real 4-item nav via `AppShell`, not the mockup's.
 *
 * FRESCO-77 — now backed by real data (`favorites` table). Cards stay
 * favoritable here too, via `FavoritesGrid` (FRESCO-171 — that's the
 * client boundary that removes a card from view the moment it's
 * unfavorited, not just on the next full reload).
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
    // FRESCO-451 (slice 4/5): matches /recipes' max-w-5xl — same grid-cols
    // breakpoints (recipe-library.tsx), so the shared lg:grid-cols-4 layout
    // was cramped narrower here than on the catalog browse grid.
    <div className="mx-auto max-w-5xl">
      <div className="flex items-center gap-3">
        <Link href="/menu" className={cn(buttonVariants({ variant: 'icon', size: 'sm' }))} aria-label="Volver" data-testid="favorites_back_link">
          <ArrowLeft className="size-6" />
        </Link>
        <div>
          <h1 className="text-h2">Tus Favoritos</h1>
          <p className="text-h6 uppercase text-tertiary">Tu biblioteca seleccionada</p>
        </div>
      </div>

      <FavoritesGrid recipes={recetas} />
    </div>
  );
}
