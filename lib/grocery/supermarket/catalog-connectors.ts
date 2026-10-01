import type { SupermarketConnector } from './connector';
import type { Envase, ProductoSupermercado, UnidadBase, ZonaId } from './types';
import { normalizeNombre } from '@/lib/text/normalize-nombre';
import { CONSUM_CATALOG_MATCH } from '../consum-catalog.generated';
import { MERCADONA_CATALOG_MATCH } from '../mercadona-catalog.generated';
import { parseFormatoReferencia, precioEnvaseDesdeReferencia } from './units';

/**
 * FRESCO-767 — the two generated catalogs (Mercadona FRESCO-503/762, Consum
 * FRESCO-520) wrapped as `SupermarketConnector`s. Step 1 of the migration in
 * `.context/design/supermarket-data-layer.md` §8: nothing reads these yet, so
 * there is no user-visible change. No network: they only read the committed
 * generated files.
 *
 * - `idExterno` is the catalog key (the canonical ingredient), because the
 *   generated files carry no product id of their own.
 * - One fixed zone: the catalogs are not priced per store.
 * - The catalogs carry no observation date, so `observadoEn` is the Unix
 *   epoch, which the refresh plan reads as stale. That is the honest value.
 */

export const ZONA_CATALOGO: ZonaId = 'catalogo';
export const OBSERVADO_EN_DESCONOCIDO = '1970-01-01T00:00:00.000Z';

const UNIDADES_BASE: readonly UnidadBase[] = ['g', 'ml', 'unidad'];

interface EntradaCatalogo {
  clave: string
  envaseVenta: { cantidad: number, unidad: string }
  precioEnvase: number
  url: string
}

function envaseDe(envaseVenta: EntradaCatalogo['envaseVenta']): Envase | null {
  const unidad = UNIDADES_BASE.find(u => u === envaseVenta.unidad);
  return unidad ? { cantidad: envaseVenta.cantidad, unidad } : null;
}

function aProducto(cadena: string, entrada: EntradaCatalogo): ProductoSupermercado | null {
  const envase = envaseDe(entrada.envaseVenta);
  if (!envase || !(entrada.precioEnvase > 0)) {
    return null;
  }
  return {
    cadena,
    idExterno: entrada.clave,
    nombre: entrada.clave,
    marca: null,
    envase,
    precioEnvase: entrada.precioEnvase,
    url: entrada.url,
    disponible: true,
    zona: ZONA_CATALOGO,
    observadoEn: OBSERVADO_EN_DESCONOCIDO,
  };
}

/** `termino` matches a key that equals it or has it at the start of any word. */
function coincide(clave: string, termino: string): boolean {
  return ` ${clave}`.includes(` ${termino}`);
}

const PRODUCTOS_POR_CADENA = new Map<string, ReadonlyMap<string, ProductoSupermercado>>();

/**
 * Synchronous read of the same catalog a connector serves (FRESCO-768):
 * `mapShoppingListItem` is pure and sync, the connector methods are async.
 * It does NOT check permission: callers must go through the registry first.
 */
export function productoDeCatalogo(cadena: string, clave: string): ProductoSupermercado | null {
  return PRODUCTOS_POR_CADENA.get(cadena)?.get(clave) ?? null;
}

/**
 * Every product of a chain's committed catalog (FRESCO-770, initial load into
 * the database). Same data the connector serves, and the same caveat: it does
 * NOT check permission, callers must go through the registry first.
 */
export function productosDeCatalogo(cadena: string): ProductoSupermercado[] {
  return [...(PRODUCTOS_POR_CADENA.get(cadena)?.values() ?? [])];
}

function crearConectorDeCatalogo(
  base: Pick<SupermarketConnector, 'cadena' | 'permiso' | 'permisoRef'>,
  entradas: readonly EntradaCatalogo[],
): SupermarketConnector {
  const productos = entradas
    .map(entrada => aProducto(base.cadena, entrada))
    .filter((p): p is ProductoSupermercado => p !== null)
    .sort((a, b) => a.idExterno.localeCompare(b.idExterno));
  const porId = new Map(productos.map(p => [p.idExterno, p]));
  PRODUCTOS_POR_CADENA.set(base.cadena, porId);

  return {
    ...base,
    capacidades: { buscar: true, disponibilidad: false },
    async buscarProductos(termino, zona) {
      const aguja = normalizeNombre(termino);
      if (zona !== ZONA_CATALOGO || aguja === '') {
        return [];
      }
      return productos.filter(p => coincide(p.idExterno, aguja));
    },
    async obtenerProducto(idExterno, zona) {
      return zona === ZONA_CATALOGO ? (porId.get(idExterno) ?? null) : null;
    },
  };
}

/**
 * Mercadona prints a price per reference unit. The connector converts it to
 * the price of the whole pack. A count reference ("ud") means the price IS for
 * one whole pack, whatever its weight (ready-to-eat lentils: 4 EUR per 485 g
 * bowl), so it is multiplied by its quantity, exactly like `packPrice` does.
 */
function precioEnvaseMercadona(match: (typeof MERCADONA_CATALOG_MATCH)[string]): number {
  const { precioReferencia, formatoReferencia } = match.precioMercadona;
  const referencia = parseFormatoReferencia(formatoReferencia);
  if (referencia.unidad === 'ud') {
    return precioReferencia * referencia.cantidad;
  }
  const envase = envaseDe(match.envaseVenta);
  const precio = envase
    ? precioEnvaseDesdeReferencia({ precioReferencia, referencia, envase })
    : null;
  return precio ?? 0;
}

export const conectorMercadona = crearConectorDeCatalogo(
  { cadena: 'mercadona', permiso: 'riesgo-aceptado', permisoRef: 'ADR-0028' },
  Object.entries(MERCADONA_CATALOG_MATCH).map(([clave, match]) => ({
    clave,
    envaseVenta: match.envaseVenta,
    precioEnvase: precioEnvaseMercadona(match),
    url: match.shareUrl,
  })),
);

/** Consum prices the whole pack already, so `precio` passes through. */
export const conectorConsum = crearConectorDeCatalogo(
  { cadena: 'consum', permiso: 'riesgo-aceptado', permisoRef: 'ADR-0037' },
  Object.entries(CONSUM_CATALOG_MATCH).map(([clave, match]) => ({
    clave,
    envaseVenta: match.envaseVenta,
    precioEnvase: match.precioConsum.precio,
    url: match.url,
  })),
);
