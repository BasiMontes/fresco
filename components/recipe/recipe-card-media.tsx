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
 * - Real photo (`fotoUrl` set) → `next/image` `fill` + `object-cover`.
 * - No photo → `<RecipePlaceholder>` (category gradient + typographic
 *   initial), never a bare icon.
 *
 * "Sin marco": no border, no `bg-neutral-200` box — just the image or the
 * designed placeholder. The media is full-bleed at the top of the card; the
 * card shell owns the radius (`rounded-card`) and clips this via
 * `overflow-hidden`, so the visible top corners follow the card. A consumer
 * that needs its own rounding passes it through `className`.
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
    <div className={cn('relative aspect-[4/3] w-full overflow-hidden', className)}>
      {fotoUrl
        ? (
            <Image
              src={fotoUrl}
              alt={nombre}
              fill
              sizes={sizes ?? DEFAULT_SIZES}
              priority={priority}
              className="object-cover"
            />
          )
        : (
            <RecipePlaceholder name={nombre} categoria={categoria} />
          )}
      {overlay}
    </div>
  );
}
