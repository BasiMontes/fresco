import type { CategoriaReceta } from '@schemas';

import { categoryGradient } from '@/lib/recipes/category-gradient';
import { cn } from '@/lib/utils';

/**
 * FRESCO-441 — the designed "no photo" state for a recipe card. A subtle
 * monochrome gradient keyed to the meal category (`categoryGradient`) plus
 * the recipe's initial in the Fraunces display face. Replaces the old lone
 * line-icon on beige, so a grid mixing cards with and without photos reads
 * coherent instead of broken. Purely decorative — `aria-hidden`, the card's
 * heading carries the recipe name for assistive tech.
 *
 * No `'use client'` — pure render, safe from both server and client
 * components. Callers: `RecipeCardMedia` (all card surfaces) and the
 * `/recipes/[id]` detail media area (FRESCO-447).
 */
function initialFrom(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    return '·';
  }
  // `Array.from` splits by code point, so a leading accented letter or
  // emoji yields one grapheme rather than a broken surrogate half.
  return (Array.from(trimmed)[0] ?? '·').toUpperCase();
}

export interface RecipePlaceholderProps {
  name: string
  categoria: CategoriaReceta | null | undefined
  className?: string
  /**
   * FRESCO-451: a fixed `text-5xl` glyph read fine on a ~240px card but
   * looked like a broken image floating in the much larger `/recipes/[id]`
   * hero media area — same small mark, way more empty gradient around it.
   * `hero` scales the glyph up and darkens it for legibility at that size.
   */
  size?: 'card' | 'hero'
}

export function RecipePlaceholder({ name, categoria, className, size = 'card' }: RecipePlaceholderProps) {
  return (
    <div
      className={cn('grid size-full place-items-center', className)}
      style={{ backgroundImage: categoryGradient(categoria) }}
      aria-hidden="true"
      data-testid="recipe_placeholder"
    >
      <span
        className={cn(
          'select-none font-heading font-light',
          size === 'hero' ? 'text-8xl text-neutral-600' : 'text-5xl text-neutral-500',
        )}
      >
        {initialFrom(name)}
      </span>
    </div>
  );
}
