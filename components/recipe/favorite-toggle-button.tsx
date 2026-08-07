'use client';

import { Heart } from 'lucide-react';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { addFavorite, removeFavorite } from '@/lib/api/favorites';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

export interface FavoriteToggleButtonProps {
  recipeId: string
  initialIsFavorite: boolean
  className?: string
}

/**
 * FRESCO-108 — standalone favorite toggle for surfaces that don't render a
 * full `RecipeCard` around it (the recipe detail page). Same optimistic
 * update + revert-on-failure pattern as `FavoriteRecipeCard`.
 */
export function FavoriteToggleButton({ recipeId, initialIsFavorite, className }: FavoriteToggleButtonProps) {
  const [isFavorite, setIsFavorite] = React.useState(initialIsFavorite);
  const supabase = React.useMemo(() => createClient(), []);

  async function handleToggle() {
    const next = !isFavorite;
    setIsFavorite(next);

    try {
      if (next) {
        await addFavorite(supabase, recipeId);
      }
      else {
        await removeFavorite(supabase, recipeId);
      }
    }
    catch (error) {
      console.error('[FavoriteToggleButton] toggle failed, reverting', error);
      setIsFavorite(!next);
    }
  }

  return (
    <Button
      variant="icon"
      size="sm"
      aria-label={isFavorite ? 'Quitar de favoritos' : 'Guardar en favoritos'}
      data-testid="recipe_detail_favorite_button"
      onClick={() => { void handleToggle(); }}
      className={className}
    >
      <Heart className={cn('size-[22px]', isFavorite && 'fill-primary')} />
    </Button>
  );
}
