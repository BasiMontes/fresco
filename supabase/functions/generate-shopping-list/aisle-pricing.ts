// Deterministic aisle classification + cost estimate — replaces the Gemini
// call this function used to make (prompt.ts, now deleted). Ingredient names
// are a controlled vocabulary (the recipe generator's own ingredient list,
// not free user text), so a static ingredient -> pasillo/price map is a
// reliable, zero-cost substitute. FR-4.2's fixed 13-pasillo vocabulary and
// FR-4.3's unit vocabulary carry over unchanged from the old prompt.
//
// Prices are rough Spanish-supermarket estimates, same "mejor esfuerzo,
// nunca exacto" framing the old Gemini prompt used — not sourced from real
// price data, since none exists in this DB.

import type { IngredienteConsolidado } from './types.ts'
import type { ShoppingListItem, ShoppingListPasillo } from '../../../api/schemas/shopping-list.types.ts'

export const PASILLOS = [
  'Frutas y verduras',
  'Carnes y aves',
  'Pescados y mariscos',
  'Charcutería y embutidos',
  'Lácteos y huevos',
  'Pan y bollería',
  'Pasta/arroz/legumbres',
  'Conservas y salsas',
  'Aceites/vinagres/condimentos',
  'Congelados',
  'Bebidas',
  'Higiene y limpieza',
  'Otros',
] as const

/** Same normalization consolidator.ts applies — `ingredientesConsolidados[].nombre` already arrives in this form. */
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

