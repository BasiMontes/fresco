'use client';

import type { Recipe } from '@schemas';
import * as React from 'react';
import { RecipeCard } from '@/components/recipe/recipe-card';
import { addFavorite, removeFavorite } from '@/lib/api/favorites';
import { createClient } from '@/lib/supabase/client';

export interface FavoriteRecipeCardProps {
  recipe: Recipe
  initialIsFavorite: boolean
  className?: string
  onToggleFavorite?: (recipeId: string, isFavorite: boolean) => void
}

/**
 * FRESCO-77 — thin client wrapper so the server components that render
 * `RecipeCard` (`/menu`, `LatestRecipesSection`) can offer a working
 * favorite toggle without becoming client components themselves. Optimistic
 * update + revert-on-failure, same pattern as `ShoppingListView`'s
 * `comprado` checkbox.
 */
export function FavoriteRecipeCard({ recipe, initialIsFavorite, className, onToggleFavorite }: FavoriteRecipeCardProps) {
  const [isFavorite, setIsFavorite] = React.useState(initialIsFavorite);
  const supabase = React.useMemo(() => createClient(), []);

  async function handleToggle() {
    const next = !isFavorite;
    setIsFavorite(next);

    try {
      if (next) {
        await addFavorite(supabase, recipe.id);
      }
      else {
        await removeFavorite(supabase, recipe.id);
      }
      // FRESCO-171: only notify the parent once the write is confirmed —
      // never optimistically, so a failed toggle (caught below) can't leave
      // a page-level list (e.g. /favorites) out of sync with a card that
      // reverted itself.
      onToggleFavorite?.(recipe.id, next);
    }
    catch (error) {
      console.error('[FavoriteRecipeCard] toggle failed, reverting', error);
      setIsFavorite(!next);
    }
  }

  return <RecipeCard recipe={recipe} isFavorite={isFavorite} onToggleFavorite={() => { void handleToggle(); }} className={className} />;
}
