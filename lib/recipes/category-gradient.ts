import type { CategoriaReceta } from '@schemas';

/**
 * FRESCO-441 — the "no photo" state of a recipe card is a designed
 * placeholder, not a lone line-icon on beige. Each meal category maps to a
 * subtle two-stop gradient drawn ENTIRELY from the warm `neutral-*` ramp
 * (`app/globals.css` `--color-neutral-100..900`). Monochrome by design:
 * one-accent discipline (FRESCO-440) reserves colour for the single CTA per
 * screen, so a grid of placeholders must stay neutral — the gentle
 * per-category variation is for recognisability, not decoration.
 *
 * Deliberately a plain data module (no `'use client'`, no JSX) so both
 * server and client components can import it — same split rationale as
 * `lib/recipes/labels.ts`.
 */
interface GradientStops {
  from: string
  to: string
}

const CATEGORY_GRADIENTS: Record<CategoriaReceta, GradientStops> = {
  pasta: { from: 'var(--color-neutral-200)', to: 'var(--color-neutral-100)' },
  arroz: { from: 'var(--color-neutral-100)', to: 'var(--color-neutral-300)' },
  legumbres: { from: 'var(--color-neutral-300)', to: 'var(--color-neutral-200)' },
  carne: { from: 'var(--color-neutral-400)', to: 'var(--color-neutral-200)' },
  pescado: { from: 'var(--color-neutral-200)', to: 'var(--color-neutral-400)' },
  verdura: { from: 'var(--color-neutral-300)', to: 'var(--color-neutral-100)' },
  huevos: { from: 'var(--color-neutral-100)', to: 'var(--color-neutral-200)' },
  sopa: { from: 'var(--color-neutral-200)', to: 'var(--color-neutral-300)' },
  ensalada: { from: 'var(--color-neutral-100)', to: 'var(--color-neutral-400)' },
  sandwich: { from: 'var(--color-neutral-300)', to: 'var(--color-neutral-400)' },
  pizza: { from: 'var(--color-neutral-400)', to: 'var(--color-neutral-300)' },
  guiso: { from: 'var(--color-neutral-400)', to: 'var(--color-neutral-500)' },
  bowls: { from: 'var(--color-neutral-200)', to: 'var(--color-neutral-300)' },
  batidos: { from: 'var(--color-neutral-100)', to: 'var(--color-neutral-300)' },
  reposteria: { from: 'var(--color-neutral-300)', to: 'var(--color-neutral-100)' },
  tostadas: { from: 'var(--color-neutral-200)', to: 'var(--color-neutral-400)' },
  lacteos: { from: 'var(--color-neutral-100)', to: 'var(--color-neutral-200)' },
  wrap: { from: 'var(--color-neutral-300)', to: 'var(--color-neutral-200)' },
};

/** Every category of the contract, in the order of the table above. The database check and the tests are compared against it. */
export const RECIPE_CATEGORIES = Object.keys(CATEGORY_GRADIENTS) as CategoriaReceta[];

// Looked up by plain string: `clasificacion.categoria` is typed `string` at the zod
// boundary (FRESCO-820), and a category the table does not know falls back to the
// default gradient. FRESCO-861 closed the gap: the database now only accepts the
// categories of `CategoriaReceta`.
const GRADIENTS_BY_CATEGORY: ReadonlyMap<string, GradientStops> = new Map(Object.entries(CATEGORY_GRADIENTS));

const DEFAULT_GRADIENT: GradientStops = {
  from: 'var(--color-neutral-200)',
  to: 'var(--color-neutral-100)',
};

/**
 * A ready-to-use CSS `linear-gradient(...)` value for the given category.
 * Falls back to a neutral light gradient for `null`/unrecognized input
 * (mirrors `getCategoryIcon`'s `ChefHat` fallback).
 */
export function categoryGradient(categoria: string | null | undefined): string {
  const stops = (categoria && GRADIENTS_BY_CATEGORY.get(categoria)) || DEFAULT_GRADIENT;
  return `linear-gradient(145deg, ${stops.from}, ${stops.to})`;
}
