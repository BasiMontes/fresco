import type { Recipe, RecipeDieta } from '@schemas';

import { Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tag } from '@/components/ui/tag';
import { getCategoryIcon } from '@/lib/recipes/category-icon';
import { cn } from '@/lib/utils';

/**
 * Mirrors DESIGN.md's `components.recipe-card`: base card treatment + a
 * dedicated image area (`rounded.lg`, washed placeholder with a per-category
 * icon — real photography stays deferred to P1 per mvp-scope.md, but a flat
 * gray box with zero information was worse than it needed to be for free),
 * a top-right circular favorite button, an `h6` kicker, a heading-font
 * title, one tag, and a meta line ("50 min · fácil · 2,80€/persona").
 *
 * Consumes the real, nested `@schemas` `Recipe` shape (`clasificacion`/
 * `meta`/`dieta` objects, the live DB/Edge Function contract) — not a flat
 * hand-duplicated shape. `meta`/`clasificacion`/`dieta` may be `null` (jsonb
 * columns the seeding pipeline populated only partially, per that type's own
 * doc comment), so every field read below is optional-chained with a
 * fallback rather than assumed present.
 */
export interface RecipeCardProps {
  recipe: Recipe
  isFavorite?: boolean
  onToggleFavorite?: () => void
  className?: string
}

const DIETA_LABELS: Partial<Record<keyof RecipeDieta, string>> = {
  vegetariano: 'vegetariano',
  vegano: 'vegano',
  sin_gluten: 'sin gluten',
  sin_lactosa: 'sin lactosa',
  sin_huevo: 'sin huevo',
  bajo_fodmap: 'bajo FODMAP',
  keto: 'keto',
  paleo: 'paleo',
  halal: 'halal',
  kosher: 'kosher',
};

/** First active diet flag on `dieta`, as a display label, or `null` if none/unknown. */
function firstActiveDietaLabel(dieta: RecipeDieta | null): string | null {
  if (!dieta) { return null; }
  const active = (Object.keys(DIETA_LABELS) as (keyof RecipeDieta)[]).find(flag => dieta[flag]);
  return active ? (DIETA_LABELS[active] ?? null) : null;
}

export function RecipeCard({ recipe, isFavorite, onToggleFavorite, className }: RecipeCardProps) {
  const dietaLabel = firstActiveDietaLabel(recipe.dieta);
  const CategoryIcon = getCategoryIcon(recipe.clasificacion?.categoria);

  return (
    <div className={cn('rounded-card bg-surface p-3 shadow-sm', className)}>
      <div className="relative mb-2 grid aspect-[4/3] w-full place-items-center overflow-hidden rounded-lg bg-neutral-200">
        <CategoryIcon className="size-10 text-neutral-400" aria-hidden="true" />
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
      <p className="text-h6 uppercase text-tertiary">{recipe.clasificacion?.categoria ?? '—'}</p>
      <h3 className="text-h5">{recipe.nombre}</h3>
      <div className="mt-1">
        <Tag variant={dietaLabel ? 'accent' : 'neutral'}>
          {dietaLabel ?? recipe.clasificacion?.cocina ?? '—'}
        </Tag>
      </div>
      <p className="mt-2 text-body-sm text-tertiary">
        {recipe.meta?.tiempo_total_min ?? '—'}
        {' '}
        min ·
        {recipe.meta?.coste_estimado ?? '—'}
      </p>
    </div>
  );
}