const INGREDIENT_AISLE: Record<string, (typeof PASILLOS)[number]> = {
  // Frutas y verduras
  aguacate: 'Frutas y verduras',
  'aji amarillo': 'Frutas y verduras',
  ajo: 'Frutas y verduras',
  albahaca: 'Frutas y verduras',
  alcachofas: 'Frutas y verduras',
  apio: 'Frutas y verduras',
  berenjena: 'Frutas y verduras',
  boniato: 'Frutas y verduras',
  brocoli: 'Frutas y verduras',
  'brotes de soja': 'Frutas y verduras',
  calabacin: 'Frutas y verduras',
  calabaza: 'Frutas y verduras',
  cebolla: 'Frutas y verduras',
  cebolleta: 'Frutas y verduras',
  champinones: 'Frutas y verduras',
  cilantro: 'Frutas y verduras',
  'coles de bruselas': 'Frutas y verduras',
  coliflor: 'Frutas y verduras',
  eneldo: 'Frutas y verduras',
  esparragos: 'Frutas y verduras',
  'esparragos trigueros': 'Frutas y verduras',
  espinacas: 'Frutas y verduras',
  fresas: 'Frutas y verduras',
  'frutos rojos': 'Frutas y verduras',
  guisantes: 'Frutas y verduras',
  jengibre: 'Frutas y verduras',
  'judias verdes': 'Frutas y verduras',
  kale: 'Frutas y verduras',
  lechuga: 'Frutas y verduras',
  'lechuga romana': 'Frutas y verduras',
  lima: 'Frutas y verduras',
  limon: 'Frutas y verduras',
  manzana: 'Frutas y verduras',
  melon: 'Frutas y verduras',
  menta: 'Frutas y verduras',
  patata: 'Frutas y verduras',
  pepino: 'Frutas y verduras',
  pera: 'Frutas y verduras',
  pimiento: 'Frutas y verduras',
  'pimiento rojo': 'Frutas y verduras',
  'pimiento verde': 'Frutas y verduras',
  platano: 'Frutas y verduras',
  portobello: 'Frutas y verduras',
  puerro: 'Frutas y verduras',
  repollo: 'Frutas y verduras',
  rucula: 'Frutas y verduras',
  setas: 'Frutas y verduras',
  'setas shiitake': 'Frutas y verduras',
  tomate: 'Frutas y verduras',
  'tomates cherry': 'Frutas y verduras',
  uvas: 'Frutas y verduras',
  zanahoria: 'Frutas y verduras',

  // Carnes y aves
  'carne picada': 'Carnes y aves',
  'carne picada de ternera': 'Carnes y aves',
  'carne picada mixta': 'Carnes y aves',
  'carrilleras de cerdo': 'Carnes y aves',
  codornices: 'Carnes y aves',
  conejo: 'Carnes y aves',
  cordero: 'Carnes y aves',
  'costillas de cerdo': 'Carnes y aves',
  higado: 'Carnes y aves',
  'lomo de cerdo': 'Carnes y aves',
  'magro de cerdo': 'Carnes y aves',
  morcillo: 'Carnes y aves',
  'muslos de pollo': 'Carnes y aves',
  pavo: 'Carnes y aves',
  'pechuga de pavo': 'Carnes y aves',
  'pechuga de pollo': 'Carnes y aves',
  pollo: 'Carnes y aves',
  'pollo troceado': 'Carnes y aves',
  'rabo de toro': 'Carnes y aves',
  'secreto iberico': 'Carnes y aves',
  ternera: 'Carnes y aves',
  'ternera para guisar': 'Carnes y aves',
  'ternera picada': 'Carnes y aves',

  // Pescados y mariscos
  atun: 'Pescados y mariscos',
  bacalao: 'Pescados y mariscos',
  'bacalao desalado': 'Pescados y mariscos',
  bonito: 'Pescados y mariscos',
  calamares: 'Pescados y mariscos',
  dorada: 'Pescados y mariscos',
  gambas: 'Pescados y mariscos',
  langostinos: 'Pescados y mariscos',
  mejillones: 'Pescados y mariscos',
  merluza: 'Pescados y mariscos',
  rape: 'Pescados y mariscos',
  salmon: 'Pescados y mariscos',
  'salmon ahumado': 'Pescados y mariscos',

  // Charcutería y embutidos
  chorizo: 'Charcutería y embutidos',
  jamon: 'Charcutería y embutidos',
  'jamon cocido': 'Charcutería y embutidos',
  'jamon iberico': 'Charcutería y embutidos',
  'jamon serrano': 'Charcutería y embutidos',
  morcilla: 'Charcutería y embutidos',
  panceta: 'Charcutería y embutidos',
  tocino: 'Charcutería y embutidos',

  // Lácteos y huevos
  'clara de huevo': 'Lácteos y huevos',
  huevo: 'Lácteos y huevos',
  'leche de almendra': 'Lácteos y huevos',
  leche: 'Lácteos y huevos',
  nata: 'Lácteos y huevos',
  parmesano: 'Lácteos y huevos',
  queso: 'Lácteos y huevos',
  'queso crema': 'Lácteos y huevos',
  'queso feta': 'Lácteos y huevos',
  'queso fresco': 'Lácteos y huevos',
  'queso mozzarella': 'Lácteos y huevos',
  'queso parmesano': 'Lácteos y huevos',
  'queso rallado': 'Lácteos y huevos',
  skyr: 'Lácteos y huevos',
  yogur: 'Lácteos y huevos',
  'yogur griego': 'Lácteos y huevos',
  'yogur natural': 'Lácteos y huevos',

  // Pan y bollería
  gofres: 'Pan y bollería',
  pan: 'Pan y bollería',
  'pan de centeno': 'Pan y bollería',
  'pan integral': 'Pan y bollería',
  'pan rallado': 'Pan y bollería',
  picatostes: 'Pan y bollería',
  'tortilla de maiz': 'Pan y bollería',
  'tortilla de trigo': 'Pan y bollería',
  tortitas: 'Pan y bollería',

  // Pasta/arroz/legumbres (also the dry-pantry bucket: nuts, seeds, grains, plant proteins)
  almendras: 'Pasta/arroz/legumbres',
  alubias: 'Pasta/arroz/legumbres',
  'alubias blancas': 'Pasta/arroz/legumbres',
  'alubias negras': 'Pasta/arroz/legumbres',
  'alubias rojas': 'Pasta/arroz/legumbres',
  arroz: 'Pasta/arroz/legumbres',
  'arroz redondo': 'Pasta/arroz/legumbres',
  avena: 'Pasta/arroz/legumbres',
  cacahuetes: 'Pasta/arroz/legumbres',
  'coco rallado': 'Pasta/arroz/legumbres',
  edamame: 'Congelados',
  espaguetis: 'Pasta/arroz/legumbres',
  fabes: 'Pasta/arroz/legumbres',
  fideos: 'Pasta/arroz/legumbres',
  'fideos de arroz': 'Pasta/arroz/legumbres',
  'fideos para fideua': 'Pasta/arroz/legumbres',
  frijoles: 'Pasta/arroz/legumbres',
  'frijoles pintos': 'Pasta/arroz/legumbres',
  'frutos secos': 'Pasta/arroz/legumbres',
  garbanzos: 'Pasta/arroz/legumbres',
  'garbanzos cocidos': 'Pasta/arroz/legumbres',
  granola: 'Pasta/arroz/legumbres',
  'harina de trigo': 'Pasta/arroz/legumbres',
  judiones: 'Pasta/arroz/legumbres',
  lentejas: 'Pasta/arroz/legumbres',
  'lentejas pardinas': 'Pasta/arroz/legumbres',
  nueces: 'Pasta/arroz/legumbres',
  pasta: 'Pasta/arroz/legumbres',
  pochas: 'Pasta/arroz/legumbres',
  quinoa: 'Pasta/arroz/legumbres',
  seitan: 'Pasta/arroz/legumbres',
  'semillas de calabaza': 'Pasta/arroz/legumbres',
  'semillas de chia': 'Pasta/arroz/legumbres',
  'semillas de girasol': 'Pasta/arroz/legumbres',
  'semillas de lino': 'Pasta/arroz/legumbres',
  tempeh: 'Pasta/arroz/legumbres',
  tofu: 'Pasta/arroz/legumbres',

  // Conservas y salsas
  aceitunas: 'Conservas y salsas',
  algas: 'Conservas y salsas',
  anchoas: 'Conservas y salsas',
  'atun en lata': 'Conservas y salsas',
  caldo: 'Conservas y salsas',
  'caldo de carne': 'Conservas y salsas',
  'caldo de pollo': 'Conservas y salsas',
  'caldo de verduras': 'Conservas y salsas',
  hummus: 'Conservas y salsas',
  'leche de coco': 'Conservas y salsas',
  'maiz blanco': 'Conservas y salsas',
  miso: 'Conservas y salsas',
  'tomate triturado': 'Conservas y salsas',

  // Aceites/vinagres/condimentos
  'aceite de oliva': 'Aceites/vinagres/condimentos',
  azafran: 'Aceites/vinagres/condimentos',
  canela: 'Aceites/vinagres/condimentos',
  comino: 'Aceites/vinagres/condimentos',
  laurel: 'Aceites/vinagres/condimentos',
  'levadura nutricional': 'Aceites/vinagres/condimentos',
  miel: 'Aceites/vinagres/condimentos',
  oregano: 'Aceites/vinagres/condimentos',
  'pimenton dulce': 'Aceites/vinagres/condimentos',
  'pimenton picante': 'Aceites/vinagres/condimentos',
  romero: 'Aceites/vinagres/condimentos',
  sal: 'Aceites/vinagres/condimentos',
  'salsa de soja': 'Aceites/vinagres/condimentos',
  sesamo: 'Aceites/vinagres/condimentos',
  tahini: 'Aceites/vinagres/condimentos',
  tamari: 'Aceites/vinagres/condimentos',
  tomillo: 'Aceites/vinagres/condimentos',

  // Bebidas
  'vino blanco': 'Bebidas',
  'vino tinto': 'Bebidas',
}

