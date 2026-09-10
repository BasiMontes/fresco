import type { ShoppingListPasillo } from '@schemas';

/**
 * FRESCO-488 — the ingredient→product mapping layer.
 *
 * Turns one Fresco shopping-list item (a recipe-ingredient name + quantity +
 * unit, the shape `shopping_lists` already stores) into its buyable form:
 * canonical product, supermarket search term, sale unit, an estimated pack
 * count, and a confidence level. Pure, deterministic, no I/O — consumed by the
 * list export, the affiliate deep-link, and the price comparator (FRESCO-346).
 */

export type Confianza = 'alta' | 'media' | 'baja';

export type Pasillo = ShoppingListPasillo['nombre'];

/** The typical retail pack a shopper picks off the shelf — NOT the recipe portion. */
export interface EnvaseVenta {
  cantidad: number
  unidad: string
}

/** One dictionary entry: everything known about a canonical Fresco ingredient. */
export interface CanonicalIngredient {
  /** Normalized canonical key (lowercase, accent-stripped) — matches `normalizeNombre`. */
  clave: string
  /** Display name, accents kept. */
  canonico: string
  pasillo: Pasillo
  /** Recipe portion this ingredient's `BASE_QUANTITIES` entry encodes (reference only). */
  porcionReceta: { cantidad: number, unidad: string }
  /** Typical retail pack — the hand-curated part (story Business Rule: a constant, never a provider feed). */
  envaseVenta: EnvaseVenta
  /** Alternate spellings a shopper or a supermarket search might use. */
  sinonimos: string[]
  /** Supermarket search term when the canonical name is a poor query. Defaults to `canonico`. */
  terminoBusqueda: string
}

/** Result of mapping one shopping-list item. */
export interface MappedGroceryItem {
  /** Original item name, verbatim. */
  nombreOriginal: string
  /** Canonical product name, or `nombreOriginal` when the ingredient is unknown. */
  productoCanonico: string
  /** Term to feed a supermarket search. */
  terminoBusqueda: string
  /** Aisle, or `null` when the ingredient is unknown. */
  pasillo: Pasillo | null
  /** Item quantity normalized to a base unit (kg→g, l→ml); otherwise unchanged. */
  cantidadNormalizada: number
  /** Unit the shopper buys in (`unidad`, `g`, `ml`, `cabeza`, `paquete`, …). */
  unidadVenta: string
  /** How many retail packs cover the quantity. Always ≥ 1. */
  envasesEstimados: number
  confianza: Confianza
}

/** Input shape — the subset of `ShoppingListItem` this layer reads. */
export interface GroceryInput {
  nombre: string
  cantidad: number
  unidad: string
  usos?: { receta: string }[]
}
