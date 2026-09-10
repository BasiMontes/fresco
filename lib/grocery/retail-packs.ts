/**
 * FRESCO-488 — the hand-curated part of the ingredient dictionary.
 *
 * Story Business Rule: "El tamaño de envase típico es una constante por
 * ingrediente, curada a mano, no un dato de proveedor." These are rough
 * Spanish-supermarket pack sizes — "mejor esfuerzo, nunca exacto", the same
 * framing `supabase/functions/generate-shopping-list/aisle-pricing.ts` uses
 * for its price table.
 *
 * The canonical name set + aisle come from the Edge function's own recipe
 * vocabulary; `scripts/gen-grocery-dictionary.ts` joins this overlay onto it
 * to produce `ingredient-dictionary.ts`. Keys here are normalized
 * (lowercase, accent-stripped) — they MUST match a `BASE_QUANTITIES` key or
 * the generator drift test fails.
 */

import type { EnvaseVenta } from './types';

/**
 * Fallback pack per recipe-portion unit, used when an ingredient has no
 * `RETAIL_PACK_OVERRIDE` entry. `cantidad` is expressed in the SAME unit as
 * the recipe portion; `unidad` is the label the shopper buys in.
 */
export const DEFAULT_PACK_BY_UNIT: Record<string, EnvaseVenta> = {
  unidades: { cantidad: 1, unidad: 'unidad' },
  g: { cantidad: 500, unidad: 'g' },
  ml: { cantidad: 1000, unidad: 'ml' },
  dientes: { cantidad: 11, unidad: 'cabeza' },
  rebanadas: { cantidad: 18, unidad: 'paquete' },
  latas: { cantidad: 1, unidad: 'lata' },
  botes: { cantidad: 1, unidad: 'bote' },
};