/** Price per single unit of the ingredient's own unidad (not a generic per-unidad-type default) — used before the generic fallback. */
const PRICE_OVERRIDE: Record<string, number> = {
  cebolla: 0.3,
  ajo: 0.03,
  tomate: 0.003,
  'pimiento rojo': 0.6,
  'pimiento verde': 0.6,
  zanahoria: 0.15,
  patata: 0.0025,
  berenjena: 0.8,
  espinacas: 0.012,
  lechuga: 0.9,
  'pechuga de pollo': 0.009,
  'ternera picada': 0.011,
  'lomo de cerdo': 0.008,
  chorizo: 0.014,
  merluza: 0.016,
  gambas: 0.022,
  huevo: 0.25,
  leche: 0.0011,
  'queso rallado': 0.014,
  'queso fresco': 0.01,
  yogur: 0.35,
  pasta: 0.0018,
  arroz: 0.0016,
  lentejas: 0.0028,
  garbanzos: 0.0026,
  alubias: 0.0028,
  'tomate triturado': 0.0022,
  'caldo de pollo': 0.003,
  'caldo de verduras': 0.003,
  'aceite de oliva': 0.009,
  sal: 0.002,
  comino: 0.02,
  pan: 0.12,
  'pan rallado': 0.005,
  // Higher-value items that usually land on the `unidades` default (either
  // genuinely bought by the piece/pack, or falling through to it because
  // this recipe's ingredient name isn't in consolidator.ts's BASE_QUANTITIES).
  salmon: 4.5,
  'salmon ahumado': 3.2,
  bacalao: 5,
  'bacalao desalado': 5,
  langostinos: 6,
  mejillones: 3,
  calamares: 4,
  jamon: 3.5,
  'jamon iberico': 8,
  'jamon serrano': 3.5,
  'jamon cocido': 2.2,
  'queso parmesano': 4,
  parmesano: 4,
  'queso mozzarella': 1.8,
  'queso feta': 2.5,
  'queso crema': 1.6,
  ternera: 5,
  'ternera para guisar': 5,
  cordero: 6,
  conejo: 4.5,
  pavo: 3.5,
  'pechuga de pavo': 3.5,
  pollo: 3,
  'pollo troceado': 3,
  'muslos de pollo': 2.8,
  setas: 2,
  'setas shiitake': 2.2,
  almendras: 2,
  nueces: 2,
  cacahuetes: 1.5,
  'frutos secos': 2,
  quinoa: 2.5,
  tofu: 1.8,
  tempeh: 2.2,
  seitan: 2.2,
  'vino blanco': 4,
  'vino tinto': 4,
}

