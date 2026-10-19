// FRESCO-1010 (A7-LOGIC-07) — the slots of a plan, flattened into the per-recipe ingredient rows the
// consolidator sums. It used to live inline in `index.ts`; generating a list and refreshing a stale one
// both need it, so it is one pure function with one set of rules.

import { normalizeNombre } from '../_shared/normalize.ts'
import { indexCantidades } from './recipe-quantities.ts'
import { filtrarDiasVigentes } from './remaining-days.ts'
import type { RawIngrediente, SlotWithRecipeRow } from './types.ts'

/** States whose recipe the household is NOT going to cook: they add nothing to the shopping list. */
const ESTADOS_SIN_COMPRA = new Set(['descartada', 'excluida'])

interface RawIngredientesInput {
  slots: readonly SlotWithRecipeRow[]
  /** Monday of the plan's week, `YYYY-MM-DD`. */
  fechaInicio: string
  /** Today in Madrid, `YYYY-MM-DD`. */
  hoy: string
  numPersonas: number
}

/**
 * Rules, in order:
 *  - a slot the household discarded or that was excluded buys nothing (FRESCO-1010);
 *  - days already behind us are skipped (FRESCO-807), unless nothing would remain;
 *  - a confirmed per-slot substitution swaps the ingredient NAME before consolidation (FRESCO-716/ADR-0033),
 *    and the substitute inherits the quantity of the ingredient it replaces (FRESCO-875/ADR-0042).
 */
export function buildRawIngredientes({ slots, fechaInicio, hoy, numPersonas }: RawIngredientesInput): RawIngrediente[] {
  const conCompra = slots.filter(slot => !(slot.estado && ESTADOS_SIN_COMPRA.has(slot.estado)))
  const vigentes = filtrarDiasVigentes({ slots: conCompra, fechaInicio, hoy })
  const rawIngredientes: RawIngrediente[] = []

  for (const slot of vigentes) {
    const recipe = slot.recipes
    if (!recipe) continue

    const racionesReceta = recipe.meta?.raciones ?? 4
    const ingredientes = recipe.ingredientes_principales ?? []
    const cantidades = indexCantidades(recipe.ingredientes_cantidades)
    const sustitucion = slot.sustitucion_ingrediente

    for (const ingrediente of ingredientes) {
      const nombre = sustitucion && sustitucion.original.toLowerCase() === ingrediente.toLowerCase()
        ? sustitucion.sustituto
        : ingrediente
      const cantidadReceta = cantidades.get(normalizeNombre(ingrediente))

      rawIngredientes.push({
        nombre,
        receta_id: recipe.id,
        raciones_receta: racionesReceta,
        raciones_usuario: numPersonas,
        cantidad: cantidadReceta?.cantidad,
        unidad: cantidadReceta?.unidad,
        receta_nombre: recipe.nombre,
        dia: slot.dia,
      })
    }
  }

  return rawIngredientes
}
