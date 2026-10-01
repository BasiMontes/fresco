import { normalizeNombre } from '@/lib/text/normalize-nombre';

/**
 * FRESCO-770 — how much each product is needed, the `demanda` that
 * `planificarRefresco` orders its work by. Pure: the runner reads the counts
 * (`get_supermarket_demand`) and the matches from the database and hands them in.
 */

/** One row of `get_supermarket_demand`: an ingredient as a recipe spells it, and the menu slots that need it. */
export interface FilaDemanda {
  ingrediente: string
  huecos: number
}

/** One row of `ingredient_product_match`. */
export interface CoincidenciaProducto {
  ingrediente: string
  productoId: number
}

/**
 * Menu slots that need each ingredient, keyed by normalized name. The database
 * counts raw spellings ("Ajo", "ajo "), so rows that normalize to the same name
 * are summed. A blank name or a count that is not positive is dropped.
 */
export function sumarDemanda(filas: readonly FilaDemanda[]): Map<string, number> {
  const demanda = new Map<string, number>();
  for (const { ingrediente, huecos } of filas) {
    const clave = normalizeNombre(ingrediente);
    if (clave === '' || !(huecos > 0)) {
      continue;
    }
    demanda.set(clave, (demanda.get(clave) ?? 0) + huecos);
  }
  return demanda;
}

/**
 * Demand per product: the sum of the demand of every ingredient it is matched
 * to. A product nobody needs gets no entry (the plan skips it).
 */
export function demandaPorProducto(
  coincidencias: readonly CoincidenciaProducto[],
  demandaPorIngrediente: ReadonlyMap<string, number>,
): Map<number, number> {
  const demanda = new Map<number, number>();
  for (const { ingrediente, productoId } of coincidencias) {
    const necesaria = demandaPorIngrediente.get(normalizeNombre(ingrediente)) ?? 0;
    if (necesaria > 0) {
      demanda.set(productoId, (demanda.get(productoId) ?? 0) + necesaria);
    }
  }
  return demanda;
}
