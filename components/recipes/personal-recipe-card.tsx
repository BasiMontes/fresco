import type { RecetaPropia } from '@schemas';
import { NotebookPen } from 'lucide-react';
import { Tag } from '@/components/ui/tag';
import { cn } from '@/lib/utils';

/**
 * Card for a user-created personal recipe (FRESCO-68). Deliberately NOT
 * `RecipeCard` — a `RecetaPropia` has no photo/`clasificacion`/`dieta` to
 * show, and the "Tu receta" tag is what distinguishes it from the catalog
 * grid per the story's own Scope ("distinguibles de las del catálogo").
 */
export function PersonalRecipeCard({ receta, className }: { receta: RecetaPropia, className?: string }) {
  return (
    <div className={cn('rounded-card border border-border bg-surface-raised p-3 shadow-sm', className)}>
      <div className="mb-2 grid aspect-[4/3] w-full place-items-center overflow-hidden rounded-lg bg-neutral-200">
        <NotebookPen className="size-10 text-neutral-400" aria-hidden="true" />
      </div>
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
  );
}
