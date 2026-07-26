import type { Recipe } from '@/lib/api/types';

import { Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tag } from '@/components/ui/tag';
import { cn } from '@/lib/utils';

/**
 * Mirrors DESIGN.md's `components.recipe-card`: base card treatment + a
 * dedicated image area (`rounded.lg`, washed placeholder — no photography in
 * the MVP per mvp-scope.md's "Deferred to P1" list), a top-right circular
 * favorite button, an `h6` kicker, a heading-font title, one tag, and a meta
 * line ("50 min · fácil · 2,80€/persona").
 */
export interface RecipeCardProps {
  recipe: Recipe
  isFavorite?: boolean
  onToggleFavorite?: () => void
  className?: string
}

export function RecipeCard({ recipe, isFavorite, onToggleFavorite, className }: RecipeCardProps) {
  return (
    <div className={cn('rounded-card bg-surface p-3 shadow-sm', className)}>
      <div className="relative mb-2 aspect-[4/3] w-full overflow-hidden rounded-lg bg-neutral-200">
        <Button
          variant="icon"
          size="sm"
          aria-label={isFavorite ? 'Quitar de favoritos' : 'Guardar en favoritos'}
          onClick={onToggleFavorite}
          className="absolute right-2 top-2"
        >
          <Heart className={cn('size-4', isFavorite && 'fill-primary')} />
        </Button>
      </div>
      <p className="text-h6 uppercase text-tertiary">{recipe.categoria}</p>
      <h3 className="text-h5">{recipe.nombre}</h3>
      <div className="mt-1">
        <Tag variant={recipe.dieta.length > 0 ? 'accent' : 'neutral'}>
          {recipe.dieta[0] ?? recipe.cocina}
        </Tag>
      </div>
      <p className="mt-2 text-body-sm text-tertiary">
        {recipe.minutos}
        {' '}
        min ·
        {recipe.coste_bucket}
      </p>
    </div>
  );
}
