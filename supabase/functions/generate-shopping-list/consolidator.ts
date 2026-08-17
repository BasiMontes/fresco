// Ingredient consolidation — api-contracts.md §2a: "pre-model, deterministic,
// no LLM involved". This is pure application logic (FR-4.1), not prompt-
// engineering, so unlike prompt.ts it is implemented for real here, not
// deferred as a TODO.
//
// Doesn't touch `recipes`' JSONB vs. typed-relational question at all — it
// only consumes plain ingredient-name strings.

import type { IngredienteConsolidado, RawIngrediente } from './types.ts'
import { logger } from '../_shared/logger.ts'
import { normalizeNombre } from '../_shared/normalize.ts'

// Base quantity/unit per normalized ingredient name, scaled by
// (raciones_usuario / raciones_receta). Realistic estimates for Spanish home
// cooking. Exported for `get-shopping-list-suggestions` — a suggested
// ingredient has no recipe/raciones context to scale from, so it uses this
// base amount unscaled (same one every recipe's *first* serving uses here).
export const BASE_QUANTITIES: Record<string, { cantidad: number; unidad: string }> = {
  // Frutas y verduras
  aceitunas: { cantidad: 50, unidad: 'g' },
  aguacate: { cantidad: 1, unidad: 'unidades' },
  'aji amarillo': { cantidad: 1, unidad: 'unidades' },
  ajo: { cantidad: 3, unidad: 'dientes' },
  albahaca: { cantidad: 10, unidad: 'g' },
  alcachofas: { cantidad: 4, unidad: 'unidades' },
  algas: { cantidad: 10, unidad: 'g' },
  apio: { cantidad: 2, unidad: 'unidades' },
  berenjena: { cantidad: 1, unidad: 'unidades' },
  boniato: { cantidad: 400, unidad: 'g' },
  brocoli: { cantidad: 300, unidad: 'g' },
  'brotes de soja': { cantidad: 100, unidad: 'g' },
  calabacin: { cantidad: 1, unidad: 'unidades' },
  calabaza: { cantidad: 400, unidad: 'g' },
  cebolla: { cantidad: 1, unidad: 'unidades' },
  cebolleta: { cantidad: 2, unidad: 'unidades' },
  champinones: { cantidad: 250, unidad: 'g' },
  cilantro: { cantidad: 10, unidad: 'g' },
  'coles de bruselas': { cantidad: 300, unidad: 'g' },
  coliflor: { cantidad: 500, unidad: 'g' },
  eneldo: { cantidad: 5, unidad: 'g' },
  esparragos: { cantidad: 200, unidad: 'g' },
  'esparragos trigueros': { cantidad: 200, unidad: 'g' },
  espinacas: { cantidad: 200, unidad: 'g' },
  fresas: { cantidad: 250, unidad: 'g' },
  'frutos rojos': { cantidad: 150, unidad: 'g' },
  guisantes: { cantidad: 200, unidad: 'g' },
  jengibre: { cantidad: 20, unidad: 'g' },
  'judias verdes': { cantidad: 250, unidad: 'g' },
  kale: { cantidad: 150, unidad: 'g' },
  lechuga: { cantidad: 1, unidad: 'unidades' },
  'lechuga romana': { cantidad: 1, unidad: 'unidades' },
  lima: { cantidad: 1, unidad: 'unidades' },
  limon: { cantidad: 1, unidad: 'unidades' },
  manzana: { cantidad: 2, unidad: 'unidades' },
  melon: { cantidad: 1, unidad: 'unidades' },
  menta: { cantidad: 5, unidad: 'g' },
  patata: { cantidad: 400, unidad: 'g' },
  pepino: { cantidad: 1, unidad: 'unidades' },
  pera: { cantidad: 2, unidad: 'unidades' },
  pimiento: { cantidad: 1, unidad: 'unidades' },
  'pimiento rojo': { cantidad: 1, unidad: 'unidades' },
  'pimiento verde': { cantidad: 1, unidad: 'unidades' },
  platano: { cantidad: 2, unidad: 'unidades' },
  portobello: { cantidad: 4, unidad: 'unidades' },
  puerro: { cantidad: 2, unidad: 'unidades' },
  repollo: { cantidad: 1, unidad: 'unidades' },
  rucula: { cantidad: 100, unidad: 'g' },
  setas: { cantidad: 250, unidad: 'g' },
  'setas shiitake': { cantidad: 200, unidad: 'g' },
  tomate: { cantidad: 300, unidad: 'g' },
  'tomate cherry': { cantidad: 200, unidad: 'g' },
  'tomates cherry': { cantidad: 200, unidad: 'g' },
  uvas: { cantidad: 200, unidad: 'g' },
  zanahoria: { cantidad: 2, unidad: 'unidades' },

  // Carnes y aves
  'carne picada': { cantidad: 400, unidad: 'g' },
  'carne picada de ternera': { cantidad: 400, unidad: 'g' },
  'carne picada mixta': { cantidad: 400, unidad: 'g' },
  'carrilleras de cerdo': { cantidad: 600, unidad: 'g' },
  codornices: { cantidad: 4, unidad: 'unidades' },
  conejo: { cantidad: 1000, unidad: 'g' },
  cordero: { cantidad: 600, unidad: 'g' },
  'costillas de cerdo': { cantidad: 600, unidad: 'g' },
  higado: { cantidad: 300, unidad: 'g' },
  'lomo de cerdo': { cantidad: 500, unidad: 'g' },
  'magro de cerdo': { cantidad: 500, unidad: 'g' },
  morcillo: { cantidad: 600, unidad: 'g' },
  'muslo de pollo': { cantidad: 600, unidad: 'g' },
  'muslos de pollo': { cantidad: 600, unidad: 'g' },
  pavo: { cantidad: 500, unidad: 'g' },
  'pechuga de pavo': { cantidad: 500, unidad: 'g' },
  'pechuga de pollo': { cantidad: 600, unidad: 'g' },
  pollo: { cantidad: 1000, unidad: 'g' },
  'pollo troceado': { cantidad: 1000, unidad: 'g' },
  'rabo de toro': { cantidad: 800, unidad: 'g' },
  'secreto iberico': { cantidad: 500, unidad: 'g' },
  ternera: { cantidad: 500, unidad: 'g' },
  'ternera para guisar': { cantidad: 500, unidad: 'g' },
  'ternera picada': { cantidad: 400, unidad: 'g' },

  // Pescados y mariscos
  atun: { cantidad: 400, unidad: 'g' },
  bacalao: { cantidad: 400, unidad: 'g' },
  'bacalao desalado': { cantidad: 400, unidad: 'g' },
  bonito: { cantidad: 400, unidad: 'g' },
  calamares: { cantidad: 400, unidad: 'g' },
  dorada: { cantidad: 2, unidad: 'unidades' },
  gambas: { cantidad: 300, unidad: 'g' },
  langostinos: { cantidad: 300, unidad: 'g' },
  mejillones: { cantidad: 500, unidad: 'g' },
  merluza: { cantidad: 400, unidad: 'g' },
  rape: { cantidad: 400, unidad: 'g' },
  salmon: { cantidad: 400, unidad: 'g' },
  'salmon ahumado': { cantidad: 150, unidad: 'g' },

  // Charcutería y embutidos
  chorizo: { cantidad: 150, unidad: 'g' },
  bacon: { cantidad: 100, unidad: 'g' },
  jamon: { cantidad: 100, unidad: 'g' },
  'jamon cocido': { cantidad: 100, unidad: 'g' },
  'jamon iberico': { cantidad: 100, unidad: 'g' },
  'jamon serrano': { cantidad: 100, unidad: 'g' },
  morcilla: { cantidad: 200, unidad: 'g' },
  panceta: { cantidad: 150, unidad: 'g' },
  tocino: { cantidad: 100, unidad: 'g' },

  // Lácteos y huevos
  'clara de huevo': { cantidad: 4, unidad: 'unidades' },
  huevo: { cantidad: 4, unidad: 'unidades' },
  leche: { cantidad: 500, unidad: 'ml' },
  'leche de almendra': { cantidad: 500, unidad: 'ml' },
  'leche de coco': { cantidad: 400, unidad: 'ml' },
  mantequilla: { cantidad: 50, unidad: 'g' },
  nata: { cantidad: 200, unidad: 'ml' },
  'nata liquida': { cantidad: 200, unidad: 'ml' },
  parmesano: { cantidad: 80, unidad: 'g' },
  queso: { cantidad: 200, unidad: 'g' },
  'queso crema': { cantidad: 150, unidad: 'g' },
  'queso feta': { cantidad: 150, unidad: 'g' },
  'queso fresco': { cantidad: 150, unidad: 'g' },
  'queso mozzarella': { cantidad: 125, unidad: 'g' },
  'queso parmesano': { cantidad: 80, unidad: 'g' },
  'queso rallado': { cantidad: 100, unidad: 'g' },
  skyr: { cantidad: 2, unidad: 'unidades' },
  yogur: { cantidad: 2, unidad: 'unidades' },
  'yogur griego': { cantidad: 2, unidad: 'unidades' },
  'yogur natural': { cantidad: 2, unidad: 'unidades' },

  // Pan y bollería
  gofres: { cantidad: 4, unidad: 'unidades' },
  pan: { cantidad: 4, unidad: 'rebanadas' },
  'pan de centeno': { cantidad: 4, unidad: 'rebanadas' },
  'pan integral': { cantidad: 4, unidad: 'rebanadas' },
  'pan rallado': { cantidad: 50, unidad: 'g' },
  picatostes: { cantidad: 50, unidad: 'g' },
  'tortilla de maiz': { cantidad: 4, unidad: 'unidades' },
  'tortilla de trigo': { cantidad: 4, unidad: 'unidades' },
  tortitas: { cantidad: 6, unidad: 'unidades' },

  // Pasta/arroz/legumbres (dry pantry: also nuts, seeds, grains, plant proteins)
  almendras: { cantidad: 50, unidad: 'g' },
  alubias: { cantidad: 300, unidad: 'g' },
  'alubias blancas': { cantidad: 300, unidad: 'g' },
  'alubias negras': { cantidad: 300, unidad: 'g' },
  'alubias rojas': { cantidad: 300, unidad: 'g' },
  arroz: { cantidad: 250, unidad: 'g' },
  'arroz redondo': { cantidad: 250, unidad: 'g' },
  avena: { cantidad: 80, unidad: 'g' },
  cacahuetes: { cantidad: 50, unidad: 'g' },
  'coco rallado': { cantidad: 30, unidad: 'g' },
  edamame: { cantidad: 200, unidad: 'g' },
  espaguetis: { cantidad: 300, unidad: 'g' },
  fabes: { cantidad: 300, unidad: 'g' },
  fideos: { cantidad: 250, unidad: 'g' },
  'fideos de arroz': { cantidad: 250, unidad: 'g' },
  'fideos para fideua': { cantidad: 250, unidad: 'g' },
  frijoles: { cantidad: 300, unidad: 'g' },
  'frijoles pintos': { cantidad: 300, unidad: 'g' },
  'frutos secos': { cantidad: 50, unidad: 'g' },
  garbanzos: { cantidad: 400, unidad: 'g' },
  'garbanzos cocidos': { cantidad: 400, unidad: 'g' },
  granola: { cantidad: 60, unidad: 'g' },
  'harina de trigo': { cantidad: 200, unidad: 'g' },
  judiones: { cantidad: 300, unidad: 'g' },
  lentejas: { cantidad: 300, unidad: 'g' },
  'lentejas pardinas': { cantidad: 300, unidad: 'g' },
  nueces: { cantidad: 50, unidad: 'g' },
  pasta: { cantidad: 300, unidad: 'g' },
  pochas: { cantidad: 300, unidad: 'g' },
  quinoa: { cantidad: 200, unidad: 'g' },
  seitan: { cantidad: 200, unidad: 'g' },
  'semillas de calabaza': { cantidad: 20, unidad: 'g' },
  'semillas de chia': { cantidad: 20, unidad: 'g' },
  'semillas de girasol': { cantidad: 20, unidad: 'g' },
  'semillas de lino': { cantidad: 20, unidad: 'g' },
  tempeh: { cantidad: 200, unidad: 'g' },
  tofu: { cantidad: 200, unidad: 'g' },

  // Conservas y salsas
  anchoas: { cantidad: 50, unidad: 'g' },
  'atun en lata': { cantidad: 2, unidad: 'latas' },
  caldo: { cantidad: 500, unidad: 'ml' },
  'caldo de carne': { cantidad: 500, unidad: 'ml' },
  'caldo de pollo': { cantidad: 500, unidad: 'ml' },
  'caldo de verduras': { cantidad: 500, unidad: 'ml' },
  hummus: { cantidad: 200, unidad: 'g' },
  'maiz blanco': { cantidad: 150, unidad: 'g' },
  miso: { cantidad: 30, unidad: 'g' },
  'tomate frito': { cantidad: 1, unidad: 'botes' },
  'tomate triturado': { cantidad: 400, unidad: 'g' },

  // Aceites/vinagres/condimentos
  'aceite de oliva': { cantidad: 50, unidad: 'ml' },
  azafran: { cantidad: 1, unidad: 'g' },
  canela: { cantidad: 3, unidad: 'g' },
  comino: { cantidad: 2, unidad: 'g' },
  laurel: { cantidad: 2, unidad: 'unidades' },
  'levadura nutricional': { cantidad: 15, unidad: 'g' },
  miel: { cantidad: 30, unidad: 'g' },
  oregano: { cantidad: 2, unidad: 'g' },
  pimenton: { cantidad: 3, unidad: 'g' },
  'pimenton dulce': { cantidad: 3, unidad: 'g' },
  'pimenton picante': { cantidad: 3, unidad: 'g' },
  'pimienta negra': { cantidad: 2, unidad: 'g' },
  romero: { cantidad: 3, unidad: 'g' },
  sal: { cantidad: 5, unidad: 'g' },
  'salsa de soja': { cantidad: 30, unidad: 'ml' },
  sesamo: { cantidad: 10, unidad: 'g' },
  tahini: { cantidad: 30, unidad: 'g' },
  tamari: { cantidad: 30, unidad: 'ml' },
  tomillo: { cantidad: 3, unidad: 'g' },

  // Bebidas
  'vino blanco': { cantidad: 200, unidad: 'ml' },
  'vino tinto': { cantidad: 200, unidad: 'ml' },
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
  // FRESCO-212: every distinct (recipe, day) an ingredient was pulled from,
  // tracked independently of quantity summing — a staple is still "used in"
  // a recipe even on the rare path where a unit mismatch skips its quantity
  // contribution (the `canSumUnits` else-branch below).
  const usosMap = new Map<string, { receta: string; dia: string }[]>()

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

    const usos = usosMap.get(key) ?? []
    if (!usos.some(u => u.receta === raw.receta_nombre && u.dia === raw.dia)) {
      usos.push({ receta: raw.receta_nombre, dia: raw.dia })
    }
    usosMap.set(key, usos)

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
    usos: usosMap.get(nombre) ?? [],
  }))
}