/** Per-ingredient retail pack — overrides `DEFAULT_PACK_BY_UNIT`. */
export const RETAIL_PACK_OVERRIDE: Record<string, EnvaseVenta> = {
  // ── Frutas y verduras ──────────────────────────────────────────────────
  'espinacas': { cantidad: 250, unidad: 'g' },
  'rucula': { cantidad: 100, unidad: 'g' },
  'kale': { cantidad: 200, unidad: 'g' },
  'brotes de soja': { cantidad: 100, unidad: 'g' },
  'champinones': { cantidad: 250, unidad: 'g' },
  'setas': { cantidad: 250, unidad: 'g' },
  'setas shiitake': { cantidad: 200, unidad: 'g' },
  'brocoli': { cantidad: 500, unidad: 'g' },
  'boniato': { cantidad: 1000, unidad: 'g' },
  'calabaza': { cantidad: 1000, unidad: 'g' },
  'coliflor': { cantidad: 1000, unidad: 'g' },
  'coles de bruselas': { cantidad: 400, unidad: 'g' },
  'esparragos': { cantidad: 500, unidad: 'manojo' },
  'esparragos trigueros': { cantidad: 250, unidad: 'manojo' },
  'guisantes': { cantidad: 400, unidad: 'g' },
  'judias verdes': { cantidad: 500, unidad: 'g' },
  'patata': { cantidad: 1000, unidad: 'g' },
  'tomate': { cantidad: 1000, unidad: 'g' },
  'tomate cherry': { cantidad: 250, unidad: 'g' },
  'tomates cherry': { cantidad: 250, unidad: 'g' },
  'fresas': { cantidad: 500, unidad: 'g' },
  'frutos rojos': { cantidad: 300, unidad: 'g' },
  'uvas': { cantidad: 500, unidad: 'g' },
  'jengibre': { cantidad: 150, unidad: 'g' },
  'albahaca': { cantidad: 25, unidad: 'manojo' },
  'cilantro': { cantidad: 25, unidad: 'manojo' },
  'menta': { cantidad: 25, unidad: 'manojo' },
  'eneldo': { cantidad: 20, unidad: 'manojo' },

  // ── Carnes y aves ──────────────────────────────────────────────────────
  'carne picada': { cantidad: 500, unidad: 'g' },
  'carne picada de ternera': { cantidad: 500, unidad: 'g' },
  'carne picada mixta': { cantidad: 500, unidad: 'g' },
  'ternera picada': { cantidad: 500, unidad: 'g' },
  'carrilleras de cerdo': { cantidad: 700, unidad: 'g' },
  'conejo': { cantidad: 1200, unidad: 'g' },
  'cordero': { cantidad: 1000, unidad: 'g' },
  'costillas de cerdo': { cantidad: 800, unidad: 'g' },
  'higado': { cantidad: 400, unidad: 'g' },
  'lomo de cerdo': { cantidad: 600, unidad: 'g' },
  'magro de cerdo': { cantidad: 600, unidad: 'g' },
  'morcillo': { cantidad: 700, unidad: 'g' },
  'muslo de pollo': { cantidad: 700, unidad: 'g' },
  'muslos de pollo': { cantidad: 700, unidad: 'g' },
  'pavo': { cantidad: 500, unidad: 'g' },
  'pechuga de pavo': { cantidad: 500, unidad: 'g' },
  'pechuga de pollo': { cantidad: 600, unidad: 'g' },
  'pollo': { cantidad: 1400, unidad: 'g' },
  'pollo troceado': { cantidad: 1000, unidad: 'g' },
  'rabo de toro': { cantidad: 1000, unidad: 'g' },
  'secreto iberico': { cantidad: 500, unidad: 'g' },
  'ternera': { cantidad: 500, unidad: 'g' },
  'ternera para guisar': { cantidad: 600, unidad: 'g' },

  // ── Pescados y mariscos ────────────────────────────────────────────────
  'atun': { cantidad: 400, unidad: 'g' },
  'bacalao': { cantidad: 400, unidad: 'g' },
  'bacalao desalado': { cantidad: 400, unidad: 'g' },
  'bonito': { cantidad: 400, unidad: 'g' },
  'calamares': { cantidad: 500, unidad: 'g' },
  'gambas': { cantidad: 400, unidad: 'g' },
  'langostinos': { cantidad: 400, unidad: 'g' },
  'mejillones': { cantidad: 1000, unidad: 'g' },
  'merluza': { cantidad: 500, unidad: 'g' },
  'rape': { cantidad: 400, unidad: 'g' },
  'salmon': { cantidad: 500, unidad: 'g' },
  'salmon ahumado': { cantidad: 100, unidad: 'g' },

  // ── Charcutería y embutidos ────────────────────────────────────────────
  'bacon': { cantidad: 200, unidad: 'g' },
  'chorizo': { cantidad: 200, unidad: 'g' },
  'jamon': { cantidad: 100, unidad: 'g' },
  'jamon cocido': { cantidad: 150, unidad: 'g' },
  'jamon iberico': { cantidad: 100, unidad: 'g' },
  'jamon serrano': { cantidad: 100, unidad: 'g' },
  'morcilla': { cantidad: 250, unidad: 'g' },
  'panceta': { cantidad: 200, unidad: 'g' },
  'tocino': { cantidad: 200, unidad: 'g' },

  // ── Lácteos y huevos ──────────────────────────────────────────────────
  'huevo': { cantidad: 12, unidad: 'docena' },
  'clara de huevo': { cantidad: 12, unidad: 'docena' },
  'leche': { cantidad: 1000, unidad: 'ml' },
  'leche de almendra': { cantidad: 1000, unidad: 'ml' },
  'nata': { cantidad: 200, unidad: 'ml' },
  'nata liquida': { cantidad: 200, unidad: 'ml' },
  'mantequilla': { cantidad: 250, unidad: 'g' },
  'parmesano': { cantidad: 150, unidad: 'g' },
  'queso parmesano': { cantidad: 150, unidad: 'g' },
  'queso': { cantidad: 250, unidad: 'g' },
  'queso crema': { cantidad: 200, unidad: 'g' },
  'queso feta': { cantidad: 200, unidad: 'g' },
  'queso fresco': { cantidad: 250, unidad: 'g' },
  'queso mozzarella': { cantidad: 125, unidad: 'g' },
  'queso rallado': { cantidad: 150, unidad: 'g' },
  'skyr': { cantidad: 1, unidad: 'unidad' },
  'yogur': { cantidad: 1, unidad: 'unidad' },
  'yogur griego': { cantidad: 1, unidad: 'unidad' },
  'yogur natural': { cantidad: 1, unidad: 'unidad' },

  // ── Pan y bollería ────────────────────────────────────────────────────
  'pan': { cantidad: 18, unidad: 'paquete' },
  'pan de centeno': { cantidad: 16, unidad: 'paquete' },
  'pan integral': { cantidad: 18, unidad: 'paquete' },
  'pan rallado': { cantidad: 250, unidad: 'g' },
  'picatostes': { cantidad: 100, unidad: 'g' },
  'tortilla de maiz': { cantidad: 8, unidad: 'paquete' },
  'tortilla de trigo': { cantidad: 8, unidad: 'paquete' },
  'tortitas': { cantidad: 8, unidad: 'paquete' },
  'gofres': { cantidad: 8, unidad: 'paquete' },

  // ── Pasta/arroz/legumbres y despensa seca ─────────────────────────────
  'almendras': { cantidad: 200, unidad: 'g' },
  'cacahuetes': { cantidad: 200, unidad: 'g' },
  'nueces': { cantidad: 200, unidad: 'g' },
  'frutos secos': { cantidad: 200, unidad: 'g' },
  'coco rallado': { cantidad: 150, unidad: 'g' },
  'arroz': { cantidad: 1000, unidad: 'g' },
  'arroz redondo': { cantidad: 1000, unidad: 'g' },
  'avena': { cantidad: 500, unidad: 'g' },
  'granola': { cantidad: 400, unidad: 'g' },
  'espaguetis': { cantidad: 500, unidad: 'g' },
  'pasta': { cantidad: 500, unidad: 'g' },
  'fideos': { cantidad: 500, unidad: 'g' },
  'fideos de arroz': { cantidad: 250, unidad: 'g' },
  'fideos para fideua': { cantidad: 250, unidad: 'g' },
  'harina de trigo': { cantidad: 1000, unidad: 'g' },
  'alubias': { cantidad: 500, unidad: 'g' },
  'alubias blancas': { cantidad: 500, unidad: 'g' },
  'alubias negras': { cantidad: 500, unidad: 'g' },
  'alubias rojas': { cantidad: 500, unidad: 'g' },
  'fabes': { cantidad: 500, unidad: 'g' },
  'frijoles': { cantidad: 500, unidad: 'g' },
  'frijoles pintos': { cantidad: 500, unidad: 'g' },
  'garbanzos': { cantidad: 400, unidad: 'g' },
  'garbanzos cocidos': { cantidad: 400, unidad: 'g' },
  'judiones': { cantidad: 500, unidad: 'g' },
  'lentejas': { cantidad: 500, unidad: 'g' },
  'lentejas pardinas': { cantidad: 500, unidad: 'g' },
  'pochas': { cantidad: 500, unidad: 'g' },
  'quinoa': { cantidad: 500, unidad: 'g' },
  'seitan': { cantidad: 250, unidad: 'g' },
  'tempeh': { cantidad: 200, unidad: 'g' },
  'tofu': { cantidad: 250, unidad: 'g' },
  'edamame': { cantidad: 400, unidad: 'g' },
  'semillas de calabaza': { cantidad: 150, unidad: 'g' },
  'semillas de chia': { cantidad: 200, unidad: 'g' },
  'semillas de girasol': { cantidad: 150, unidad: 'g' },
  'semillas de lino': { cantidad: 200, unidad: 'g' },

  // ── Conservas y salsas ────────────────────────────────────────────────
  'aceitunas': { cantidad: 150, unidad: 'g' },
  'algas': { cantidad: 50, unidad: 'g' },
  'anchoas': { cantidad: 50, unidad: 'lata' },
  'hummus': { cantidad: 200, unidad: 'g' },
  'leche de coco': { cantidad: 400, unidad: 'ml' },
  'maiz blanco': { cantidad: 300, unidad: 'g' },
  'miso': { cantidad: 300, unidad: 'g' },
  'tomate triturado': { cantidad: 400, unidad: 'g' },
  'caldo': { cantidad: 1000, unidad: 'ml' },
  'caldo de carne': { cantidad: 1000, unidad: 'ml' },
  'caldo de pollo': { cantidad: 1000, unidad: 'ml' },
  'caldo de verduras': { cantidad: 1000, unidad: 'ml' },

  // ── Aceites/vinagres/condimentos ──────────────────────────────────────
  'aceite de oliva': { cantidad: 1000, unidad: 'ml' },
  'salsa de soja': { cantidad: 250, unidad: 'ml' },
  'tamari': { cantidad: 250, unidad: 'ml' },
  'tahini': { cantidad: 300, unidad: 'g' },
  'miel': { cantidad: 500, unidad: 'g' },
  'sesamo': { cantidad: 100, unidad: 'g' },
  'levadura nutricional': { cantidad: 100, unidad: 'g' },
  'sal': { cantidad: 1000, unidad: 'g' },
  // dried spices — one small jar covers many weeks
  'azafran': { cantidad: 1, unidad: 'tarro' },
  'canela': { cantidad: 40, unidad: 'tarro' },
  'comino': { cantidad: 40, unidad: 'tarro' },
  'oregano': { cantidad: 25, unidad: 'tarro' },
  'pimenton': { cantidad: 75, unidad: 'tarro' },
  'pimenton dulce': { cantidad: 75, unidad: 'tarro' },
  'pimenton picante': { cantidad: 75, unidad: 'tarro' },
  'pimienta negra': { cantidad: 45, unidad: 'tarro' },
  'romero': { cantidad: 20, unidad: 'tarro' },
  'tomillo': { cantidad: 20, unidad: 'tarro' },

  // ── Bebidas ──────────────────────────────────────────────────────────
  'vino blanco': { cantidad: 750, unidad: 'ml' },
  'vino tinto': { cantidad: 750, unidad: 'ml' },
};

/** Supermarket search term when the canonical name is a weak query. Defaults to the canonical name. */
export const SEARCH_TERM_OVERRIDE: Record<string, string> = {
  'aceite de oliva': 'aceite de oliva virgen extra',
  'pan': 'pan de molde',
  'levadura nutricional': 'levadura nutricional copos',
  'salmon ahumado': 'salmón ahumado lonchas',
  'clara de huevo': 'claras de huevo',
  'maiz blanco': 'maíz dulce',
  'algas': 'alga nori',
};

/** Alternate spellings a shopper or a supermarket search might use. Keyed by canonical, defaults to []. */
export const SYNONYM_OVERRIDE: Record<string, string[]> = {
  'platano': ['banana'],
  'judias verdes': ['habichuelas', 'chauchas'],
  'gambas': ['camarones'],
  'champinones': ['champiñones'],
  'aguacate': ['palta'],
  'cacahuetes': ['maní'],
  'pimiento rojo': ['morrón rojo'],
  'boniato': ['batata'],
};
