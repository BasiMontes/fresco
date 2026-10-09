// FRESCO-875 / ADR-0042: reads `recipes.ingredientes_cantidades` (quantity per
// recipe as written for `meta.raciones` servings) into a lookup the shopping
// list can use instead of the generic BASE_QUANTITIES table.

import { normalizeNombre } from '../_shared/normalize.ts'

export interface CantidadReceta {
  cantidad: number
  unidad: string
}

/**
 * Index of a recipe's quantities by normalized ingredient name. The column is
 * jsonb, so anything can be in it: an entry that is not a positive finite
 * quantity with a unit is dropped, never thrown on. The shopping list then
 * falls back to BASE_QUANTITIES for that ingredient.
 */
export function indexCantidades(raw: unknown): Map<string, CantidadReceta> {
  const index = new Map<string, CantidadReceta>()
  if (!Array.isArray(raw)) return index

  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null) continue
    const { nombre, cantidad, unidad } = entry as Record<string, unknown>
    if (typeof nombre !== 'string' || typeof unidad !== 'string') continue
    if (typeof cantidad !== 'number' || !Number.isFinite(cantidad) || cantidad <= 0) continue
    index.set(normalizeNombre(nombre), { cantidad, unidad })
  }
  return index
}
