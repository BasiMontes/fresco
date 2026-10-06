/**
 * FRESCO-808 — the purchase data a shopping-list row needs, as plain types plus
 * the helpers that touch no catalog. Safe to import from a client component:
 * the server-only resolver lives in `shopping-list-compra.ts` and pulls the
 * chain catalogs, which must never reach the browser bundle.
 */

export interface EnlaceSupermercado {
  cadena: string
  /** The name the shopper reads ("Mercadona"), declared by the chain's connector. */
  nombreCadena: string
  url: string
  /** Whole days since the price was observed, or `null` when the source gives no date. */
  antiguedadDias: number | null
}

export interface LineaCompra {
  /** What the row costs: the linked product's whole-pack price times the packs, else the stored estimate. */
  precio: number | undefined
  enlaces: EnlaceSupermercado[]
}

export type CompraPorItem = Readonly<Record<string, LineaCompra>>;

/**
 * FRESCO-790 — the chains that priced at least one row, as the shopper reads
 * them: "Mercadona", "Mercadona y Consum", "A, B y C". Empty when no row has a
 * link. Derived from the data so a chain that is switched off (ADR-0037) drops
 * out of the text without touching any component.
 */
export function nombresDeCadenas(compra: CompraPorItem | undefined): string {
  const nombres = [...new Set(Object.values(compra ?? {}).flatMap(linea => linea.enlaces.map(e => e.nombreCadena)))].sort();
  if (nombres.length <= 1) { return nombres.join(''); }
  return `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`;
}

const MS_POR_DIA = 86_400_000;

/** Key of one row: aisle plus name, because the same name can sit in two aisles. */
export function claveItemCompra({ pasillo, item }: { pasillo: string, item: string }): string {
  return `${pasillo}::${item}`;
}

/**
 * Days since `observadoEn`. `null` for an unparseable instant and for the Unix
 * epoch, which the static catalogs use for "no date known" (printing "56 years
 * ago" would be worse than printing nothing). A date in the future counts as 0.
 */
export function antiguedadEnDias({ observadoEn, ahora }: { observadoEn: string, ahora: Date }): number | null {
  const instante = new Date(observadoEn).getTime();
  if (Number.isNaN(instante) || instante <= 0) {
    return null;
  }
  return Math.max(0, Math.floor((ahora.getTime() - instante) / MS_POR_DIA));
}
