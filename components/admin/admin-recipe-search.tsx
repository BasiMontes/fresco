'use client';

import type { CatalogRecipeSearchResult } from '@/lib/api/admin-recipes';
import { ImageOff, Search } from 'lucide-react';
import Image from 'next/image';
import * as React from 'react';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { searchCatalogRecipes } from '@/lib/api/admin-recipes';
import { createClient } from '@/lib/supabase/client';

/** Debounce window before a keystroke triggers a search round trip. */
const SEARCH_DEBOUNCE_MS = 300;

/**
 * Admin catalog search + list (FRESCO-237 PR2). Search-only — no delete
 * affordance here; PR3 adds the delete button per row once the Edge
 * Function has a caller. Client-side because the search itself is
 * interactive (debounced round trip per keystroke), same reason
 * `RecipeLibrary` (`components/recipes/recipe-library.tsx`) is a client
 * component, though that one filters an already-fetched list in memory
 * while this one queries `recipes` directly per FRESCO-237's comments.md
 * Task 5 — the catalog here is the full ~1000-row table, not one profile's
 * pre-filtered safe set, so client-side filtering the whole thing isn't the
 * right shape.
 */
export function AdminRecipeSearch() {
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState<CatalogRecipeSearchResult[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length === 0) {
      setResults([]);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const timeout = setTimeout(() => {
      const supabase = createClient();
      searchCatalogRecipes(supabase, trimmed)
        .then((data) => {
          if (!cancelled) { setResults(data); }
        })
        .catch((err: unknown) => {
          if (!cancelled) {
            setError(err instanceof Error ? err.message : 'No se pudo buscar en el catálogo.');
          }
        })
        .finally(() => {
          if (!cancelled) { setLoading(false); }
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [query]);

  const trimmedQuery = query.trim();

  return (
    <div data-testid="adminRecipeSearch">
      <div className="relative mt-6">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-tertiary" aria-hidden="true" />
        <Input
          type="search"
          placeholder="Buscar por nombre o slug..."
          value={query}
          onChange={event => setQuery(event.target.value)}
          className="pl-9"
          data-testid="admin_recipe_search_input"
          aria-label="Buscar receta del catálogo por nombre o slug"
        />
      </div>

      {loading && (
        <p className="mt-4 text-body-sm text-tertiary" data-testid="admin_recipe_search_loading" aria-live="polite">
          Buscando...
        </p>
      )}

      {!loading && error && (
        <p className="mt-4 text-body-sm text-error" data-testid="admin_recipe_search_error" role="alert">
          {error}
        </p>
      )}

      {!loading && !error && trimmedQuery.length === 0 && (
        <p className="mt-6 text-body-sm text-tertiary" data-testid="admin_recipe_search_hint">
          Escribe un nombre o slug para buscar en el catálogo.
        </p>
      )}

      {!loading && !error && trimmedQuery.length > 0 && results.length === 0 && (
        <EmptyState
          data-testid="admin_recipe_search_empty_state"
          className="mt-6"
          icon={<Search className="size-8 text-tertiary" aria-hidden="true" />}
          title="No encontramos recetas para esa búsqueda"
          description="Prueba con otro nombre o slug."
        />
      )}

      {!loading && results.length > 0 && (
        <ul className="mt-6 flex flex-col gap-2" data-testid="admin_recipe_search_results">
          {results.map(recipe => (
            <li
              key={recipe.id}
              className="flex items-center gap-3 rounded-card bg-surface p-3 shadow-sm"
              data-testid="admin_recipe_result_item"
            >
              <div className="relative grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-neutral-200">
                {recipe.foto_url
                  ? (
                      <Image src={recipe.foto_url} alt={recipe.nombre} fill sizes="48px" className="object-cover" />
                    )
                  : (
                      <ImageOff className="size-5 text-neutral-400" aria-hidden="true" />
                    )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-body-md font-medium">{recipe.nombre}</p>
                <p className="truncate text-body-sm text-tertiary">{recipe.slug}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
