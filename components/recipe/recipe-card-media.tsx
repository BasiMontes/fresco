import type { CategoriaReceta } from '@schemas';
import type * as React from 'react';

import Image from 'next/image';
import { RecipePlaceholder } from '@/components/recipe/recipe-placeholder';
import { cn } from '@/lib/utils';

/**
 * FRESCO-441 — the single shared media area for every recipe card, so
 * `/menu`, `/calendar` and `/recipes` render the same photo-forward
 * anatomy. Owns the photo-vs-placeholder decision and nothing else:
 *
 * - Real photo (`fotoUrl` set) → `next/image` `fill` + `object-cover`, with
 *   the shared `.recipe-photo` grade (FRESCO-447) so photos from many
 *   sources read as one brand.
 * - No photo → `<RecipePlaceholder>` (category gradient + typographic
 *   initial), never a bare icon. The grade is NOT applied here — the
 *   placeholder is a designed per-category gradient.
 *
 * "Sin marco": no border, no `bg-neutral-200` box — just the image or the
 * designed placeholder. The media is full-bleed at the top of the card, so
 * it rounds its own top corners to the card radius (`rounded-t-card`) — the
 * card root is NOT `overflow-hidden` (that would clip the favourite
 * button's like-particle burst, FRESCO-248). A consumer that needs
 * different rounding overrides it through `className`.
 *
 * `overlay` is an absolutely-positioned slot for controls that sit ON the
 * photo — the favourite heart (`RecipeCard`) or the drag handle
 * (`calendar-grid`'s `SlotCell`). The caller positions its own node
 * (`absolute right-2 top-2` etc.); this component only provides the
 * positioned context.
 */
export interface RecipeCardMediaProps {
  fotoUrl: string | null | undefined
  nombre: string
  categoria: CategoriaReceta | null | undefined
  priority?: boolean
  sizes?: string
  overlay?: React.ReactNode
  className?: string
}

const DEFAULT_SIZES = '(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw';

export function RecipeCardMedia({
  fotoUrl,
  nombre,
  categoria,
  priority,
  sizes,
  overlay,
  className,
}: RecipeCardMediaProps) {
  return (
    <div className={cn('relative aspect-[4/3] w-full overflow-hidden rounded-t-card', className)}>
      {fotoUrl
        ? (
            <Image
              src={fotoUrl}
              alt={nombre}
              fill
              sizes={sizes ?? DEFAULT_SIZES}
              priority={priority}
              className="recipe-photo object-cover"
            />
          )
        : (
            <RecipePlaceholder name={nombre} categoria={categoria} />
          )}
      {overlay}
    </div>
  );
}
