/**
 * FRESCO-752 — source-agnostic supermarket data contract.
 *
 * One normalized product shape every connector produces, whatever the chain
 * or its source (storefront API, community dataset, affiliate feed). Adding a
 * chain means writing a connector, never changing these types.
 *
 * The one rule that makes prices comparable: `precioEnvase` is ALWAYS the
 * price of the whole `envase`. A chain that publishes a price per reference
 * unit (Mercadona: "3,90 EUR / L") is converted by its connector with
 * `precioEnvaseDesdeReferencia`; a chain that publishes a pack price
 * (Consum) passes it through. Nothing downstream sees the difference.
 */

/** Chain slug (`mercadona`, `consum`, ...). A string, not a union, so a new chain touches no type. */
export type CadenaId = string;

/** Chain-specific price zone: a store id or a postcode area, whichever the chain prices by. */
export type ZonaId = string;

/** Quantities are always held in a base unit: grams, millilitres or countable units. */
export type UnidadBase = 'g' | 'ml' | 'unidad';

export interface Envase {
  cantidad: number
  unidad: UnidadBase
}

export interface ProductoSupermercado {
  cadena: CadenaId
  /** The chain's own product id. Unique per `cadena`. */
  idExterno: string
  nombre: string
  marca: string | null
  envase: Envase
  /** EUR for the WHOLE `envase`. Never a per-reference-unit price. */
  precioEnvase: number
  /** Deep link to the product on the chain's own site, when one exists. */
  url: string | null
  disponible: boolean
  zona: ZonaId
  /** ISO 8601 instant at which the connector observed this price. */
  observadoEn: string
}

/** A price per 1 kg, 1 l or 1 unit, derived from the pack price. */
export interface PrecioReferencia {
  precio: number
  por: 'kg' | 'l' | 'unidad'
}

/**
 * FRESCO-768 — one chain's price for a shopping-list item, in the common
 * shape: the whole pack and the comparable per-kg / per-l / per-unit price.
 */
export interface PrecioNormalizado {
  cadena: CadenaId
  /** EUR for the WHOLE pack the item's `envasesEstimados` counts. */
  precioEnvase: number
  precioReferencia: PrecioReferencia
  url: string | null
  observadoEn: string
}
