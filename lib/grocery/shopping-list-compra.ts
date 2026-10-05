import type { PerfilCompra } from './product-compatibility';
import type { MappedGroceryItem } from './types';
import type { ShoppingListPasillo } from '@/lib/api/types';
import { precioLinea } from './line-price';
import { mapShoppingListItem } from './map-item';

/**
 * FRESCO-808 — what a shopping-list row needs from the supermarket layer,
 * resolved on the SERVER and handed to the client as plain data.
 *
 * The view used to map every row itself, which pulled both chain catalogs
 * (about 105 KB) into the browser bundle and hard-coded each chain by name. It
 * now receives a `CompraPorItem` and prints whatever chains it contains, so a
 * new chain needs no component change.
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

function aLinea({ item, mapped, ahora }: { item: ShoppingListPasillo['items'][number], mapped: MappedGroceryItem, ahora: Date }): LineaCompra {
  return {
    precio: precioLinea(item, mapped),
    enlaces: mapped.precios.flatMap(p => (p.url
      ? [{ cadena: p.cadena, nombreCadena: p.nombreCadena, url: p.url, antiguedadDias: antiguedadEnDias({ observadoEn: p.observadoEn, ahora }) }]
      : [])),
  };
}

interface ResolverCompraInput {
  pasillos: readonly Pick<ShoppingListPasillo, 'nombre' | 'items'>[]
  perfil?: PerfilCompra
  ahora?: Date
}

export function resolverCompra({ pasillos, perfil, ahora = new Date() }: ResolverCompraInput): CompraPorItem {
  const compra: Record<string, LineaCompra> = {};
  for (const pasillo of pasillos) {
    for (const item of pasillo.items) {
      compra[claveItemCompra({ pasillo: pasillo.nombre, item: item.nombre })] = aLinea({
        item,
        mapped: mapShoppingListItem(item, perfil),
        ahora,
      });
    }
  }
  return compra;
}
