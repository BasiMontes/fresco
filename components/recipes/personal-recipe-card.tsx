import type { RecetaPropia } from '@schemas';
import { RecipeCardMedia } from '@/components/recipe/recipe-card-media';
import { Tag } from '@/components/ui/tag';
import { cn } from '@/lib/utils';

/**
 * Card for a user-created personal recipe (FRESCO-68). Deliberately NOT
 * `RecipeCard` — a `RecetaPropia` has no photo/`clasificacion`/`dieta` to
 * show, and the "Tu receta" tag is what distinguishes it from the catalog
 * grid per the story's own Scope ("distinguibles de las del catálogo").
 *
 * FRESCO-441 — shares `RecipeCardMedia` so a mixed `/recipes` grid (catalog
 * + personal) reads coherent: the same full-bleed media area, resolving to
 * the designed `RecipePlaceholder` (a personal recipe never has a photo or
 * a category, so it gets the neutral fallback gradient + its initial).
 */
export function PersonalRecipeCard({ receta, className }: { receta: RecetaPropia, className?: string }) {
  return (
    <div className={cn('flex h-full flex-col overflow-hidden rounded-card border border-border bg-surface-raised shadow-sm', className)}>
      <RecipeCardMedia fotoUrl={null} nombre={receta.nombre} categoria={null} />
      <div className="flex flex-1 flex-col p-3">
        <h3 className="line-clamp-2 text-h5">{receta.nombre}</h3>
        <div className="mt-1">
          <Tag variant="outline">Tu receta</Tag>
        </div>
        <p className="mt-2 text-body-sm text-tertiary">
          {receta.ingredientes.length}
          {' '}
          {receta.ingredientes.length === 1 ? 'ingrediente' : 'ingredientes'}
        </p>
      </div>
    </div>
  );
}
