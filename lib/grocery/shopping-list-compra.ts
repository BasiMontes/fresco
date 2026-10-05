import type { CompraPorItem, LineaCompra } from './compra';
import type { PerfilCompra } from './product-compatibility';
import type { MappedGroceryItem } from './types';
import type { ShoppingListPasillo } from '@/lib/api/types';
import { antiguedadEnDias, claveItemCompra } from './compra';
import { precioLinea } from './line-price';
import { mapShoppingListItem } from './map-item';

/**
 * FRESCO-808 — SERVER-ONLY. Resolves what a shopping-list row needs from the
 * supermarket layer and hands it to the client as plain data (`compra.ts`).
 * Never import this from a client component: it pulls both chain catalogs.
 *
 * The view used to map every row itself, which pulled both chain catalogs
 * (about 105 KB) into the browser bundle and hard-coded each chain by name. It
 * now receives a `CompraPorItem` and prints whatever chains it contains, so a
 * new chain needs no component change.
 */

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
