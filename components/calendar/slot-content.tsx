import type { Recipe } from '@schemas';
import type { DiaSemana, EstadoRecetaSlot, TipoPlato } from '@/lib/api/types';
import { Ban, UtensilsCrossed } from 'lucide-react';
import { Tag } from '@/components/ui/tag';
import { firstActiveDietaLabel } from '@/lib/recipes/labels';
import { cn } from '@/lib/utils';

interface SlotContentProps {
  dia: DiaSemana
  tipo: TipoPlato
  recipe: Recipe | null
  estado: EstadoRecetaSlot
}

/** Kicker, title and diet tag of a slot that has a recipe. */
function SlotRecipeText({ recipe, estado }: { recipe: Recipe, estado: EstadoRecetaSlot }) {
  const dietaLabel = firstActiveDietaLabel(recipe.dieta);

  return (
    <>
      <p className="text-h6 uppercase text-tertiary">{recipe.clasificacion?.categoria ?? '—'}</p>
      <h3 className={cn('line-clamp-2 text-h5', estado === 'descartada' && 'line-through')}>{recipe.nombre}</h3>
      {dietaLabel && (
        <div className="mt-1">
          <Tag variant="accent">{dietaLabel}</Tag>
        </div>
      )}
    </>
  );
}

/**
 * FRESCO-451: a bare italic line read as an unfinished slot, not a designed
 * empty state — a small icon (mirroring `EmptyState`'s icon-above-copy shape,
 * scaled down for this compact cell) gives it the same visual language.
 */
function SlotEmptyState({ dia, tipo, estado }: Omit<SlotContentProps, 'recipe'>) {
  const excluida = estado === 'excluida';
  const Icon = excluida ? Ban : UtensilsCrossed;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-1 text-center">
      <Icon className="size-5 text-tertiary" aria-hidden="true" />
      <p data-testid={`calendar_slot_${dia}_${tipo}_${excluida ? 'excluida' : 'sin_receta'}`} className="text-body-sm italic text-tertiary">
        {excluida ? 'Excluida por ti' : 'Sin receta'}
      </p>
    </div>
  );
}

export function SlotContent({ dia, tipo, recipe, estado }: SlotContentProps) {
  return recipe
    ? <SlotRecipeText recipe={recipe} estado={estado} />
    : <SlotEmptyState dia={dia} tipo={tipo} estado={estado} />;
}
