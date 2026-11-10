import type { PerfilCompra } from './product-compatibility';
import type { MenuGrid } from '@/lib/calendar/apply-slot-swap';
import { estimateMenuCost } from './estimate-menu-cost';

/** Household size assumed when the profile has none — same default both screens used before they shared this helper. */
const NUM_PERSONAS_POR_DEFECTO = 2;

/**
 * FRESCO-792 — the weekly cost of the WHOLE menu, shown on `/menu` ("Gasto
 * semanal estimado"). FRESCO-1172: the shopping list no longer shares this
 * figure; its total is the sum of its priced rows (FRESCO-1099) and is labelled
 * "Total de los artículos con precio". FRESCO-826: the shopper's `perfil` is
 * part of the input, because a product hidden as incompatible must not stay
 * priced here. Fails soft: `undefined` on any error, so the caller hides the
 * tile instead of crashing the page.
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
