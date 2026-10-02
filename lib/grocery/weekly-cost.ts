import type { PerfilCompra } from './product-compatibility';
import type { MenuGrid } from '@/lib/calendar/apply-slot-swap';
import { estimateMenuCost } from './estimate-menu-cost';

/** Household size assumed when the profile has none — same default both screens used before they shared this helper. */
const NUM_PERSONAS_POR_DEFECTO = 2;

/**
 * FRESCO-792 — the ONE weekly cost figure. `/menu` ("Gasto semanal estimado")
 * and the shopping list summary both call this with the same plan, so the two
 * screens cannot show different numbers for the same week. FRESCO-826: the
 * shopper's `perfil` is part of that shared input, because a product hidden as
 * incompatible on one screen must not stay priced on the other. Fails soft:
 * `undefined` on any error, so each caller hides or falls back instead of
 * crashing the page.
 */
export function costeSemanalEstimado(
  menu: MenuGrid,
  { numPersonas, perfil }: { numPersonas?: number | null, perfil?: PerfilCompra },
): number | undefined {
  try {
    return estimateMenuCost(menu, { numPersonas: numPersonas ?? NUM_PERSONAS_POR_DEFECTO, perfil });
  }
  catch (error) {
    console.error('[weekly-cost] estimateMenuCost failed', error);
    return undefined;
  }
}
