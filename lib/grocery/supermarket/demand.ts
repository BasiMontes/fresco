import { normalizeNombre } from '@/lib/text/normalize-nombre';

/**
 * FRESCO-770 — how much each product is needed, the `demanda` that
 * `planificarRefresco` orders its work by. Pure: the runner reads the plans
 * and the matches from the database and hands them in.
 */

/** One active menu slot: the ingredients its recipe needs, as stored on `recipes`. */
export interface HuecoDeMenu {
  ingredientes: readonly string[]
}

/** One row of `ingredient_product_match`. */
export interface CoincidenciaProducto {
  ingrediente: string
  productoId: number
}

/**
 * Menu slots that need each ingredient, keyed by normalized name. An ingredient
 * counts once per slot, however many times its recipe lists it.
 */
export function contarDemanda(huecos: readonly HuecoDeMenu[]): Map<string, number> {
  const demanda = new Map<string, number>();
  for (const hueco of huecos) {
    const claves = new Set(hueco.ingredientes.map(normalizeNombre).filter(c => c !== ''));
    for (const clave of claves) {
      demanda.set(clave, (demanda.get(clave) ?? 0) + 1);
    }
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
