'use client';

import type { Recipe } from '@schemas';
import { BookOpen, Search } from 'lucide-react';
import * as React from 'react';
import { RecipeCard } from '@/components/recipe/recipe-card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';

/**
 * FRESCO-65 — client-side search over the safety-filtered catalog the page
 * already fetched (`getCatalogRecipes()`). Client-side, not a server round
 * trip per keystroke: the catalog is already bounded to one profile's safe
 * set (hundreds of rows, not the full ~1000-row table).
 *
 * Matches `nombre` OR any entry of `ingredientes_principales`,
 * case-insensitive substring (no accent-folding — a v1 gap, not silently
 * hidden: searching "piña" won't match a name typed "pina").
 */
function matchesQuery(recipe: Recipe, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) { return true; }

  if (recipe.nombre.toLowerCase().includes(needle)) { return true; }

  const ingredientes = recipe.ingredientes_principales ?? [];
  return ingredientes.some(ingrediente => ingrediente.toLowerCase().includes(needle));
}

export function RecipeLibrary({ recipes }: { recipes: Recipe[] }) {
  const [query, setQuery] = React.useState('');
  const filtered = React.useMemo(
    () => recipes.filter(recipe => matchesQuery(recipe, query)),
    [recipes, query],
  );

  return (
    <div>
      <div className="relative mt-6">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-tertiary" aria-hidden="true" />
        <Input
          type="search"
          placeholder="Buscar receta, ingrediente..."
          value={query}
          onChange={event => setQuery(event.target.value)}
          className="pl-9"
          data-testid="recipe_search_input"
          aria-label="Buscar receta o ingrediente"
        />
      </div>

      {filtered.length === 0
        ? (
            <EmptyState
              data-testid="recipe_search_empty_state"
              className="mt-6"
              icon={<Search className="size-8 text-tertiary" aria-hidden="true" />}
              title="No encontramos nada para tu búsqueda"
              description="Prueba con otro nombre o ingrediente."
            />
          )
        : (
            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4" data-testid="recipe_library_grid">
              {filtered.map(recipe => (
                <RecipeCard key={recipe.id} recipe={recipe} />
              ))}
            </div>
          )}
    </div>
  );
}

/** Catalog itself came back empty for this profile — distinct from a no-results search (see `RecipeLibrary` above). */
export function EmptyCatalogState() {
  return (
    <EmptyState
      data-testid="recipe_catalog_empty_state"
      className="mt-6"
      icon={<BookOpen className="size-8 text-tertiary" aria-hidden="true" />}
      title="No encontramos recetas para tu perfil"
      description="Prueba revisando tus restricciones de dieta o alérgenos en tu perfil."
    />
  );
}
