import type { ClassValue } from 'clsx';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind class names, resolving conflicting utility classes
 * (e.g. `p-2` + `p-4` -> `p-4`) the way `tailwind-merge` intends.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * FRESCO-340 — extracted from `shopping-list-view.tsx` (its sole owner until
 * now) once `savings-estimate-cards.tsx` became a second consumer: AGENTS.md
 * §10's "move to shared only when ≥2 features import AND the abstraction is
 * stable" bar is met — this formatting has shipped unchanged since
 * FRESCO-180. Matches the app's existing static-copy convention
 * (`recipe-card.tsx`: "2,80€/persona") — comma decimal, no space before the
 * symbol.
 */
export function formatPrecio(precio: number): string {
  return `${precio.toFixed(2).replace('.', ',')}€`;
}

/**
 * FRESCO-733 (A5-H3) — extracted from 4 identical copies (`recipe-library.tsx`,
 * `shopping-list-view.tsx`, `receipt-ticket.tsx`, `export-shopping-list.ts`),
 * same "≥2 features import + stable abstraction" bar as `formatPrecio` above.
 */
export function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * FRESCO-733 (A5-H3) — extracted from 3 identical copies
 * (`shopping-list-view.tsx`, `receipt-ticket.tsx`, `export-shopping-list.ts`).
 *
 * FRESCO-180 — `unidad` is free text from the shopping-list Edge Function
 * (Gemini classification, `lib/api/types.ts`'s `unidad: string`), not a
 * fixed union, so this only singularizes the one unit the QA sweep actually
 * found broken ("1 unidades") rather than guessing a general Spanish
 * pluralization rule for units we have no confirmed data on.
 */
export function formatUnidad(cantidad: number, unidad: string): string {
  return cantidad === 1 && unidad === 'unidades' ? 'unidad' : unidad;
}
