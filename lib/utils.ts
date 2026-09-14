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
