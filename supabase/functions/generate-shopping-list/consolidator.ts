// Ingredient consolidation — api-contracts.md §2a: "pre-model, deterministic,
// no LLM involved". This is pure application logic (FR-4.1), not prompt-
// engineering, so unlike prompt.ts it is implemented for real here, not
// deferred as a TODO.
//
// Doesn't touch `recipes`' JSONB vs. typed-relational question at all — it
// only consumes plain ingredient-name strings.

import type { IngredienteConsolidado, RawIngrediente } from './types.ts'
import { logger } from '../_shared/logger.ts'

// Base quantity/unit per normalized ingredient name, scaled by
// (raciones_usuario / raciones_receta). Realistic estimates for Spanish home
// cooking.
const BASE_QUANTITIES: Record<string, { cantidad: number; unidad: string }> = {
  cebolla: { cantidad: 1, unidad: 'unidades' },
  ajo: { cantidad: 3, unidad: 'dientes' },
  tomate: { cantidad: 300, unidad: 'g' },
  'pimiento rojo': { cantidad: 1, unidad: 'unidades' },
  'pimiento verde': { cantidad: 1, unidad: 'unidades' },
  zanahoria: { cantidad: 2, unidad: 'unidades' },
  patata: { cantidad: 400, unidad: 'g' },
  calabacin: { cantidad: 1, unidad: 'unidades' },
  berenjena: { cantidad: 1, unidad: 'unidades' },
  espinacas: { cantidad: 200, unidad: 'g' },
  lechuga: { cantidad: 1, unidad: 'unidades' },
  'tomate cherry': { cantidad: 200, unidad: 'g' },
  cebolleta: { cantidad: 2, unidad: 'unidades' },

  'pechuga de pollo': { cantidad: 600, unidad: 'g' },
  'muslo de pollo': { cantidad: 600, unidad: 'g' },
  'ternera picada': { cantidad: 400, unidad: 'g' },
  'lomo de cerdo': { cantidad: 500, unidad: 'g' },
  chorizo: { cantidad: 150, unidad: 'g' },
  bacon: { cantidad: 100, unidad: 'g' },
  salmon: { cantidad: 400, unidad: 'g' },
  merluza: { cantidad: 400, unidad: 'g' },
  gambas: { cantidad: 300, unidad: 'g' },
  'atun en lata': { cantidad: 2, unidad: 'latas' },
  huevo: { cantidad: 4, unidad: 'unidades' },

  leche: { cantidad: 500, unidad: 'ml' },
  'nata liquida': { cantidad: 200, unidad: 'ml' },
  'queso rallado': { cantidad: 100, unidad: 'g' },
  'queso fresco': { cantidad: 150, unidad: 'g' },
  mantequilla: { cantidad: 50, unidad: 'g' },
  yogur: { cantidad: 2, unidad: 'unidades' },

  pasta: { cantidad: 300, unidad: 'g' },
  arroz: { cantidad: 250, unidad: 'g' },
  lentejas: { cantidad: 300, unidad: 'g' },
  garbanzos: { cantidad: 400, unidad: 'g' },
  alubias: { cantidad: 300, unidad: 'g' },

  'tomate frito': { cantidad: 1, unidad: 'botes' },
  'tomate triturado': { cantidad: 400, unidad: 'g' },
  'caldo de pollo': { cantidad: 500, unidad: 'ml' },
  'caldo de verduras': { cantidad: 500, unidad: 'ml' },

  'aceite de oliva': { cantidad: 50, unidad: 'ml' },
  sal: { cantidad: 5, unidad: 'g' },
  'pimienta negra': { cantidad: 2, unidad: 'g' },
  pimenton: { cantidad: 3, unidad: 'g' },
  comino: { cantidad: 2, unidad: 'g' },
  oregano: { cantidad: 2, unidad: 'g' },

  pan: { cantidad: 4, unidad: 'rebanadas' },
  'pan rallado': { cantidad: 50, unidad: 'g' },
}

function normalizeNombre(nombre: string): string {
  return nombre
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[áàä]/g, 'a')
    .replace(/[éèë]/g, 'e')
    .replace(/[íìï]/g, 'i')
    .replace(/[óòö]/g, 'o')
    .replace(/[úùü]/g, 'u')
    .replace(/ñ/g, 'n')
}

function canSumUnits(u1: string, u2: string): boolean {
  const grupos = [
    ['g', 'kg'],
    ['ml', 'l'],
    ['unidades'],
    ['latas'],
    ['botes'],
    ['rebanadas'],
    ['dientes'],
    ['cucharadas'],
  ]
  return grupos.some(g => g.includes(u1) && g.includes(u2))
}

function toBaseUnit(cantidad: number, unidad: string): { cantidad: number; unidad: string } {
  if (unidad === 'kg') return { cantidad: cantidad * 1000, unidad: 'g' }
  if (unidad === 'l') return { cantidad: cantidad * 1000, unidad: 'ml' }
  return { cantidad, unidad }
}

function fromBaseUnit(cantidad: number, unidad: string): { cantidad: number; unidad: string } {
  if (unidad === 'g' && cantidad >= 1000) return { cantidad: cantidad / 1000, unidad: 'kg' }
  if (unidad === 'ml' && cantidad >= 1000) return { cantidad: cantidad / 1000, unidad: 'l' }
  return { cantidad: Math.round(cantidad * 10) / 10, unidad }
}

/**
 * Sums and deduplicates raw per-recipe ingredients into a shopping-ready
 * list, scaled by household size. This is the *only* place quantities are
 * computed — the model (prompt.ts) never estimates or invents them.
 */
export function consolidateIngredientes(
  rawIngredientes: RawIngrediente[]
): IngredienteConsolidado[] {
  const map = new Map<string, { cantidad: number; unidad: string }>()

  for (const raw of rawIngredientes) {
    const key = normalizeNombre(raw.nombre)
    const base = BASE_QUANTITIES[key]
    const factor = raw.raciones_usuario / raw.raciones_receta

    const cantidadBase = base?.cantidad ?? 1
    const unidadBase = base?.unidad ?? 'unidades'
    const { cantidad: cantBase, unidad: unitBase } = toBaseUnit(
      Math.ceil(cantidadBase * factor),
      unidadBase
    )

    if (map.has(key)) {
      const existing = map.get(key)!
      const { cantidad: existBase, unidad: existUnit } = toBaseUnit(existing.cantidad, existing.unidad)

      if (canSumUnits(existUnit, unitBase)) {
        const { cantidad: total, unidad: totalUnit } = fromBaseUnit(existBase + cantBase, existUnit)
        map.set(key, { cantidad: total, unidad: totalUnit })
      } else {
        logger.warn('Unidades incompatibles', { fn: 'generate-shopping-list', ingrediente: key, existUnit, unitBase })
      }
    } else {
      const { cantidad, unidad } = fromBaseUnit(cantBase, unitBase)
      map.set(key, { cantidad, unidad })
    }
  }

  return Array.from(map.entries()).map(([nombre, { cantidad, unidad }]) => ({
    nombre,
    cantidad,
    unidad,
  }))
}
