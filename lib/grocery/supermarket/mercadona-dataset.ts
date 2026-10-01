import type { SupermarketConnector } from './connector';
import type { ProductoSupermercado, UnidadBase, ZonaId } from './types';
import { normalizeNombre } from '@/lib/text/normalize-nombre';
import { PERMISO_MERCADONA, precioEnvaseMercadona } from './catalog-connectors';

/**
 * FRESCO-771 — the Mercadona connector that brings prices the committed
 * catalog does not have: the product's own id and the date of the snapshot.
 *
 * Its source is the community dataset `datania/mercadona-catalog` (the one
 * FRESCO-762 already reads), NOT Mercadona's API. It makes no request to
 * Mercadona, which is where ADR-0028 leaves the gate: calling its endpoints
 * directly would reopen the legal risk read. The trade is freshness: the
 * dataset is exported on Mondays, so a price is at most a week old.
 *
 * The download and the snapshot date are injected, so this file holds no I/O:
 * the runner passes the real ones, the tests pass fixtures. The catalog is
 * loaded once per connector, however many products are asked for.
 *
 * Not for the browser: the app's registry keeps the static connector.
 */

/** The subset of a dataset product this reads (field names as the dataset has them). */
export interface ProductoDatasetMercadona {
  id: string
  display_name: string
  share_url: string
  price_instructions: {
    reference_price: string
    reference_format: string
    unit_size: number | null
    size_format: string | null
  }
}

export interface FuenteDatasetMercadona {
  /** Every product of the dataset. Called at most once per connector. */
  cargarCatalogo: () => Promise<readonly ProductoDatasetMercadona[]>
  /** ISO instant the snapshot was published: what `observadoEn` reports. */
  fechaSnapshot: () => Promise<string>
}

/** Fresco has no postcode yet, so every chain prices one zone (migration 20261001180000). */
export const ZONA_DATASET: ZonaId = 'default';

const MAX_RESULTADOS_BUSQUEDA = 50;

/** The base unit for each `size_format` Mercadona prints. Anything else (pieces, sachets) is dropped. */
const UNIDAD_POR_FORMATO: Readonly<Record<string, UnidadBase>> = { kg: 'g', l: 'ml' };

/**
 * One dataset product as the common shape, or `null` when it cannot be priced
 * faithfully: a unit that is not weight or volume, no pack size, or a price
 * that does not convert. The pack price uses the same conversion as the static
 * connector (the price per reference unit times the pack), so both agree.
 */
export function productoDeDataset(
  p: ProductoDatasetMercadona,
  observadoEn: string,
  zona: ZonaId = ZONA_DATASET,
): ProductoSupermercado | null {
  const pi = p.price_instructions;
  const unidad = pi.size_format === null ? undefined : UNIDAD_POR_FORMATO[pi.size_format];
  if (unidad === undefined || !(pi.unit_size !== null && pi.unit_size > 0)) {
    return null;
  }
  const cantidad = Math.round(pi.unit_size * 1000);
  const precioReferencia = Number.parseFloat(pi.reference_price);
  if (cantidad <= 0 || !(precioReferencia > 0)) {
    return null;
  }
  const envase = { cantidad, unidad };
  const precioEnvase = precioEnvaseMercadona({
    envaseVenta: envase,
    precioMercadona: { precioReferencia, formatoReferencia: pi.reference_format },
  });
  if (!(precioEnvase > 0)) {
    return null;
  }
  return {
    cadena: 'mercadona',
    idExterno: p.id,
    nombre: p.display_name,
    marca: null,
    envase,
    precioEnvase,
    url: p.share_url,
    disponible: true,
    zona,
    observadoEn,
  };
}

interface CatalogoCargado {
  porId: ReadonlyMap<string, ProductoSupermercado>
  lista: readonly ProductoSupermercado[]
}

export function crearConectorMercadonaDataset(
  fuente: FuenteDatasetMercadona,
  zona: ZonaId = ZONA_DATASET,
): SupermarketConnector {
  // One shared promise: a failed load stays failed for the run, so a dataset
  // that is down is asked for once, not once per product.
  let cargado: Promise<CatalogoCargado> | null = null;
  const cargar = async (): Promise<CatalogoCargado> => {
    cargado ??= (async () => {
      const [catalogo, fecha] = await Promise.all([fuente.cargarCatalogo(), fuente.fechaSnapshot()]);
      if (Number.isNaN(new Date(fecha).getTime())) {
        throw new TypeError(`the dataset snapshot date is not a valid instant: "${fecha}"`);
      }
      const lista = catalogo
        .map(p => productoDeDataset(p, fecha, zona))
        .filter((p): p is ProductoSupermercado => p !== null);
      return { porId: new Map(lista.map(p => [p.idExterno, p])), lista };
    })();
    return cargado;
  };

  return {
    cadena: 'mercadona',
    ...PERMISO_MERCADONA,
    capacidades: { buscar: true, disponibilidad: false },
    async buscarProductos(termino, zonaPedida) {
      const aguja = normalizeNombre(termino);
      if (zonaPedida !== zona || aguja === '') {
        return [];
      }
      const { lista } = await cargar();
      return lista
        .filter(p => ` ${normalizeNombre(p.nombre)}`.includes(` ${aguja}`))
        .slice(0, MAX_RESULTADOS_BUSQUEDA);
    },
    async obtenerProducto(idExterno, zonaPedida) {
      if (zonaPedida !== zona) {
        return null;
      }
      return (await cargar()).porId.get(idExterno) ?? null;
    },
  };
}