/** Fallback when an ingredient has no PRICE_OVERRIDE entry — keyed by unidad, not by ingredient. */
const PRICE_PER_UNIT_TYPE: Record<string, number> = {
  unidades: 0.8,
  g: 0.006,
  kg: 6,
  ml: 0.004,
  l: 4,
  latas: 1.4,
  botes: 2,
  rebanadas: 0.12,
  dientes: 0.04,
  cucharadas: 0.08,
}

const COSTE_MARGEN = 0.15 // +/- 15% band around the point estimate — "mejor esfuerzo", never exact

function pasilloFor(nombreNormalizado: string): (typeof PASILLOS)[number] {
  return INGREDIENT_AISLE[nombreNormalizado] ?? 'Otros'
}

function precioUnitario(nombreNormalizado: string, unidad: string): number {
  return PRICE_OVERRIDE[nombreNormalizado] ?? PRICE_PER_UNIT_TYPE[unidad] ?? PRICE_PER_UNIT_TYPE.unidades
}

export interface ClassifiedShoppingList {
  pasillos: ShoppingListPasillo[]
  resumen: {
    total_items: number
    coste_estimado_min: number
    coste_estimado_max: number
    moneda: 'EUR'
  }
}

/**
 * Deterministic replacement for the old Gemini classification call —
 * assigns each already-consolidated ingredient to one of the 13 fixed
 * pasillos (FR-4.2), sorts alphabetically within each, and estimates a
 * coste range from the static price table above.
 */
export function classifyShoppingList(ingredientes: IngredienteConsolidado[]): ClassifiedShoppingList {
  const porPasillo = new Map<(typeof PASILLOS)[number], ShoppingListItem[]>()
  let costeTotal = 0

  for (const ingrediente of ingredientes) {
    const nombreNormalizado = normalizeNombre(ingrediente.nombre)
    const pasillo = pasilloFor(nombreNormalizado)
    const item: ShoppingListItem = {
      nombre: ingrediente.nombre,
      cantidad: ingrediente.cantidad,
      unidad: ingrediente.unidad,
      comprado: false,
    }

    if (!porPasillo.has(pasillo)) porPasillo.set(pasillo, [])
    porPasillo.get(pasillo)!.push(item)

    costeTotal += precioUnitario(nombreNormalizado, ingrediente.unidad) * ingrediente.cantidad
  }

  const pasillos: ShoppingListPasillo[] = PASILLOS
    .map((nombre, index) => ({
      nombre,
      orden: index + 1,
      items: (porPasillo.get(nombre) ?? []).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    }))
    .filter(pasillo => pasillo.items.length > 0)

  return {
    pasillos,
    resumen: {
      total_items: ingredientes.length,
      coste_estimado_min: Math.round(costeTotal * (1 - COSTE_MARGEN) * 100) / 100,
      coste_estimado_max: Math.round(costeTotal * (1 + COSTE_MARGEN) * 100) / 100,
      moneda: 'EUR',
    },
  }
}
