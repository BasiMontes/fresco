// FRESCO-1010 (A7-LOGIC-07) — "Actualizar lista": the list is rebuilt from the plan as it is now, and what
// the person already did on the old one is carried over. Pure, so the rules are testable.
//
//  - `comprado` is kept for an item that is still on the list under the same name and unit, as long as
//    what is needed is no more than what was already marked as bought. If the need grew (a second recipe
//    now uses it), the item comes back unchecked: the person still has to buy the difference.
//  - Items the person added from "Sugerencias para ti" (`origen: 'sugerencia'`) stay where they were. If
//    the plan now also contains that ingredient, the plan's line wins and inherits the bought mark.
//  - An item that is no longer needed disappears, bought or not.

import { normalizeNombre } from '../_shared/normalize.ts'
import { PASILLOS } from './aisle-pricing.ts'
import type { ShoppingListItem, ShoppingListPasillo } from '../../../api/schemas/shopping-list.types.ts'

const clave = (item: Pick<ShoppingListItem, 'nombre' | 'unidad'>) => `${normalizeNombre(item.nombre)}|${item.unidad}`
const soloNombre = (item: Pick<ShoppingListItem, 'nombre'>) => normalizeNombre(item.nombre)

function ordenDe(nombre: string, fallback: number): number {
  const idx = (PASILLOS as readonly string[]).indexOf(nombre)
  return idx >= 0 ? idx + 1 : fallback
}

export function mergeRefreshedList(
  anterior: readonly ShoppingListPasillo[],
  nueva: readonly ShoppingListPasillo[],
): ShoppingListPasillo[] {
  const previos = anterior.flatMap(pasillo => pasillo.items)
  const delPlanAntes = new Map(previos.filter(i => i.origen !== 'sugerencia').map(i => [clave(i), i]))
  const sugerenciasAntes = previos.filter(i => i.origen === 'sugerencia')
  const sugerenciaPorNombre = new Map(sugerenciasAntes.map(i => [soloNombre(i), i]))
  const nombresDelPlan = new Set(nueva.flatMap(p => p.items).map(soloNombre))

  const resultado = new Map<string, ShoppingListPasillo>()
  for (const pasillo of nueva) {
    const items = pasillo.items.map((item) => {
      const previo = delPlanAntes.get(clave(item)) ?? sugerenciaPorNombre.get(soloNombre(item))
      const sigueCubierto = previo?.comprado === true && item.cantidad <= previo.cantidad
      return { ...item, comprado: sigueCubierto }
    })
    resultado.set(pasillo.nombre, { ...pasillo, items })
  }

  // Suggestions the plan does not already cover go back to their aisle.
  for (const pasillo of anterior) {
    const propias = pasillo.items.filter(i => i.origen === 'sugerencia' && !nombresDelPlan.has(soloNombre(i)))
    if (propias.length === 0) continue
    const destino = resultado.get(pasillo.nombre)
      ?? { nombre: pasillo.nombre, orden: ordenDe(pasillo.nombre, pasillo.orden), items: [] }
    resultado.set(pasillo.nombre, { ...destino, items: [...destino.items, ...propias] })
  }

  return [...resultado.values()].sort((a, b) => a.orden - b.orden)
}

/** Cost band of a merged list, from the per-item estimates the lines carry (same ±15% as `classifyShoppingList`). */
export function costeDeLista(pasillos: readonly ShoppingListPasillo[], margen = 0.15): { min: number; max: number } {
  const total = pasillos.flatMap(p => p.items).reduce((suma, item) => suma + (item.precio_estimado ?? 0), 0)
  return {
    min: Math.round(total * (1 - margen) * 100) / 100,
    max: Math.round(total * (1 + margen) * 100) / 100,
  }
}
