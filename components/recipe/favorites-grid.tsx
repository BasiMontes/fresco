'use client';

import type { Recipe } from '@schemas';
import { Heart } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { FavoriteRecipeCard } from '@/components/recipe/favorite-recipe-card';
import { EmptyState } from '@/components/ui/empty-state';

/**
 * FRESCO-171 — /favorites is the one place unfavoriting must remove the
 * card from view immediately (elsewhere, e.g. /menu or /recipes, a card
 * staying visible after unfavoriting is correct — the recipe itself didn't
 * disappear). Local list state, same pattern as `recipe-library.tsx`'s
 * `misRecetas`, updated via `FavoriteRecipeCard`'s `onToggleFavorite`.
 */
export function FavoritesGrid({ recipes }: { recipes: Recipe[] }) {
  const [items, setItems] = React.useState(recipes);

  function handleToggleFavorite(recipeId: string, isFavorite: boolean) {
    if (!isFavorite) {
      setItems(current => current.filter(recipe => recipe.id !== recipeId));
    }
  }

  if (items.length === 0) {
    return (
      <EmptyState
        className="mt-6"
        data-testid="favorites_empty_state"
        icon={<Heart className="size-8 text-tertiary" aria-hidden="true" />}
        title="Lista vacía"
        description="Guarda recetas para verlas aquí."
      />
    );
  }

  return (
    <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4" data-testid="favorites_grid">
      {items.map(recipe => (
        <Link key={recipe.id} href={`/recipes/${recipe.id}`}>
          <FavoriteRecipeCard recipe={recipe} initialIsFavorite onToggleFavorite={handleToggleFavorite} />
        </Link>
      ))}
    </div>
  );
}
