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

/**
 * Real Mercadona reference price sourced from the catalog (FRESCO-503).
 *
 * NOT the price of the whole `envaseVenta` pack — `precioReferencia` is the
 * price of ONE unit of `formatoReferencia` (e.g. "100 g" or "1 kg"), and
 * `formatoReferencia` can differ from the pack's own `envaseVenta.unidad`/
 * `cantidad`. Example: a 40 g pack (`envaseVenta: {cantidad: 40, unidad:
 * 'g'}`) can carry `{precioReferencia: 3.5, formatoReferencia: '100 g'}` —
 * the pack itself costs ≈€1.40 (3.5 × 40/100), not €3.5. A consumer that
 * needs the pack price (FRESCO-340, cost estimate) must convert
 * `envaseVenta` into `formatoReferencia`'s unit and multiply, never read
 * `precioReferencia` directly as the pack price.
 */
export interface PrecioMercadona {
  /** Price in EUR for one unit of `formatoReferencia` — NOT the price of `envaseVenta`. */
  precioReferencia: number
  /** The unit `precioReferencia` is priced per, e.g. "100 g" or "1 kg" — may differ from `envaseVenta.unidad`. */
  formatoReferencia: string
}

/** Where `envaseVenta` came from — lets downstream stories (FRESCO-340, FRESCO-345) tell a real price from an estimate. */
export type OrigenEnvase = 'mercadona' | 'estimado';

/** One dictionary entry: everything known about a canonical Fresco ingredient. */
export interface CanonicalIngredient {
  /** Normalized canonical key (lowercase, accent-stripped) — matches `normalizeNombre`. */
  clave: string
  /** Display name, accents kept. */
  canonico: string
  pasillo: Pasillo
  /** Recipe portion this ingredient's `BASE_QUANTITIES` entry encodes (reference only). */
  porcionReceta: { cantidad: number, unidad: string }
  /** Typical retail pack — real Mercadona data when available (FRESCO-503), else the hand-curated estimate. */
  envaseVenta: EnvaseVenta
  /** Alternate spellings a shopper or a supermarket search might use. */
  sinonimos: string[]
  /** Supermarket search term when the canonical name is a poor query. Defaults to `canonico`. */
  terminoBusqueda: string
  /** Whether `envaseVenta` came from the real Mercadona catalog or the hand-curated fallback (FRESCO-503). */
  origenEnvase: OrigenEnvase
  /** Real Mercadona reference price, when `origenEnvase === 'mercadona'`. Null otherwise. */
  precioMercadona: PrecioMercadona | null
  /** Deep-link to this exact product on tienda.mercadona.es (FRESCO-518 tier 1), when `origenEnvase === 'mercadona'`. Null otherwise. */
  mercadonaUrl: string | null
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
  /** Whether `unidadVenta`/pack size came from the real Mercadona catalog or the hand-curated fallback (FRESCO-503). */
  origenEnvase: OrigenEnvase
  /** Real Mercadona reference price, when `origenEnvase === 'mercadona'`. Null otherwise. */
  precioMercadona: PrecioMercadona | null
  /** Deep-link to this exact product on tienda.mercadona.es (FRESCO-518 tier 1), when `origenEnvase === 'mercadona'`. Null otherwise. */
  mercadonaUrl: string | null
}

/** Input shape — the subset of `ShoppingListItem` this layer reads. */
export interface GroceryInput {
  nombre: string
  cantidad: number
  unidad: string
  usos?: { receta: string }[]
}
