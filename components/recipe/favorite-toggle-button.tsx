'use client';

import { Heart } from 'lucide-react';
import * as React from 'react';
import { LIKE_PARTICLE_COUNT, triggerLikeBurst } from '@/components/recipe/like-burst';
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
  const buttonRef = React.useRef<HTMLButtonElement>(null);

  async function handleToggle() {
    const next = !isFavorite;
    setIsFavorite(next);
    // AC-1: the visual feedback fires immediately, ahead of the network
    // round-trip below — same optimistic-update timing already in place,
    // this is only the added celebration layer.
    if (next) {
      triggerLikeBurst(buttonRef.current);
    }

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
      ref={buttonRef}
      variant="icon"
      size="sm"
      aria-label={isFavorite ? 'Quitar de favoritos' : 'Guardar en favoritos'}
      data-testid="recipe_detail_favorite_button"
      data-liked={isFavorite}
      onClick={() => { void handleToggle(); }}
      className={cn('t-like relative', className)}
    >
      <span className="t-like-icon">
        <Heart className="t-like-heart size-6" />
      </span>
      <span className="t-like-particles" aria-hidden="true" data-testid="recipe_detail_favorite_particles">
        {Array.from({ length: LIKE_PARTICLE_COUNT }, (_, index) => (
          <i key={index} />
        ))}
      </span>
    </Button>
  );
}
