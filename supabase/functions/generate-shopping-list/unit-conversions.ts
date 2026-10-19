// FRESCO-1009 (audit 7b A7-LOGIC-01, A7-LOGIC-02) — what one piece or one spoon of an ingredient
// weighs. One table, two readers: the consolidator brings every line of an ingredient to ONE unit
// before summing (so "Tomate 400 g" and "Tomate 2 unidades" are one line), and the pricing turns a
// line into the unit its price is written in (so "Yogur 500 g" is 4 yogures, not 500 yogures).
//
// The figures are kitchen averages, in the same "best effort, never exact" spirit as the price table.
// An ingredient absent from here keeps the old behaviour: its lines are summed per unit and priced
// by the generic per-unit fallback.

export type PiezaUnidad = 'unidades' | 'rebanadas' | 'dientes' | 'latas'

export interface PiezaIngrediente {
  /** The unit the consolidated line is shown in: grams, or the piece the ingredient is bought by. */
  canonica: 'g' | PiezaUnidad
  /** Grams in one piece (one `unidades`, `rebanadas`, `dientes` or `latas`, whichever the ingredient is counted in). */
  gramosPorPieza: number
}

/**
 * Keyed by `normalizeNombre`. For a piece-counted ingredient, a line in `unidades` means that piece
 * (a pan "unidad" is read as one slice: the price table prices bread per `rebanadas`).
 */
export const PIEZAS: Record<string, PiezaIngrediente> = {
  tomate: { canonica: 'g', gramosPorPieza: 150 },
  patata: { canonica: 'g', gramosPorPieza: 200 },
  boniato: { canonica: 'g', gramosPorPieza: 250 },
  zanahoria: { canonica: 'unidades', gramosPorPieza: 80 },
  cebolla: { canonica: 'unidades', gramosPorPieza: 150 },
  calabacin: { canonica: 'unidades', gramosPorPieza: 250 },
  pepino: { canonica: 'unidades', gramosPorPieza: 250 },
  berenjena: { canonica: 'unidades', gramosPorPieza: 300 },
  'pimiento rojo': { canonica: 'unidades', gramosPorPieza: 180 },
  'pimiento verde': { canonica: 'unidades', gramosPorPieza: 150 },
  lechuga: { canonica: 'unidades', gramosPorPieza: 300 },
  'lechuga romana': { canonica: 'unidades', gramosPorPieza: 300 },
  manzana: { canonica: 'unidades', gramosPorPieza: 180 },
  alcachofas: { canonica: 'unidades', gramosPorPieza: 100 },
  huevo: { canonica: 'unidades', gramosPorPieza: 60 },
  yogur: { canonica: 'unidades', gramosPorPieza: 125 },
  ajo: { canonica: 'dientes', gramosPorPieza: 5 },
  pan: { canonica: 'rebanadas', gramosPorPieza: 30 },
  'atun en lata': { canonica: 'latas', gramosPorPieza: 80 },
}

/** Grams in one cucharada, for the ingredients where the generic 15 g is wrong: a spoon of chopped fresh herb is ~3 g, not 15. */
export const GRAMOS_POR_CUCHARADA: Record<string, number> = {
  cilantro: 3,
  perejil: 3,
  albahaca: 3,
  menta: 3,
  eneldo: 3,
  romero: 3,
  tomillo: 3,
  'semillas de calabaza': 9,
  'semillas de chia': 12,
  'semillas de girasol': 9,
  'semillas de lino': 10,
  sesamo: 9,
  comino: 6,
  pimenton: 7,
  'pimenton dulce': 7,
  'pimenton picante': 7,
  canela: 8,
  'levadura nutricional': 5,
}

const PIEZA_UNIDADES = new Set<string>(['unidades', 'rebanadas', 'dientes', 'latas'])

/** `true` when a line in `unidad` counts pieces of `nombre` (its own piece unit, or plain `unidades`). */
function cuentaPiezas(entrada: PiezaIngrediente, unidad: string): boolean {
  return unidad === 'unidades' || (PIEZA_UNIDADES.has(unidad) && unidad === entrada.canonica)
}

/**
 * The line in grams, or `null` when the ingredient has no entry or the unit cannot be read as
 * weight or pieces (a spoon, `al gusto`...). `kg` is read as 1000 g.
 */
export function aGramos(nombre: string, cantidad: number, unidad: string): number | null {
  const entrada = PIEZAS[nombre]
  if (!entrada) return null
  if (unidad === 'g') return cantidad
  if (unidad === 'kg') return cantidad * 1000
  if (cuentaPiezas(entrada, unidad)) return cantidad * entrada.gramosPorPieza
  return null
}

/** `cantidad` grams as the ingredient's own canonical unit: whole pieces (rounded up) or grams. */
export function desdeGramos(nombre: string, gramos: number): { cantidad: number; unidad: string } | null {
  const entrada = PIEZAS[nombre]
  if (!entrada) return null
  if (entrada.canonica === 'g') return { cantidad: gramos, unidad: 'g' }
  // The small epsilon keeps 3 x 0.1 piece of float noise from becoming one extra piece.
  return { cantidad: Math.max(1, Math.ceil(gramos / entrada.gramosPorPieza - 1e-9)), unidad: entrada.canonica }
}
