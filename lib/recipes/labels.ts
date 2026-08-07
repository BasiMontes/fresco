import type { CosteEstimado, DificultadReceta, RecipeDieta } from '@schemas';

/**
 * Humanized labels for the enum/flag values the DB stores raw (snake_case,
 * `muy_bajo`, `sin_gluten`...) but the UI must show in readable Spanish.
 *
 * Deliberately NOT in `components/recipe/recipe-card.tsx` (a `'use client'`
 * file) despite that being their original home — FRESCO-117 found live that
 * a Server Component (`recipe-detail.tsx`'s `CatalogRecipeDetail`) importing
 * a plain data export from a `'use client'` module gets a client-reference
 * stub instead of the real object (`{}` at runtime, confirmed via a debug
 * dump), not a build error — so lookups into it silently render nothing.
 * This module has no `'use client'` directive, so both server and client
 * components can import it safely.
 */
export const DIETA_LABELS: Partial<Record<keyof RecipeDieta, string>> = {
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

export const COSTE_ESTIMADO_LABELS: Record<CosteEstimado, string> = {
  muy_bajo: 'muy bajo',
  bajo: 'bajo',
  medio: 'medio',
  alto: 'alto',
};

export const DIFICULTAD_LABELS: Record<DificultadReceta, string> = {
  muy_facil: 'muy fácil',
  facil: 'fácil',
  media: 'media',
  avanzada: 'avanzada',
};

/**
 * First active diet flag on `dieta`, as a display label, or `null` if
 * none/unknown.
 */
export function firstActiveDietaLabel(dieta: RecipeDieta | null): string | null {
  if (!dieta) { return null; }
  const active = (Object.keys(DIETA_LABELS) as (keyof RecipeDieta)[]).find(flag => dieta[flag]);
  return active ? (DIETA_LABELS[active] ?? null) : null;
}
