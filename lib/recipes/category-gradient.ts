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
};

const DEFAULT_GRADIENT: GradientStops = {
  from: 'var(--color-neutral-200)',
  to: 'var(--color-neutral-100)',
};

/**
 * A ready-to-use CSS `linear-gradient(...)` value for the given category.
 * Falls back to a neutral light gradient for `null`/unrecognized input
 * (mirrors `getCategoryIcon`'s `ChefHat` fallback).
 */
export function categoryGradient(categoria: CategoriaReceta | null | undefined): string {
  const stops = (categoria && CATEGORY_GRADIENTS[categoria]) || DEFAULT_GRADIENT;
  return `linear-gradient(145deg, ${stops.from}, ${stops.to})`;
}
